import "server-only";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import { getServerEnv } from "@/lib/env";
import { type GradeOralAnswerRequest, type OralEvaluation, OralProviderUnavailableError, oralEvaluationSchema, type OralExamProvider } from "@/lib/ai/oral-provider";
import { enforceRateLimit } from "@/lib/ai/rate-limit";

const MAX_ATTEMPTS = 3;
const REQUEST_TIMEOUT_MS = 18_000;

function pause(ms: number) { return new Promise<void>((r) => setTimeout(r, ms)); }

function isTransientError(error: unknown) {
  const m = error instanceof Error ? error.message.toLowerCase() : "";
  return m.includes("429") || m.includes("quota") || m.includes("timeout") || m.includes("temporarily") || m.includes("unavailable") || m.includes("503") || m.includes("500");
}

async function withTimeout<T>(promise: Promise<T>): Promise<T> {
  let tid: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => { tid = setTimeout(() => reject(new Error("Vrijeme čekanja za Gemini odgovor je isteklo.")), REQUEST_TIMEOUT_MS); });
  try { return await Promise.race([promise, timeout]); } finally { if (tid) clearTimeout(tid); }
}

export class GeminiOralExamProvider implements OralExamProvider {
  async gradeAnswer(input: GradeOralAnswerRequest): Promise<OralEvaluation> {
    const env = getServerEnv();
    if (!env.GEMINI_API_KEY) throw new OralProviderUnavailableError("Gemini API ključ nije postavljen. Odgovor nije označen netočnim; upišite ključ u .env.local i pokušajte ponovno.");
    enforceRateLimit("anonymous-local-user", env.RATE_LIMIT_PER_MINUTE);

    const client = new GoogleGenerativeAI(env.GEMINI_API_KEY);
    const model = client.getGenerativeModel({
      model: env.GEMINI_MODEL,
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
        responseSchema: {
          type: SchemaType.OBJECT,
          properties: {
            isCorrect: { type: SchemaType.BOOLEAN },
            score: { type: SchemaType.INTEGER },
            missingKeyPoints: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            feedback: { type: SchemaType.STRING },
            professorTone: { type: SchemaType.STRING, enum: ["strict", "friendly"] }
          },
          required: ["isCorrect", "score", "missingKeyPoints", "feedback", "professorTone"]
        }
      }
    });

    const prompt = [
      "Ti si profesor na usmenom stručnom ispitu za agenta posredovanja u prometu nekretnina.",
      `Profesor: ${input.professorName}.`,
      `Osobnost profesora: ${input.personalityDescription}`,
      `Uputa za ton: ${input.toneDirective}`,
      "",
      `Pitanje: ${input.prompt}`,
      `Ključne točke koje odgovor mora obuhvatiti: ${input.modelAnswerKeyPoints.join("; ")}`,
      `Odgovor kandidata: ${input.answer}`,
      "",
      "Ocjenjuj isključivo prema priloženim ključnim točkama.",
      "Ne uvodi dodatne činjenice koje nisu prisutne u ključnim točkama.",
      "Vrati isključivo JSON koji odgovara zadanoj response schema strukturi."
    ].join("\n");

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
      try {
        const result = await withTimeout(model.generateContent(prompt));
        return oralEvaluationSchema.parse(JSON.parse(result.response.text()));
      } catch (error) {
        lastError = error;
        if (!isTransientError(error) || attempt === MAX_ATTEMPTS) break;
        await pause(400 * 2 ** (attempt - 1));
      }
    }
    void lastError;
    throw new OralProviderUnavailableError("Gemini kvota ili usluga trenutačno nije dostupna. Odgovor nije označen netočnim; pokušajte ocijeniti ponovno.");
  }
}
