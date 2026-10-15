import { describe, expect, it } from "vitest";
import { signConfirmToken, verifyConfirmToken } from "@/lib/confirm-token";

const secret = "s".repeat(32);

describe("confirm token", () => {
  it("round-trips for the same order and quote", () => {
    const t = signConfirmToken("ML-0001", "$45.000", secret);
    expect(verifyConfirmToken(t, () => "$45.000", secret)).toBe("ML-0001");
  });
  it("is URL-safe", () => {
    expect(signConfirmToken("ML-0001", "x", secret)).toMatch(/^ML-\d+\.[A-Za-z0-9_-]+$/);
  });
  it("is invalidated when the quote text changes", () => {
    const t = signConfirmToken("ML-0001", "$45.000", secret);
    expect(verifyConfirmToken(t, () => "$50.000", secret)).toBeNull();
  });
  it("rejects another secret, tampering and garbage", () => {
    const t = signConfirmToken("ML-0001", "q", secret);
    expect(verifyConfirmToken(t, () => "q", "z".repeat(32))).toBeNull();
    expect(verifyConfirmToken(t.replace("ML-0001", "ML-0002"), () => "q", secret)).toBeNull();
    expect(verifyConfirmToken("garbage", () => "q", secret)).toBeNull();
    expect(verifyConfirmToken("", () => "q", secret)).toBeNull();
  });
  it("returns null when the order has no quote", () => {
    const t = signConfirmToken("ML-0001", "q", secret);
    expect(verifyConfirmToken(t, () => undefined, secret)).toBeNull();
  });
});
