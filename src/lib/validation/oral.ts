import { z } from "zod";
export const startOralSchema = z.object({ topicExternalId: z.string().min(1), excludedQuestionIds: z.array(z.string()).default([]) });
export const gradeOralSchema = z.object({ oralExamAttemptId: z.string().min(1), questionExternalId: z.string().min(1), answer: z.string().min(1) });
export type StartOralInput = z.infer<typeof startOralSchema>;
export type GradeOralInput = z.infer<typeof gradeOralSchema>;
