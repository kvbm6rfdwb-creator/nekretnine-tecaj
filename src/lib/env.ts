import { z } from "zod";

const serverEnvironmentSchema = z.object({
  DATABASE_PATH: z.string().min(1).default("nekretnine.db"),
  GEMINI_API_KEY: z.string().min(1).optional(),
  GEMINI_MODEL: z.string().min(1).default("gemini-2.5-flash"),
  RATE_LIMIT_PER_MINUTE: z.coerce.number().int().positive().default(12)
});

export type ServerEnvironment = z.infer<typeof serverEnvironmentSchema>;

let cachedEnvironment: ServerEnvironment | undefined;

export function getServerEnv(): ServerEnvironment {
  if (cachedEnvironment) {
    return cachedEnvironment;
  }
  cachedEnvironment = serverEnvironmentSchema.parse({
    DATABASE_PATH: process.env.DATABASE_PATH,
    GEMINI_API_KEY: process.env.GEMINI_API_KEY,
    GEMINI_MODEL: process.env.GEMINI_MODEL,
    RATE_LIMIT_PER_MINUTE: process.env.RATE_LIMIT_PER_MINUTE
  });
  return cachedEnvironment;
}
