import { describe, expect, it } from "vitest";
import { clientIp, createLimiter } from "@/lib/rate-limit";

describe("createLimiter", () => {
  it("allows up to max per window per key, then blocks", () => {
    const t = 0;
    const l = createLimiter({ max: 3, windowMs: 1000, now: () => t });
    expect([1, 2, 3, 4].map(() => l.allow("a"))).toEqual([true, true, true, false]);
    expect(l.allow("b")).toBe(true);
  });
  it("resets after the window", () => {
    let t = 0;
    const l = createLimiter({ max: 1, windowMs: 1000, now: () => t });
    expect(l.allow("a")).toBe(true);
    expect(l.allow("a")).toBe(false);
    t = 1001;
    expect(l.allow("a")).toBe(true);
  });
  it("forgets expired keys so memory stays bounded", () => {
    let t = 0;
    const l = createLimiter({ max: 1, windowMs: 1000, now: () => t });
    for (let i = 0; i < 50; i++) l.allow(`k${i}`);
    t = 5000;
    l.allow("fresh");
    expect(l.size()).toBe(1);
  });
});

describe("clientIp", () => {
  const h = (o: Record<string, string>) => new Headers(o);
  it("prefers CF-Connecting-IP behind Cloudflare", () => {
    expect(clientIp(h({ "cf-connecting-ip": "1.2.3.4", "x-forwarded-for": "9.9.9.9" }))).toBe(
      "1.2.3.4",
    );
  });
  it("falls back to the first X-Forwarded-For entry, then to unknown", () => {
    expect(clientIp(h({ "x-forwarded-for": "5.6.7.8, 10.0.0.1" }))).toBe("5.6.7.8");
    expect(clientIp(h({}))).toBe("unknown");
  });
});
