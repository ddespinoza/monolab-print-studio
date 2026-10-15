export interface Limiter {
  /** True when the key is still under its quota for the current window (and counts this call). */
  allow(key: string): boolean;
  size(): number;
}

/** Fixed-window in-process limiter. The app runs as a single instance, so memory is enough. */
export function createLimiter(opts: {
  max: number;
  windowMs: number;
  now?: () => number;
}): Limiter {
  const { max, windowMs, now = Date.now } = opts;
  const hits = new Map<string, { count: number; resetAt: number }>();
  return {
    allow(key) {
      const t = now();
      for (const [k, v] of hits) if (v.resetAt <= t) hits.delete(k);
      const entry = hits.get(key);
      if (!entry) {
        hits.set(key, { count: 1, resetAt: t + windowMs });
        return true;
      }
      entry.count++;
      return entry.count <= max;
    },
    size: () => hits.size,
  };
}

/** Behind Cloudflare every request arrives from a Cloudflare IP, so key on CF-Connecting-IP when present. */
export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    "unknown"
  );
}
