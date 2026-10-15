import { describe, expect, it } from "vitest";
import { formatTimestamp } from "@/lib/time";

describe("formatTimestamp", () => {
  it("formats as YYYY-MM-DD HH:mm in America/Santiago", () => {
    expect(formatTimestamp(new Date("2025-06-12T18:03:00Z"))).toBe("2025-06-12 14:03");
    expect(formatTimestamp(new Date("2025-01-12T17:03:00Z"))).toBe("2025-01-12 14:03");
  });
});
