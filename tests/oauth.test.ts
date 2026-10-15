import { describe, expect, it } from "vitest";
import { extractAuthCode } from "@/lib/oauth";

describe("extractAuthCode", () => {
  it("reads the code from the pasted redirect URL", () => {
    expect(extractAuthCode("http://localhost:1/?code=4%2F0AbC&scope=drive.file")).toBe("4/0AbC");
  });
  it("accepts a bare code", () => {
    expect(extractAuthCode("  4/0AbC  ")).toBe("4/0AbC");
  });
  it("rejects an error redirect and empty input", () => {
    expect(() => extractAuthCode("http://localhost:1/?error=access_denied")).toThrow(
      /access_denied/,
    );
    expect(() => extractAuthCode("")).toThrow();
  });
});
