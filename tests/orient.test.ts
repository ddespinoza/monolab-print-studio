import { describe, expect, it } from "vitest";
import { computeMetrics } from "@/lib/stl-metrics";
import { rotate90 } from "@/lib/orient";

/** Box 20 x 10 x 5 mm, outward faces. */
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
  for (const [a, b, c, d] of quads) for (const i of [a, b, c, a, c, d]) out.push(...v[i]);
  return new Float32Array(out);
}

describe("rotate90", () => {
  const base = box(20, 10, 5);
  it("rotating about X swaps the Y and Z extents", () => {
    expect(computeMetrics(rotate90(base, "x")).size).toEqual({ x: 20, y: 5, z: 10 });
  });
  it("rotating about Y swaps the X and Z extents", () => {
    expect(computeMetrics(rotate90(base, "y")).size).toEqual({ x: 5, y: 10, z: 20 });
  });
  it("rotating about Z swaps the X and Y extents", () => {
    expect(computeMetrics(rotate90(base, "z")).size).toEqual({ x: 10, y: 20, z: 5 });
  });
  it("keeps the volume and a positive orientation", () => {
    for (const axis of ["x", "y", "z"] as const) {
      expect(computeMetrics(rotate90(base, axis)).volumeCm3).toBe(computeMetrics(base).volumeCm3);
    }
  });
  it("four turns return the original coordinates and the input is not mutated", () => {
    const copy = Float32Array.from(base);
    let p = base;
    for (let i = 0; i < 4; i++) p = rotate90(p, "x");
    expect(Array.from(p).map((n) => Math.abs(n) + 0)).toEqual(Array.from(base));
    expect(Array.from(base)).toEqual(Array.from(copy));
  });
});
