import type { MultipleChoiceQuestion } from "@/lib/content/schema";

function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

function uniqueById<T extends { id: string }>(items: readonly T[]): T[] {
  const ids = new Set<string>();
  return items.filter((item) => { if (ids.has(item.id)) return false; ids.add(item.id); return true; });
}

export function chooseQuestions<T extends { id: string }>(
  pool: readonly T[],
  count: number,
  options: { excludedQuestionIds?: readonly string[]; recentlyMissedQuestionIds?: readonly string[]; random?: () => number } = {}
): T[] {
  if (count <= 0) return [];
  const random = options.random ?? Math.random;
  const uniquePool = uniqueById(pool);
  const excluded = new Set(options.excludedQuestionIds ?? []);
  const recentlyMissed = new Set(options.recentlyMissedQuestionIds ?? []);
  const available = uniquePool.filter((q) => !excluded.has(q.id));
  const preferred = available.filter((q) => !recentlyMissed.has(q.id));
  const fallback = available.filter((q) => recentlyMissed.has(q.id));
  const selected = [...shuffle(preferred, random)];
  if (selected.length < count) selected.push(...shuffle(fallback, random));
  return selected.slice(0, Math.min(count, available.length));
}

export function chooseFinalExamQuestions(
  poolsByTopic: ReadonlyArray<readonly MultipleChoiceQuestion[]>,
  questionsPerTopic: number,
  options: { previousQuestionIds?: readonly string[]; random?: () => number } = {}
): MultipleChoiceQuestion[] {
  const previousQuestionIds = options.previousQuestionIds ?? [];
  const random = options.random ?? Math.random;
  return poolsByTopic.flatMap((pool) => chooseQuestions(pool, questionsPerTopic, { excludedQuestionIds: previousQuestionIds, random }));
}

export function answersMatchExactly(selectedAnswerIds: readonly string[], correctAnswerIds: readonly string[]): boolean {
  if (selectedAnswerIds.length !== correctAnswerIds.length) return false;
  const selected = new Set(selectedAnswerIds);
  return correctAnswerIds.every((id) => selected.has(id));
}

export function calculatePercent(correctAnswers: number, totalQuestions: number): number {
  if (totalQuestions <= 0) return 0;
  return Math.round((correctAnswers / totalQuestions) * 100);
}

export function passedThreshold(percent: number, thresholdPercent = 80): boolean {
  return percent >= thresholdPercent;
}
