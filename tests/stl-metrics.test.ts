import { describe, expect, it } from "vitest";
import { computeMetrics, totalVolumeCm3 } from "@/lib/stl-metrics";

/** Non-indexed triangle positions for an axis-aligned box from the origin, outward-facing. */
function box(x: number, y: number, z: number): Float32Array {
  const v = [
    [0, 0, 0],
    [x, 0, 0],
    [x, y, 0],
    [0, y, 0],
    [0, 0, z],
    [x, 0, z],
    [x, y, z],
    [0, y, z],
  ];
  const quads = [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ];
  const out: number[] = [];
  for (const [a, b, c, d] of quads) {
    for (const i of [a, b, c, a, c, d]) out.push(...v[i]);
  }
  return new Float32Array(out);
}

describe("computeMetrics", () => {
  it("10 mm cube is 1.0 cm3", () => {
    const m = computeMetrics(box(10, 10, 10));
    expect(m.volumeCm3).toBe(1);
    expect(m.size).toEqual({ x: 10, y: 10, z: 10 });
  });
  it("20x10x5 mm box is 1.0 cm3", () => {
    const m = computeMetrics(box(20, 10, 5));
    expect(m.volumeCm3).toBe(1);
    expect(m.size).toEqual({ x: 20, y: 10, z: 5 });
  });
  it("returns an absolute volume for inverted winding", () => {
    const flipped = box(10, 10, 10).slice();
    for (let i = 0; i < flipped.length; i += 9) {
      for (let k = 0; k < 3; k++) {
        const tmp = flipped[i + 3 + k];
        flipped[i + 3 + k] = flipped[i + 6 + k];
        flipped[i + 6 + k] = tmp;
      }
    }
    expect(computeMetrics(flipped).volumeCm3).toBe(1);
  });
  it("rounds volume to 1 decimal and size to 1 decimal", () => {
    expect(computeMetrics(box(12.34, 10, 10)).volumeCm3).toBe(1.2);
  });
  it("rejects empty or malformed geometry", () => {
    expect(() => computeMetrics(new Float32Array(0))).toThrow();
    expect(() => computeMetrics(new Float32Array(8))).toThrow();
  });
});

describe("totalVolumeCm3", () => {
  it("sums to 1 decimal", () => {
    expect(totalVolumeCm3([96.3, 12.1])).toBe(108.4);
    expect(totalVolumeCm3([0.1, 0.2])).toBe(0.3);
    expect(totalVolumeCm3([])).toBe(0);
  });
});
