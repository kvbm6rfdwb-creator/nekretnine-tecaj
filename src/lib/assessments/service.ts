import { eq } from "drizzle-orm";
import { calculatePercent, chooseFinalExamQuestions, chooseQuestions, passedThreshold, answersMatchExactly } from "@/lib/assessments/question-utils";
import { loadContentPackage } from "@/lib/content/load-content";
import type { MultipleChoiceQuestion } from "@/lib/content/schema";
import { db } from "@/lib/db";
import { createId, deserializeJson, serializeJson } from "@/lib/db/helpers";
import { assessmentAttemptAnswers, assessmentAttempts } from "@/lib/db/schema";
import { contentKeyForKind, markContentPassed, updateBestPercent } from "@/lib/progress/service";
import type { AssessmentAnswerMap, AssessmentKind, AssessmentResult, GeneratedAssessment, PublicQuestion } from "@/types";

function normalizeQuestion(q: MultipleChoiceQuestion): PublicQuestion {
  return { externalId: q.id, prompt: q.prompt, questionType: q.type, options: q.options, citations: q.citations };
}

function getThresholdForScope(kind: AssessmentKind, scopeExternalId: string, content = loadContentPackage()) {
  if (kind === "segment") {
    const segment = content.topics.flatMap((t) => t.segments).find((s) => s.id === scopeExternalId);
    if (!segment) throw new Error("Segment nije pronađen.");
    return segment.segment_test.pass_threshold_percent;
  }
  if (kind === "topic") {
    const topic = content.topics.find((t) => t.id === scopeExternalId);
    if (!topic) throw new Error("Tema nije pronađena.");
    return topic.topic_test.pass_threshold_percent;
  }
  return content.assessment_rules.segment_and_topic_pass_threshold_percent;
}

function findQuestionByExternalId(externalId: string, content = loadContentPackage()) {
  for (const topic of content.topics) {
    for (const q of topic.topic_test.questions) { if (q.id === externalId) return q; }
    for (const q of topic.final_exam_pool) { if (q.id === externalId) return q; }
    for (const segment of topic.segments) {
      for (const q of segment.segment_test.questions) { if (q.id === externalId) return q; }
    }
  }
  return null;
}

export async function generateAssessment(userId: string, kind: AssessmentKind, scopeExternalId: string): Promise<GeneratedAssessment> {
  const content = loadContentPackage();
  let selectedQuestions: MultipleChoiceQuestion[] = [];
  let threshold = getThresholdForScope(kind, scopeExternalId, content);
  if (kind === "segment") {
    const segment = content.topics.flatMap((t) => t.segments).find((s) => s.id === scopeExternalId);
    if (!segment) throw new Error("Segment nije pronađen.");
    selectedQuestions = chooseQuestions(segment.segment_test.questions, segment.segment_test.questions.length);
  } else if (kind === "topic") {
    const topic = content.topics.find((t) => t.id === scopeExternalId);
    if (!topic) throw new Error("Tema nije pronađena.");
    selectedQuestions = chooseQuestions(topic.topic_test.questions, topic.topic_test.questions.length);
  } else {
    const countPerTopic = Math.floor(content.assessment_rules.final_exam_attempt_size / content.topics.length);
    selectedQuestions = chooseFinalExamQuestions(content.topics.map((t) => t.final_exam_pool), countPerTopic);
    threshold = content.assessment_rules.segment_and_topic_pass_threshold_percent;
  }
  const attemptId = createId("attempt");
  db.insert(assessmentAttempts).values({ id: attemptId, userId, kind, scopeExternalId, status: "in_progress", questionExternalIds: serializeJson(selectedQuestions.map((q) => q.id)), answers: serializeJson({} satisfies AssessmentAnswerMap), totalQuestions: selectedQuestions.length }).run();
  return { attemptId, kind, scopeExternalId, passThresholdPercent: threshold, questions: selectedQuestions.map(normalizeQuestion) };
}

export async function submitAssessment(userId: string, attemptId: string, answers: AssessmentAnswerMap): Promise<AssessmentResult> {
  const attempt = db.select().from(assessmentAttempts).where(eq(assessmentAttempts.id, attemptId)).get() /*async*/;
  if (!attempt || attempt.userId !== userId) throw new Error("Pokušaj testa nije pronađen.");
  const content = loadContentPackage();
  const questionIds = deserializeJson<string[]>(attempt.questionExternalIds);
  const questionsForAttempt = questionIds.map((id) => findQuestionByExternalId(id, content)).filter((q): q is MultipleChoiceQuestion => Boolean(q));
  const answerRows: AssessmentResult["answers"] = [];
  let correctCount = 0;
  for (const question of questionsForAttempt) {
    const selectedOptionIds = answers[question.id] ?? [];
    const isCorrect = answersMatchExactly(selectedOptionIds, question.correct_answers);
    if (isCorrect) correctCount += 1;
    answerRows.push({ questionExternalId: question.id, selectedOptionIds, isCorrect, explanation: question.explanation, citations: question.citations });
    db.insert(assessmentAttemptAnswers).values({ id: createId("attempt_answer"), attemptId: attempt.id, questionExternalId: question.id, selectedOptionIds: serializeJson(selectedOptionIds), isCorrect, explanationSnapshot: question.explanation, citationsSnapshot: serializeJson(question.citations) }).run();
  }
  const percent = calculatePercent(correctCount, questionsForAttempt.length);
  const threshold = getThresholdForScope(attempt.kind as AssessmentKind, attempt.scopeExternalId, content);
  const passed = passedThreshold(percent, threshold);
  const submittedAt = new Date().toISOString();
  db.update(assessmentAttempts).set({ answers: serializeJson(answers), correctCount, percent, passed, status: "graded", submittedAt }).where(eq(assessmentAttempts.id, attempt.id)).run();
  const contentKey = contentKeyForKind(attempt.kind as AssessmentKind, attempt.scopeExternalId);
  await updateBestPercent(userId, contentKey, percent);
  if (passed) await markContentPassed(userId, contentKey, percent);
  return { attemptId: attempt.id, kind: attempt.kind as AssessmentKind, scopeExternalId: attempt.scopeExternalId, totalQuestions: questionsForAttempt.length, correctCount, percent, passed, submittedAt, answers: answerRows };
}
