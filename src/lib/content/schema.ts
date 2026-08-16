import { z } from "zod";

export const citationSchema = z.string().min(1);
export const answerOptionSchema = z.object({ id: z.string().min(1), text: z.string().min(1) });

export const multipleChoiceQuestionSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["multiplechoice", "multiple_choice"]),
  prompt: z.string().min(1),
  options: z.array(answerOptionSchema).min(2),
  correct_answers: z.array(z.string().min(1)).min(1),
  explanation: z.string().min(1),
  citations: z.array(citationSchema).default([])
});

export const slideSchema = z.object({
  title: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(1),
  citations: z.array(citationSchema).default([])
});

export const segmentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  estimated_study_minutes: z.number().int().positive(),
  slides: z.array(slideSchema).min(1),
  segment_test: z.object({
    pass_threshold_percent: z.number().int().min(1).max(100),
    questions: z.array(multipleChoiceQuestionSchema).min(1)
  })
});

export const topicSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  weight_for_final_exam: z.number().positive(),
  segments: z.array(segmentSchema).min(1),
  topic_test: z.object({
    pass_threshold_percent: z.number().int().min(1).max(100),
    questions: z.array(multipleChoiceQuestionSchema).min(1)
  }),
  final_exam_pool: z.array(multipleChoiceQuestionSchema).min(1)
});

export const oralQuestionSchema = z.object({
  id: z.string().min(1),
  prompt: z.string().min(1),
  model_answer_key_points: z.array(z.string().min(1)).min(1),
  citations: z.array(citationSchema).default([])
});

export const oralProfessorSchema = z.object({
  topic_id: z.string().min(1),
  professor: z.object({
    name: z.string().min(1),
    personality_description: z.string().min(1),
    tone_directive: z.string().min(1)
  }),
  questions: z.array(oralQuestionSchema).min(5)
});

export const assessmentRulesSchema = z.object({
  segment_and_topic_pass_threshold_percent: z.number().int().min(1).max(100),
  mcq_selection_rule: z.string().min(1),
  final_exam_attempt_size: z.number().int().positive(),
  final_exam_composition: z.string().min(1),
  scoring: z.string().min(1)
});

export const contentPackageSchema = z.object({
  schema_version: z.string().min(1),
  language: z.literal("hr"),
  purpose: z.string().min(1),
  assessment_rules: assessmentRulesSchema,
  verification_notice: z.string().min(1),
  topics: z.array(topicSchema).length(5),
  oral_professors: z.array(oralProfessorSchema).length(5),
  source_registry: z.record(z.string().min(1))
}).superRefine((content, ctx) => {
  const topicIds = new Set(content.topics.map((t) => t.id));
  for (const op of content.oral_professors) {
    if (!topicIds.has(op.topic_id)) {
      ctx.addIssue({ code: "custom", path: ["oral_professors"], message: `Usmeni profesor koristi nepostojeću temu: ${op.topic_id}.` });
    }
  }
  const oralTopicIds = new Set(content.oral_professors.map((p) => p.topic_id));
  for (const topic of content.topics) {
    if (!oralTopicIds.has(topic.id)) {
      ctx.addIssue({ code: "custom", path: ["oral_professors"], message: `Nedostaje usmeni profesor za temu: ${topic.id}.` });
    }
  }
});

export type ContentPackage = z.infer<typeof contentPackageSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type Segment = z.infer<typeof segmentSchema>;
export type Slide = z.infer<typeof slideSchema>;
export type MultipleChoiceQuestion = z.infer<typeof multipleChoiceQuestionSchema>;
export type OralProfessor = z.infer<typeof oralProfessorSchema>;
export type OralQuestion = z.infer<typeof oralQuestionSchema>;
