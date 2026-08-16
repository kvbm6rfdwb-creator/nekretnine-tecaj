import { z } from "zod";

export const oralEvaluationSchema = z.object({
  isCorrect: z.boolean(),
  score: z.number().int().min(0).max(100),
  missingKeyPoints: z.array(z.string()),
  feedback: z.string().min(1),
  professorTone: z.enum(["strict", "friendly"])
});
export type OralEvaluation = z.infer<typeof oralEvaluationSchema>;

export type GradeOralAnswerRequest = {
  prompt: string; answer: string; modelAnswerKeyPoints: string[];
  professorName: string; personalityDescription: string; toneDirective: string;
};

export interface OralExamProvider {
  gradeAnswer(input: GradeOralAnswerRequest): Promise<OralEvaluation>;
}

export class OralProviderUnavailableError extends Error {
  readonly retryable = true;
  constructor(message: string) { super(message); this.name = "OralProviderUnavailableError"; }
}
