import fs from "node:fs";
import path from "node:path";
import { contentPackageSchema, type ContentPackage } from "@/lib/content/schema";

const contentPath = path.join(process.cwd(), "content", "paket_sadrzaja_za_ucenje_agent_nekretnine.json");
let cachedContent: ContentPackage | undefined;

export function loadContentPackage(): ContentPackage {
  if (cachedContent) return cachedContent;
  if (!fs.existsSync(contentPath)) throw new Error("Nedostaje datoteka content/paket_sadrzaja_za_ucenje_agent_nekretnine.json.");
  cachedContent = contentPackageSchema.parse(JSON.parse(fs.readFileSync(contentPath, "utf8")));
  return cachedContent;
}

export function getTopicFromContent(topicId: string) {
  return loadContentPackage().topics.find((t) => t.id === topicId);
}

export function getSegmentFromContent(segmentId: string) {
  return loadContentPackage().topics.flatMap((t) => t.segments).find((s) => s.id === segmentId);
}

export function getOralProfessorFromContent(topicId: string) {
  return loadContentPackage().oral_professors.find((p) => p.topic_id === topicId);
}
