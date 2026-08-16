import { NextRequest, NextResponse } from "next/server";
import { gradeOralSchema } from "@/lib/validation/oral";
import { gradeOralAnswer } from "@/lib/oral/service";
import { DEFAULT_USER_ID } from "@/lib/progress/service";
import { OralProviderUnavailableError } from "@/lib/ai/oral-provider";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = gradeOralSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Neispravan zahtjev.", details: parsed.error.flatten() }, { status: 400 });
    const result = await gradeOralAnswer(DEFAULT_USER_ID, parsed.data.oralExamAttemptId, parsed.data.questionExternalId, parsed.data.answer);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof OralProviderUnavailableError) return NextResponse.json({ error: error.message, retryable: true }, { status: 503 });
    console.error("POST /api/oral/grade error:", error);
    return NextResponse.json({ error: "Interna greška servera." }, { status: 500 });
  }
}
