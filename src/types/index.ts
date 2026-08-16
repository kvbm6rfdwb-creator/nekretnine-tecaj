import type { ContentPackage, MultipleChoiceQuestion, OralProfessor, OralQuestion, Segment, Slide, Topic } from "@/lib/content/schema";
export type { ContentPackage, MultipleChoiceQuestion, OralProfessor, OralQuestion, Segment, Slide, Topic };

export type AssessmentKind = "segment" | "topic" | "final";
export type AssessmentAnswerMap = Record<string, string[]>;

export type PublicQuestion = {
  externalId: string;
  prompt: string;
  questionType: string;
  options: Array<{ id: string; text: string }>;
  citations: string[];
};

export type GeneratedAssessment = {
  attemptId: string;
  kind: AssessmentKind;
  scopeExternalId: string;
  passThresholdPercent: number;
  questions: PublicQuestion[];
};

export type AssessmentResult = {
  attemptId: string;
  kind: AssessmentKind;
  scopeExternalId: string;
  totalQuestions: number;
  correctCount: number;
  percent: number;
  passed: boolean;
  submittedAt: string;
  answers: Array<{ questionExternalId: string; selectedOptionIds: string[]; isCorrect: boolean; explanation: string; citations: string[] }>;
};

export type OralEvaluation = {
  isCorrect: boolean;
  score: number;
  missingKeyPoints: string[];
  feedback: string;
  professorTone: "strict" | "friendly";
};

export type OralGradingUnavailable = { retryable: true; message: string };

export type ContentProgress = {
  contentKey: string;
  status: "locked" | "available" | "passed";
  bestPercent: number;
  passedAt: string | null;
};
