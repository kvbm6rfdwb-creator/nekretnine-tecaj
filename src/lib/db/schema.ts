import {
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP")
};

export const users = sqliteTable("users", {
  id: text("id").primaryKey().notNull(),
  anonymousKey: text("anonymous_key").notNull(),
  displayName: text("display_name"),
  ...timestamps
}, (t) => ({ anonymousKeyUnique: uniqueIndex("users_anonymous_key_unique").on(t.anonymousKey) }));

export const contentPackages = sqliteTable("content_packages", {
  id: text("id").primaryKey().notNull(),
  schemaVersion: text("schema_version").notNull(),
  language: text("language").notNull(),
  purpose: text("purpose").notNull(),
  verificationNotice: text("verification_notice").notNull(),
  rawPayload: text("raw_payload").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  seededAt: text("seeded_at").notNull().default("CURRENT_TIMESTAMP")
}, (t) => ({
  schemaVersionUnique: uniqueIndex("content_packages_version_unique").on(t.schemaVersion),
  activeIndex: index("content_packages_active_index").on(t.isActive)
}));

export const topics = sqliteTable("topics", {
  id: text("id").primaryKey().notNull(),
  packageId: text("package_id").notNull().references(() => contentPackages.id, { onDelete: "cascade" }),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  position: integer("position").notNull(),
  finalExamWeight: integer("final_exam_weight").notNull()
}, (t) => ({
  packageExternalIndex: index("topics_package_external_id_index").on(t.packageId, t.externalId),
  positionIndex: index("topics_package_position_index").on(t.packageId, t.position)
}));

export const segments = sqliteTable("segments", {
  id: text("id").primaryKey().notNull(),
  topicId: text("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  externalId: text("external_id").notNull(),
  title: text("title").notNull(),
  position: integer("position").notNull(),
  estimatedStudyMinutes: integer("estimated_study_minutes").notNull()
}, (t) => ({
  topicExternalUnique: uniqueIndex("segments_topic_external_id_unique").on(t.topicId, t.externalId),
  positionIndex: index("segments_topic_position_index").on(t.topicId, t.position)
}));

export const slides = sqliteTable("slides", {
  id: text("id").primaryKey().notNull(),
  segmentId: text("segment_id").notNull().references(() => segments.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  bullets: text("bullets").notNull(),
  citations: text("citations").notNull(),
  position: integer("position").notNull()
}, (t) => ({ segmentPositionUnique: uniqueIndex("slides_segment_position_unique").on(t.segmentId, t.position) }));

export const questions = sqliteTable("questions", {
  id: text("id").primaryKey().notNull(),
  packageId: text("package_id").notNull().references(() => contentPackages.id, { onDelete: "cascade" }),
  topicId: text("topic_id").references(() => topics.id, { onDelete: "cascade" }),
  segmentId: text("segment_id").references(() => segments.id, { onDelete: "cascade" }),
  externalId: text("external_id").notNull(),
  prompt: text("prompt").notNull(),
  questionType: text("question_type").notNull(),
  options: text("options").notNull(),
  correctAnswers: text("correct_answers").notNull(),
  explanation: text("explanation").notNull(),
  citations: text("citations").notNull()
}, (t) => ({
  packageExternalUnique: uniqueIndex("questions_package_external_id_unique").on(t.packageId, t.externalId),
  topicIndex: index("questions_topic_index").on(t.topicId),
  segmentIndex: index("questions_segment_index").on(t.segmentId)
}));

export const questionCollections = sqliteTable("question_collections", {
  id: text("id").primaryKey().notNull(),
  packageId: text("package_id").notNull().references(() => contentPackages.id, { onDelete: "cascade" }),
  topicId: text("topic_id").references(() => topics.id, { onDelete: "cascade" }),
  segmentId: text("segment_id").references(() => segments.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  passThresholdPercent: integer("pass_threshold_percent").notNull()
}, (t) => ({
  scopeKindUnique: uniqueIndex("question_collections_scope_kind_unique").on(t.packageId, t.topicId, t.segmentId, t.kind)
}));

export const questionCollectionItems = sqliteTable("question_collection_items", {
  collectionId: text("collection_id").notNull().references(() => questionCollections.id, { onDelete: "cascade" }),
  questionId: text("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
  position: integer("position").notNull()
}, (t) => ({
  pk: primaryKey({ columns: [t.collectionId, t.questionId], name: "question_collection_items_primary_key" })
}));

export const oralProfessors = sqliteTable("oral_professors", {
  id: text("id").primaryKey().notNull(),
  packageId: text("package_id").notNull().references(() => contentPackages.id, { onDelete: "cascade" }),
  topicId: text("topic_id").notNull().references(() => topics.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  personalityDescription: text("personality_description").notNull(),
  toneDirective: text("tone_directive").notNull()
}, (t) => ({ topicUnique: uniqueIndex("oral_professors_topic_unique").on(t.topicId) }));

export const oralQuestions = sqliteTable("oral_questions", {
  id: text("id").primaryKey().notNull(),
  professorId: text("professor_id").notNull().references(() => oralProfessors.id, { onDelete: "cascade" }),
  externalId: text("external_id").notNull(),
  prompt: text("prompt").notNull(),
  modelAnswerKeyPoints: text("model_answer_key_points").notNull(),
  citations: text("citations").notNull(),
  position: integer("position").notNull()
}, (t) => ({ professorExternalUnique: uniqueIndex("oral_questions_professor_external_id_unique").on(t.professorId, t.externalId) }));

export const userProgress = sqliteTable("user_progress", {
  id: text("id").primaryKey().notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  contentKey: text("content_key").notNull(),
  status: text("status").notNull().default("available"),
  bestPercent: integer("best_percent").notNull().default(0),
  passedAt: text("passed_at"),
  updatedAt: text("updated_at").notNull().default("CURRENT_TIMESTAMP")
}, (t) => ({ userContentUnique: uniqueIndex("user_progress_user_content_unique").on(t.userId, t.contentKey) }));

export const assessmentAttempts = sqliteTable("assessment_attempts", {
  id: text("id").primaryKey().notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  kind: text("kind").notNull(),
  scopeExternalId: text("scope_external_id").notNull(),
  status: text("status").notNull().default("in_progress"),
  questionExternalIds: text("question_external_ids").notNull(),
  answers: text("answers").notNull(),
  correctCount: integer("correct_count"),
  totalQuestions: integer("total_questions").notNull(),
  percent: integer("percent"),
  passed: integer("passed", { mode: "boolean" }),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  submittedAt: text("submitted_at")
}, (t) => ({ userScopeIndex: index("assessment_attempts_user_scope_index").on(t.userId, t.scopeExternalId) }));

export const assessmentAttemptAnswers = sqliteTable("assessment_attempt_answers", {
  id: text("id").primaryKey().notNull(),
  attemptId: text("attempt_id").notNull().references(() => assessmentAttempts.id, { onDelete: "cascade" }),
  questionExternalId: text("question_external_id").notNull(),
  selectedOptionIds: text("selected_option_ids").notNull(),
  isCorrect: integer("is_correct", { mode: "boolean" }).notNull(),
  explanationSnapshot: text("explanation_snapshot").notNull(),
  citationsSnapshot: text("citations_snapshot").notNull()
}, (t) => ({ attemptQuestionUnique: uniqueIndex("assessment_attempt_answers_attempt_question_unique").on(t.attemptId, t.questionExternalId) }));

export const oralExamAttempts = sqliteTable("oral_exam_attempts", {
  id: text("id").primaryKey().notNull(),
  userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  topicExternalId: text("topic_external_id").notNull(),
  professorName: text("professor_name").notNull(),
  status: text("status").notNull().default("in_progress"),
  questionExternalIds: text("question_external_ids").notNull(),
  passed: integer("passed", { mode: "boolean" }),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP"),
  completedAt: text("completed_at")
}, (t) => ({ userTopicIndex: index("oral_exam_attempts_user_topic_index").on(t.userId, t.topicExternalId) }));

export const oralAnswerResults = sqliteTable("oral_answer_results", {
  id: text("id").primaryKey().notNull(),
  oralExamAttemptId: text("oral_exam_attempt_id").notNull().references(() => oralExamAttempts.id, { onDelete: "cascade" }),
  questionExternalId: text("question_external_id").notNull(),
  answer: text("answer").notNull(),
  isCorrect: integer("is_correct", { mode: "boolean" }),
  score: integer("score"),
  missingKeyPoints: text("missing_key_points"),
  feedback: text("feedback"),
  professorTone: text("professor_tone"),
  gradingError: text("grading_error"),
  createdAt: text("created_at").notNull().default("CURRENT_TIMESTAMP")
}, (t) => ({ attemptQuestionUnique: uniqueIndex("oral_answer_results_attempt_question_unique").on(t.oralExamAttemptId, t.questionExternalId) }));
