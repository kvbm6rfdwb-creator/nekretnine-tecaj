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

export async function startOralAttempt(userId: string, topicExternalId: string, excludedQuestionIds: string[]) {
  const professorEntry = findProfessor(topicExternalId);
  if (!professorEntry) throw new Error("Profesor za traženu temu nije pronađen.");
  const selectedQuestions = chooseQuestions<OralQuestion>(professorEntry.questions, 5, { excludedQuestionIds });
  const oralExamAttemptId = createId("oral_attempt");
  db.insert(oralExamAttempts).values({ id: oralExamAttemptId, userId, topicExternalId, professorName: professorEntry.professor.name, status: "in_progress", questionExternalIds: serializeJson(selectedQuestions.map((q) => q.id)) }).run();
  return {
    oralExamAttemptId,
    topicExternalId,
    professor: { name: professorEntry.professor.name, personalityDescription: professorEntry.professor.personality_description },
    questions: selectedQuestions.map((q) => ({ externalId: q.id, prompt: q.prompt, citations: q.citations }))
  };
}

export async function gradeOralAnswer(userId: string, oralExamAttemptId: string, questionExternalId: string, answer: string) {
  const attempt = db.select().from(oralExamAttempts).where(eq(oralExamAttempts.id, oralExamAttemptId)).get();
  if (!attempt || attempt.userId !== userId) throw new Error("Usmeni pokušaj nije pronađen.");
  const professor = findProfessor(attempt.topicExternalId);
  const question = professor?.questions.find((q) => q.id === questionExternalId) ?? null;
  if (!professor || !question) throw new Error("Usmeno pitanje nije pronađeno.");
  try {
    const evaluation = await provider.gradeAnswer({ prompt: question.prompt, answer, modelAnswerKeyPoints: question.model_answer_key_points, professorName: professor.professor.name, personalityDescription: professor.professor.personality_description, toneDirective: professor.professor.tone_directive });
    db.insert(oralAnswerResults).values({ id: createId("oral_result"), oralExamAttemptId, questionExternalId, answer, isCorrect: evaluation.isCorrect, score: evaluation.score, missingKeyPoints: serializeJson(evaluation.missingKeyPoints), feedback: evaluation.feedback, professorTone: evaluation.professorTone }).run();
    const askedQuestionIds = deserializeJson<string[]>(attempt.questionExternalIds);
    const previousResults = db.select().from(oralAnswerResults).where(eq(oralAnswerResults.oralExamAttemptId, oralExamAttemptId)).all();
    const totalAnswered = previousResults.length;
    const mustRestartProfessor = !evaluation.isCorrect;
    const passed = evaluation.isCorrect && totalAnswered >= askedQuestionIds.length;
    if (mustRestartProfessor) {
      db.update(oralExamAttempts).set({ status: "failed", passed: false, completedAt: new Date().toISOString() }).where(eq(oralExamAttempts.id, oralExamAttemptId)).run();
    } else if (passed) {
      db.update(oralExamAttempts).set({ status: "passed", passed: true, completedAt: new Date().toISOString() }).where(eq(oralExamAttempts.id, oralExamAttemptId)).run();
      await markContentPassed(userId, oralProgressKey(attempt.topicExternalId), 100);
    }
    return { evaluation, attemptStatus: mustRestartProfessor ? "failed" : passed ? "passed" : "in_progress", mustRestartProfessor, remainingQuestionCount: Math.max(askedQuestionIds.length - totalAnswered, 0) };
  } catch (error) {
    if (error instanceof OralProviderUnavailableError) {
      db.insert(oralAnswerResults).values({ id: createId("oral_result"), oralExamAttemptId, questionExternalId, answer, gradingError: error.message }).run();
      throw error;
    }
    throw error;
  }
}
