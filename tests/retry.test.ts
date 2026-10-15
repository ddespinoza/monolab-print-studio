import { describe, expect, it, vi } from "vitest";
import { isTransient, withRetry } from "@/lib/retry";

describe("isTransient", () => {
  it.each([
    [{ code: 429 }],
    [{ code: 503 }],
    [{ status: 500 }],
    [{ code: "ECONNRESET" }],
    [{ code: "ETIMEDOUT" }],
  ])("treats %j as transient", (e) => expect(isTransient(e)).toBe(true));
  it.each([[{ code: 400 }], [{ code: 403 }], [{ status: 404 }], [new Error("boom")], [null]])(
    "treats %j as permanent",
    (e) => expect(isTransient(e)).toBe(false),
  );
});

describe("withRetry", () => {
  it("returns on first success without sleeping", async () => {
    const sleep = vi.fn();
    expect(await withRetry(async () => 1, { sleep })).toBe(1);
    expect(sleep).not.toHaveBeenCalled();
  });
  it("retries transient errors with 500ms then 2000ms backoff", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi
      .fn()
      .mockRejectedValueOnce({ code: 503 })
      .mockRejectedValueOnce({ code: 429 })
      .mockResolvedValue("ok");
    expect(await withRetry(fn, { sleep })).toBe("ok");
    expect(sleep.mock.calls).toEqual([[500], [2000]]);
  });
  it("gives up after the delays are used and rethrows", async () => {
    const sleep = vi.fn().mockResolvedValue(undefined);
    const fn = vi.fn().mockRejectedValue({ code: 503 });
    await expect(withRetry(fn, { sleep })).rejects.toEqual({ code: 503 });
    expect(fn).toHaveBeenCalledTimes(3);
  });
  it("does not retry permanent errors", async () => {
    const fn = vi.fn().mockRejectedValue({ code: 403 });
    await expect(withRetry(fn, { sleep: vi.fn() })).rejects.toEqual({ code: 403 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});
