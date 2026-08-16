type RateLimitEntry = { timestamps: number[] };
const bucket = new Map<string, RateLimitEntry>();

export class RateLimitExceededError extends Error {
  readonly retryable = true;
  constructor() { super("Trenutačno je dosegnut broj dopuštenih ocjenjivanja. Pričekajte kratko i pokušajte ponovno."); this.name = "RateLimitExceededError"; }
}

export function enforceRateLimit(key: string, limit: number, intervalMs = 60_000) {
  const now = Date.now();
  const entry = bucket.get(key) ?? { timestamps: [] };
  entry.timestamps = entry.timestamps.filter((t) => now - t < intervalMs);
  if (entry.timestamps.length >= limit) { bucket.set(key, entry); throw new RateLimitExceededError(); }
  entry.timestamps.push(now);
  bucket.set(key, entry);
}
