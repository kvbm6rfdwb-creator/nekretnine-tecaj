import { NextRequest, NextResponse } from "next/server";
import { generateAttemptSchema } from "@/lib/validation/attempt";
import { generateAssessment } from "@/lib/assessments/service";
import { DEFAULT_USER_ID } from "@/lib/progress/service";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = generateAttemptSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Neispravan zahtjev.", details: parsed.error.flatten() }, { status: 400 });
    const { kind, scopeExternalId } = parsed.data;
    if ((kind === "segment" || kind === "topic") && !scopeExternalId) return NextResponse.json({ error: "scopeExternalId je obavezan za segment i topic testove." }, { status: 400 });
    const assessment = await generateAssessment(DEFAULT_USER_ID, kind, scopeExternalId ?? "final");
    return NextResponse.json(assessment);
  } catch (error) {
    console.error("POST /api/attempts/generate error:", error);
    return NextResponse.json({ error: "Interna greška servera." }, { status: 500 });
  }
}
