import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { contentPackages, topics, segments } from "@/lib/db/schema";
import { getUserProgressEntries, DEFAULT_USER_ID, getUnlockStatus } from "@/lib/progress/service";
import { loadContentPackage } from "@/lib/content/load-content";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const activePackage = await db.select().from(contentPackages).where(eq(contentPackages.isActive, true)).get();
    if (!activePackage) return NextResponse.json({ error: "Sadržaj nije seeded. Pokrenite npm run db:seed." }, { status: 503 });
    const content = loadContentPackage();
    const allTopics = await db.select().from(topics).where(eq(topics.packageId, activePackage.id)).all();
    const allSegments = await db.select().from(segments).all();
    const progress = await getUserProgressEntries(DEFAULT_USER_ID);
    const unlock = await getUnlockStatus(DEFAULT_USER_ID);
    return NextResponse.json({ package: { id: activePackage.id, schemaVersion: activePackage.schemaVersion, language: activePackage.language, purpose: activePackage.purpose, verificationNotice: activePackage.verificationNotice }, topics: allTopics, segments: allSegments, progress, unlock, assessmentRules: content.assessment_rules });
  } catch (error) {
    console.error("GET /api/content error:", error);
    return NextResponse.json({ error: "Interna greška servera." }, { status: 500 });
  }
}
