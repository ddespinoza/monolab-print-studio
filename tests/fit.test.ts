import { describe, expect, it } from "vitest";
import { BUILD_VOLUME, autoFitPercent, exceedsBuild, scaledMetrics } from "@/lib/fit";

describe("BUILD_VOLUME", () => {
  it("is the Photon Mono 4 Ultra volume (X, Y, Z up)", () => {
    expect(BUILD_VOLUME).toEqual({ x: 153.4, y: 77, z: 165 });
  });
});

describe("exceedsBuild", () => {
  it("is false inside and on the limit, true beyond on any axis", () => {
    expect(exceedsBuild({ x: 153.4, y: 77, z: 165 })).toBe(false);
    expect(exceedsBuild({ x: 153.5, y: 10, z: 10 })).toBe(true);
    expect(exceedsBuild({ x: 10, y: 77.1, z: 10 })).toBe(true);
    expect(exceedsBuild({ x: 10, y: 10, z: 166 })).toBe(true);
  });
});

describe("autoFitPercent", () => {
  it("is 100 when the model already fits", () => {
    expect(autoFitPercent({ x: 50, y: 50, z: 50 })).toBe(100);
  });
  it("shrinks to 98 % of the limiting axis, rounded down to a whole percent", () => {
    // Y is the limiting axis: 77 * 0.98 / 154 = 0.49
    expect(autoFitPercent({ x: 100, y: 154, z: 100 })).toBe(49);
  });
  it("never goes below 5 %", () => {
    expect(autoFitPercent({ x: 100000, y: 1, z: 1 })).toBe(5);
  });
});

describe("scaledMetrics", () => {
  it("scales size linearly and volume cubically", () => {
    expect(scaledMetrics({ size: { x: 100, y: 50, z: 20 }, volumeCm3: 10 }, 50)).toEqual({
      size: { x: 50, y: 25, z: 10 },
      volumeCm3: 1.3,
    });
  });
  it("is identity at 100 %", () => {
    expect(scaledMetrics({ size: { x: 1.23, y: 4, z: 5 }, volumeCm3: 2.2 }, 100)).toEqual({
      size: { x: 1.2, y: 4, z: 5 },
      volumeCm3: 2.2,
    });
  });
});
