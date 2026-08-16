import { NextRequest, NextResponse } from "next/server";
import { submitAttemptSchema } from "@/lib/validation/attempt";
import { submitAssessment } from "@/lib/assessments/service";
import { DEFAULT_USER_ID, refreshUnlocks } from "@/lib/progress/service";
import { db } from "@/lib/db";
import { contentPackages } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = submitAttemptSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: "Neispravan zahtjev.", details: parsed.error.flatten() }, { status: 400 });
    const result = await submitAssessment(DEFAULT_USER_ID, parsed.data.attemptId, parsed.data.answers);
    const activePackage = await db.select().from(contentPackages).where(eq(contentPackages.isActive, true)).get();
    if (activePackage) await refreshUnlocks(activePackage.id, DEFAULT_USER_ID);
    return NextResponse.json(result);
  } catch (error) {
    console.error("POST /api/attempts/submit error:", error);
    return NextResponse.json({ error: "Interna greška servera." }, { status: 500 });
  }
}
