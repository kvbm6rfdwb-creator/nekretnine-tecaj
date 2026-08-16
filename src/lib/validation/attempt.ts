import { z } from "zod";
export const generateAttemptSchema = z.object({ kind: z.enum(["segment", "topic", "final"]), scopeExternalId: z.string().min(1).optional() });
export const submitAttemptSchema = z.object({ attemptId: z.string().min(1), answers: z.record(z.array(z.string())) });
export type GenerateAttemptInput = z.infer<typeof generateAttemptSchema>;
export type SubmitAttemptInput = z.infer<typeof submitAttemptSchema>;
