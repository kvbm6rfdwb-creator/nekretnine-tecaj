import { eq, inArray } from "drizzle-orm";
import { db } from "@/lib/db";
import { createId } from "@/lib/db/helpers";
import { topics, segments, userProgress, users } from "@/lib/db/schema";

export const DEFAULT_USER_ID = "user_local_demo";
export const DEFAULT_USER_KEY = "local-demo-user";

const segmentKey = (id: string) => `segment:${id}`;
const topicKey = (id: string) => `topic:${id}`;
const finalExamKey = () => "final_exam";
const oralTopicKey = (id: string) => `oral:${id}`;

export async function ensureDefaultUser() {
  const existing = db.select().from(users).where(eq(users.id, DEFAULT_USER_ID)).get();
  if (!existing) {
    db.insert(users).values({ id: DEFAULT_USER_ID, anonymousKey: DEFAULT_USER_KEY, displayName: "Lokalni korisnik" }).run();
  }
  return DEFAULT_USER_ID;
}

export async function getUserProgressEntries(userId: string) {
  return db.select().from(userProgress).where(eq(userProgress.userId, userId)).all();
}

export async function ensureProgressShell(packageId: string, userId: string) {
  const allTopics = db.select().from(topics).where(eq(topics.packageId, packageId)).all();
  for (let ti = 0; ti < allTopics.length; ti += 1) {
    const topic = allTopics[ti];
    const topicSegments = db.select().from(segments).where(eq(segments.topicId, topic.id)).all();
    for (let si = 0; si < topicSegments.length; si += 1) {
      const segment = topicSegments[si];
      const key = segmentKey(segment.externalId);
      const existing = (await getUserProgressEntries(userId)).find((e) => e.contentKey === key);
      if (!existing) {
        db.insert(userProgress).values({ id: createId("progress"), userId, contentKey: key, status: si === 0 ? "available" : "locked", bestPercent: 0, passedAt: null }).run();
      }
    }
    const topicExisting = (await getUserProgressEntries(userId)).find((e) => e.contentKey === topicKey(topic.externalId));
    if (!topicExisting) db.insert(userProgress).values({ id: createId("progress"), userId, contentKey: topicKey(topic.externalId), status: "locked", bestPercent: 0, passedAt: null }).run();
    const oralExisting = (await getUserProgressEntries(userId)).find((e) => e.contentKey === oralTopicKey(topic.externalId));
    if (!oralExisting) db.insert(userProgress).values({ id: createId("progress"), userId, contentKey: oralTopicKey(topic.externalId), status: "locked", bestPercent: 0, passedAt: null }).run();
  }
  const finalExisting = (await getUserProgressEntries(userId)).find((e) => e.contentKey === finalExamKey());
  if (!finalExisting) db.insert(userProgress).values({ id: createId("progress"), userId, contentKey: finalExamKey(), status: "locked", bestPercent: 0, passedAt: null }).run();
}

export async function refreshUnlocks(packageId: string, userId: string) {
  const allTopics = db.select().from(topics).where(eq(topics.packageId, packageId)).all();
  let allProgress = await getUserProgressEntries(userId);
  for (const topic of allTopics) {
    const topicSegments = db.select().from(segments).where(eq(segments.topicId, topic.id)).all();
    for (let i = 0; i < topicSegments.length; i += 1) {
      const segment = topicSegments[i];
      const currentEntry = allProgress.find((e) => e.contentKey === segmentKey(segment.externalId));
      if (!currentEntry) continue;
      const previousSegment = topicSegments[i - 1];
      const shouldBeAvailable = i === 0 || allProgress.find((e) => e.contentKey === segmentKey(previousSegment.externalId))?.status === "passed";
      if (currentEntry.status === "locked" && shouldBeAvailable) {
        db.update(userProgress).set({ status: "available", updatedAt: new Date().toISOString() }).where(eq(userProgress.id, currentEntry.id)).run();
      }
    }
  }
  allProgress = await getUserProgressEntries(userId);
  for (const topic of allTopics) {
    const topicSegments = db.select().from(segments).where(eq(segments.topicId, topic.id)).all();
    const allPassed = topicSegments.every((s) => allProgress.find((e) => e.contentKey === segmentKey(s.externalId))?.status === "passed");
    const topicEntry = allProgress.find((e) => e.contentKey === topicKey(topic.externalId));
    if (topicEntry && topicEntry.status === "locked" && allPassed) {
      db.update(userProgress).set({ status: "available", updatedAt: new Date().toISOString() }).where(eq(userProgress.id, topicEntry.id)).run();
    }
  }
  allProgress = await getUserProgressEntries(userId);
  const everyTopicPassed = allTopics.every((t) => allProgress.find((e) => e.contentKey === topicKey(t.externalId))?.status === "passed");
  const finalEntry = allProgress.find((e) => e.contentKey === finalExamKey());
  if (finalEntry && finalEntry.status === "locked" && everyTopicPassed) {
    db.update(userProgress).set({ status: "available", updatedAt: new Date().toISOString() }).where(eq(userProgress.id, finalEntry.id)).run();
  }
  allProgress = await getUserProgressEntries(userId);
  const finalPassed = allProgress.find((e) => e.contentKey === finalExamKey())?.status === "passed";
  if (finalPassed) {
    const oralIds = allProgress.filter((e) => e.contentKey.startsWith("oral:") && e.status === "locked").map((e) => e.id);
    if (oralIds.length > 0) db.update(userProgress).set({ status: "available", updatedAt: new Date().toISOString() }).where(inArray(userProgress.id, oralIds)).run();
  }
}

export async function markContentPassed(userId: string, contentKey: string, percent: number) {
  const existing = (await getUserProgressEntries(userId)).find((e) => e.contentKey === contentKey);
  if (!existing) return;
  db.update(userProgress).set({ status: "passed", bestPercent: Math.max(existing.bestPercent, percent), passedAt: existing.passedAt ?? new Date().toISOString(), updatedAt: new Date().toISOString() }).where(eq(userProgress.id, existing.id)).run();
}

export async function updateBestPercent(userId: string, contentKey: string, percent: number) {
  const existing = (await getUserProgressEntries(userId)).find((e) => e.contentKey === contentKey);
  if (!existing) return;
  db.update(userProgress).set({ bestPercent: Math.max(existing.bestPercent, percent), updatedAt: new Date().toISOString() }).where(eq(userProgress.id, existing.id)).run();
}

export async function getUnlockStatus(userId: string) {
  const progress = await getUserProgressEntries(userId);
  const finalEntry = progress.find((e) => e.contentKey === finalExamKey());
  const oralEntries = progress.filter((e) => e.contentKey.startsWith("oral:"));
  return {
    finalExamUnlocked: finalEntry?.status !== "locked",
    finalExamPassed: finalEntry?.status === "passed",
    oralExamUnlocked: oralEntries.some((e) => e.status !== "locked"),
    passedKeys: progress.filter((e) => e.status === "passed").map((e) => e.contentKey)
  };
}

export function contentKeyForKind(kind: "segment" | "topic" | "final", scopeExternalId: string) {
  if (kind === "segment") return segmentKey(scopeExternalId);
  if (kind === "topic") return topicKey(scopeExternalId);
  return finalExamKey();
}

export function oralProgressKey(topicExternalId: string) { return oralTopicKey(topicExternalId); }
