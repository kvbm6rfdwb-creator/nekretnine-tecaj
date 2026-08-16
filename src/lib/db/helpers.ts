export function serializeJson(value: unknown): string {
  return JSON.stringify(value);
}

export function deserializeJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID()}`;
}
