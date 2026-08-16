import { NextRequest, NextResponse } from "next/server";
import { startOralSchema } from "@/lib/validation/oral";
import { startOralAttempt } from "@/lib/oral/service";
import { DEFAULT_USER_ID } from "@/lib/progress/service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = startOralSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Neispravan zahtjev.", details: parsed.error.flatten() }, { status: 400 });
    const attempt = await startOralAttempt(DEFAULT_USER_ID, parsed.data.topicExternalId, parsed.data.excludedQuestionIds);
    return NextResponse.json(attempt);
  } catch (error) {
    console.error("POST /api/oral/start error:", error);
    return NextResponse.json({ error: "Interna greška servera." }, { status: 500 });
  }
}
