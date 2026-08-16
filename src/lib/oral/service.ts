import { eq } from "drizzle-orm";
import { GeminiOralExamProvider } from "@/lib/ai/gemini-provider";
import { OralProviderUnavailableError } from "@/lib/ai/oral-provider";
import { chooseQuestions } from "@/lib/assessments/question-utils";
import { loadContentPackage } from "@/lib/content/load-content";
import type { OralQuestion } from "@/lib/content/schema";
import { db } from "@/lib/db";
import { createId, deserializeJson, serializeJson } from "@/lib/db/helpers";
import { oralAnswerResults, oralExamAttempts } from "@/lib/db/schema";
import { markContentPassed, oralProgressKey } from "@/lib/progress/service";

const provider = new GeminiOralExamProvider();

function findProfessor(topicExternalId: string) {
  return loadContentPackage().oral_professors.find((p) => p.topic_id === topicExternalId);
}

export async function startOralAttempt(
  userId: string,
  topicExternalId: string,
  excludedQuestionIds: string[]
) {
  const professorEntry = findProfessor(topicExternalId);
  if (!professorEntry) throw new Error("Profesor za traženu temu nije pronađen.");
  const selectedQuestions = chooseQuestions<OralQuestion>(professorEntry.questions, 5, {
    excludedQuestionIds,
  });
  const oralExamAttemptId = createId("oral_attempt");
  db.insert(oralExamAttempts)
    .values({
      id: oralExamAttemptId,
      userId,
      topicExternalId,
      professorName: professorEntry.professor.name,
      status: "in_progress",
      questionExternalIds: serializeJson(selectedQuestions.map((q) => q.id)),
    })
    .run();
  return {
    oralExamAttemptId,
    topicExternalId,
    professor: {
      name: professorEntry.professor.name,
      personalityDescription: professorEntry.professor.personality_description,
    },
    questions: selectedQuestions.map((q) => ({
      externalId: q.id,
      prompt: q.prompt,
      citations: q.citations,
    })),
  };
}

/**
 * Grade a single oral answer.
 *
 * @param batchMode - When true (called from the batch-grade route) the function
 *   records the answer result but does NOT update the attempt status mid-way.
 *   The route layer is responsible for aggregating results and finalising status.
 *   When false (default), legacy single-answer behaviour is preserved:
 *   attempt is immediately marked failed on any wrong answer, or passed when
 *   the last answer is correct.
 */
export async function gradeOralAnswer(
  userId: string,
  oralExamAttemptId: string,
  questionExternalId: string,
  answer: string,
  batchMode = false
) {
  const attempt = db
    .select()
    .from(oralExamAttempts)
    .where(eq(oralExamAttempts.id, oralExamAttemptId))
    .get();
  if (!attempt || attempt.userId !== userId)
    throw new Error("Usmeni pokušaj nije pronađen.");

  const professor = findProfessor(attempt.topicExternalId);
  const question = professor?.questions.find((q) => q.id === questionExternalId) ?? null;
  if (!professor || !question) throw new Error("Usmeno pitanje nije pronađeno.");

  try {
    const evaluation = await provider.gradeAnswer({
      prompt: question.prompt,
      answer,
      modelAnswerKeyPoints: question.model_answer_key_points,
      professorName: professor.professor.name,
      personalityDescription: professor.professor.personality_description,
      toneDirective: professor.professor.tone_directive,
    });

    db.insert(oralAnswerResults)
      .values({
        id: createId("oral_result"),
        oralExamAttemptId,
        questionExternalId,
        answer,
        isCorrect: evaluation.isCorrect,
        score: evaluation.score,
        missingKeyPoints: serializeJson(evaluation.missingKeyPoints),
        feedback: evaluation.feedback,
        professorTone: evaluation.professorTone,
      })
      .run();

    if (!batchMode) {
      // Legacy single-answer flow: fail immediately on wrong answer, pass when done.
      const askedQuestionIds = deserializeJson<string[]>(attempt.questionExternalIds);
      const previousResults = db
        .select()
        .from(oralAnswerResults)
        .where(eq(oralAnswerResults.oralExamAttemptId, oralExamAttemptId))
        .all();
      const totalAnswered = previousResults.length;
      const mustRestartProfessor = !evaluation.isCorrect;
      const passed = evaluation.isCorrect && totalAnswered >= askedQuestionIds.length;

      if (mustRestartProfessor) {
        db.update(oralExamAttempts)
          .set({ status: "failed", passed: false, completedAt: new Date().toISOString() })
          .where(eq(oralExamAttempts.id, oralExamAttemptId))
          .run();
      } else if (passed) {
        db.update(oralExamAttempts)
          .set({ status: "passed", passed: true, completedAt: new Date().toISOString() })
          .where(eq(oralExamAttempts.id, oralExamAttemptId))
          .run();
        await markContentPassed(userId, oralProgressKey(attempt.topicExternalId), 100);
      }

      return {
        evaluation,
        attemptStatus: mustRestartProfessor ? "failed" : passed ? "passed" : "in_progress",
        mustRestartProfessor,
        remainingQuestionCount: Math.max(
          askedQuestionIds.length - totalAnswered,
          0
        ),
      };
    }

    // Batch mode: just return the evaluation; route handles aggregate status.
    return { evaluation };
  } catch (error) {
    if (error instanceof OralProviderUnavailableError) {
      db.insert(oralAnswerResults)
        .values({
          id: createId("oral_result"),
          oralExamAttemptId,
          questionExternalId,
          answer,
          gradingError: error.message,
        })
        .run();
      throw error;
    }
    throw error;
  }
}

/**
 * Finalise a batch oral attempt after all answers have been graded.
 * Called by the batch-grade route once all individual gradeOralAnswer calls succeed.
 */
export async function finaliseBatchAttempt(
  userId: string,
  oralExamAttemptId: string,
  passed: boolean
) {
  const attempt = db
    .select()
    .from(oralExamAttempts)
    .where(eq(oralExamAttempts.id, oralExamAttemptId))
    .get();
  if (!attempt || attempt.userId !== userId) return;

  db.update(oralExamAttempts)
    .set({
      status: passed ? "passed" : "failed",
      passed,
      completedAt: new Date().toISOString(),
    })
    .where(eq(oralExamAttempts.id, oralExamAttemptId))
    .run();

  if (passed) {
    await markContentPassed(userId, oralProgressKey(attempt.topicExternalId), 100);
  }
}
