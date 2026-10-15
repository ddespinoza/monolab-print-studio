export interface RetryOptions {
  /** Backoff before each retry. Default: two retries after 500 ms and 2 s. */
  delaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
}

const TRANSIENT_CODES = new Set([
  "ECONNRESET",
  "ETIMEDOUT",
  "ECONNREFUSED",
  "EAI_AGAIN",
  "ESOCKET",
  "ECONNECTION",
]);

/** Transient = HTTP 429/5xx or a network-level error. Everything else is permanent. */
export function isTransient(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const { code, status } = error as { code?: unknown; status?: unknown };
  const http = typeof code === "number" ? code : typeof status === "number" ? status : undefined;
  if (http !== undefined) return http === 429 || http >= 500;
  return typeof code === "string" && TRANSIENT_CODES.has(code);
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const { delaysMs = [500, 2000], sleep = defaultSleep } = options;
  for (let attempt = 0; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= delaysMs.length || !isTransient(error)) throw error;
      await sleep(delaysMs[attempt]);
    }
  }
}
