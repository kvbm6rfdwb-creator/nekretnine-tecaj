import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { gradeOralAnswer, finaliseBatchAttempt } from "@/lib/oral/service";
import { DEFAULT_USER_ID } from "@/lib/progress/service";
import { OralProviderUnavailableError } from "@/lib/ai/oral-provider";

const batchGradeSchema = z.object({
  oralExamAttemptId: z.string().min(1),
  answers: z
    .array(
      z.object({
        questionExternalId: z.string().min(1),
        answer: z.string().min(1),
      })
    )
    .min(1)
    .max(10),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = batchGradeSchema.safeParse(body);
    if (!parsed.success)
      return NextResponse.json(
        { error: "Neispravan zahtjev.", details: parsed.error.flatten() },
        { status: 400 }
      );

    const { oralExamAttemptId, answers } = parsed.data;
    const results: Array<{
      questionExternalId: string;
      evaluation: {
        isCorrect: boolean;
        score: number;
        missingKeyPoints: string[];
        feedback: string;
        professorTone: string;
      };
    }> = [];

    for (const { questionExternalId, answer } of answers) {
      const result = await gradeOralAnswer(
        DEFAULT_USER_ID,
        oralExamAttemptId,
        questionExternalId,
        answer,
        true // batchMode: service skips interim attempt status updates
      );
      results.push({ questionExternalId, evaluation: result.evaluation });
    }

    const passed = results.every((r) => r.evaluation.isCorrect);

    // Persist final attempt status and unlock oral progress key if passed
    await finaliseBatchAttempt(DEFAULT_USER_ID, oralExamAttemptId, passed);

    return NextResponse.json({ passed, results });
  } catch (error) {
    if (error instanceof OralProviderUnavailableError)
      return NextResponse.json({ error: error.message, retryable: true }, { status: 503 });
    console.error("POST /api/oral/grade error:", error);
    return NextResponse.json({ error: "Interna greška servera." }, { status: 500 });
  }
}
