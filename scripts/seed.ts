import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as fs from "node:fs";
import * as path from "node:path";
import * as schema from "../src/lib/db/schema";
import { contentPackageSchema } from "../src/lib/content/schema";

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}

async function main() {
  const dbPath = path.join(process.cwd(), "nekretnine.db");
  const sqlite = new Database(dbPath);
  sqlite.pragma("journal_mode = WAL");
  const db = drizzle(sqlite, { schema });

  const contentPath = path.join(process.cwd(), "content", "paket_sadrzaja_za_ucenje_agent_nekretnine.json");
  const raw = JSON.parse(fs.readFileSync(contentPath, "utf8"));
  const content = contentPackageSchema.parse(raw);
  console.log(`Validated content: ${content.topics.length} topics, ${content.oral_professors.length} professors`);

  const packageId = createId("pkg");
  db.insert(schema.contentPackages).values({
    id: packageId,
    schemaVersion: content.schema_version,
    language: content.language,
    purpose: content.purpose,
    verificationNotice: content.verification_notice,
    rawPayload: JSON.stringify(content),
    isActive: true
  }).run();
  console.log("Inserted content package");

  let questionCount = 0, slideCount = 0, segmentCount = 0, oralQCount = 0;

  for (const [ti, topic] of content.topics.entries()) {
    const topicId = createId("topic");
    db.insert(schema.topics).values({
      id: topicId,
      packageId,
      externalId: topic.id,
      title: topic.title,
      position: ti,
      finalExamWeight: Math.round(topic.weight_for_final_exam)
    }).run();

    const topicTestCollectionId = createId("qc");
    db.insert(schema.questionCollections).values({
      id: topicTestCollectionId,
      packageId,
      topicId,
      segmentId: null,
      kind: "topic_test",
      passThresholdPercent: topic.topic_test.pass_threshold_percent
    }).run();

    for (const [qi, q] of topic.topic_test.questions.entries()) {
      const questionId = createId("q");
      db.insert(schema.questions).values({
        id: questionId, packageId, topicId, segmentId: null, externalId: `tt_${topic.id}_${q.id}_${qi}`,
        prompt: q.prompt, questionType: q.type, options: JSON.stringify(q.options),
        correctAnswers: JSON.stringify(q.correct_answers), explanation: q.explanation,
        citations: JSON.stringify(q.citations)
      }).run();
      db.insert(schema.questionCollectionItems).values({ collectionId: topicTestCollectionId, questionId, position: qi }).run();
      questionCount++;
    }

    const finalExamCollectionId = createId("qc");
    db.insert(schema.questionCollections).values({
      id: finalExamCollectionId, packageId, topicId, segmentId: null,
      kind: "final_exam_pool", passThresholdPercent: content.assessment_rules.segment_and_topic_pass_threshold_percent
    }).run();
    for (const [qi, q] of topic.final_exam_pool.entries()) {
      const questionId = createId("q");
      db.insert(schema.questions).values({
        id: questionId, packageId, topicId, segmentId: null, externalId: `fe_${topic.id}_${q.id}_${qi}`,
        prompt: q.prompt, questionType: q.type, options: JSON.stringify(q.options),
        correctAnswers: JSON.stringify(q.correct_answers), explanation: q.explanation,
        citations: JSON.stringify(q.citations)
      }).run();
      db.insert(schema.questionCollectionItems).values({ collectionId: finalExamCollectionId, questionId, position: qi }).run();
      questionCount++;
    }

    for (const [si, seg] of topic.segments.entries()) {
      const segmentId = createId("seg");
      db.insert(schema.segments).values({
        id: segmentId, topicId, externalId: seg.id, title: seg.title, position: si,
        estimatedStudyMinutes: seg.estimated_study_minutes
      }).run();
      segmentCount++;

      for (const [sli, slide] of seg.slides.entries()) {
        db.insert(schema.slides).values({
          id: createId("slide"), segmentId, title: slide.title,
          bullets: JSON.stringify(slide.bullets), citations: JSON.stringify(slide.citations), position: sli
        }).run();
        slideCount++;
      }

      const segTestCollectionId = createId("qc");
      db.insert(schema.questionCollections).values({
        id: segTestCollectionId, packageId, topicId: null, segmentId, kind: "segment_test",
        passThresholdPercent: seg.segment_test.pass_threshold_percent
      }).run();
      for (const [qi, q] of seg.segment_test.questions.entries()) {
        const questionId = createId("q");
        db.insert(schema.questions).values({
          id: questionId, packageId, topicId: null, segmentId, externalId: `st_${seg.id}_${q.id}_${qi}`,
          prompt: q.prompt, questionType: q.type, options: JSON.stringify(q.options),
          correctAnswers: JSON.stringify(q.correct_answers), explanation: q.explanation,
          citations: JSON.stringify(q.citations)
        }).run();
        db.insert(schema.questionCollectionItems).values({ collectionId: segTestCollectionId, questionId, position: qi }).run();
        questionCount++;
      }
    }
  }

  const topicRows = db.select().from(schema.topics).all();
  const topicExternalToId = new Map(topicRows.map((t) => [t.externalId, t.id]));

  for (const prof of content.oral_professors) {
    const topicId = topicExternalToId.get(prof.topic_id);
    if (!topicId) { console.warn(`Skipping professor for unknown topic ${prof.topic_id}`); continue; }
    const professorId = createId("prof");
    db.insert(schema.oralProfessors).values({
      id: professorId, packageId, topicId, name: prof.professor.name,
      personalityDescription: prof.professor.personality_description, toneDirective: prof.professor.tone_directive
    }).run();
    for (const [qi, q] of prof.questions.entries()) {
      db.insert(schema.oralQuestions).values({
        id: createId("oq"), professorId, externalId: q.id, prompt: q.prompt,
        modelAnswerKeyPoints: JSON.stringify(q.model_answer_key_points), citations: JSON.stringify(q.citations), position: qi
      }).run();
      oralQCount++;
    }
  }

  console.log(`Seeded: ${content.topics.length} topics, ${segmentCount} segments, ${slideCount} slides, ${questionCount} questions, ${content.oral_professors.length} professors, ${oralQCount} oral questions.`);
  sqlite.close();
}

main().catch((e) => { console.error(e); process.exit(1); });
