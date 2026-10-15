import { describe, expect, it } from "vitest";
import { computeMetrics } from "@/lib/stl-metrics";
import { parseModel } from "@/lib/model-loader";

/** 12 triangles of an outward-facing 10 mm cube. */
const CUBE_TRIS: number[][][] = (() => {
  const v = [
    [0, 0, 0],
    [10, 0, 0],
    [10, 10, 0],
    [0, 10, 0],
    [0, 0, 10],
    [10, 0, 10],
    [10, 10, 10],
    [0, 10, 10],
  ];
  const quads = [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ];
  return quads.flatMap(([a, b, c, d]) => [
    [v[a], v[b], v[c]],
    [v[a], v[c], v[d]],
  ]);
})();

const asciiStl = (): ArrayBuffer =>
  new TextEncoder().encode(
    "solid cube\n" +
      CUBE_TRIS.map(
        (t) =>
          `facet normal 0 0 0\nouter loop\n${t.map((p) => `vertex ${p.join(" ")}`).join("\n")}\nendloop\nendfacet`,
      ).join("\n") +
      "\nendsolid cube\n",
  ).buffer as ArrayBuffer;

const binaryStl = (): ArrayBuffer => {
  const buf = new ArrayBuffer(84 + 50 * CUBE_TRIS.length);
  const dv = new DataView(buf);
  dv.setUint32(80, CUBE_TRIS.length, true);
  CUBE_TRIS.forEach((t, i) => {
    let o = 84 + 50 * i + 12;
    for (const p of t)
      for (const c of p) {
        dv.setFloat32(o, c, true);
        o += 4;
      }
  });
  return buf;
};

const obj = (): ArrayBuffer => {
  const verts = [
    [0, 0, 0],
    [10, 0, 0],
    [10, 10, 0],
    [0, 10, 0],
    [0, 0, 10],
    [10, 0, 10],
    [10, 10, 10],
    [0, 10, 10],
  ];
  const quads = [
    [1, 4, 3, 2],
    [5, 6, 7, 8],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 4, 8, 7],
    [4, 1, 5, 8],
  ];
  return new TextEncoder().encode(
    verts.map((p) => `v ${p.join(" ")}`).join("\n") +
      "\n" +
      quads.map((q) => `f ${q.join(" ")}`).join("\n") +
      "\n",
  ).buffer as ArrayBuffer;
};

const ply = (): ArrayBuffer => {
  const verts = [
    [0, 0, 0],
    [10, 0, 0],
    [10, 10, 0],
    [0, 10, 0],
    [0, 0, 10],
    [10, 0, 10],
    [10, 10, 10],
    [0, 10, 10],
  ];
  const quads = [
    [0, 3, 2, 1],
    [4, 5, 6, 7],
    [0, 1, 5, 4],
    [1, 2, 6, 5],
    [2, 3, 7, 6],
    [3, 0, 4, 7],
  ];
  return new TextEncoder().encode(
    `ply\nformat ascii 1.0\nelement vertex 8\nproperty float x\nproperty float y\nproperty float z\nelement face 6\nproperty list uchar int vertex_indices\nend_header\n` +
      verts.map((p) => p.join(" ")).join("\n") +
      "\n" +
      quads.map((q) => `4 ${q.join(" ")}`).join("\n") +
      "\n",
  ).buffer as ArrayBuffer;
};

describe("parseModel", () => {
  it.each([
    ["ascii stl", "cube.stl", asciiStl],
    ["binary stl", "cube.STL", binaryStl],
    ["obj with quads", "cube.obj", obj],
    ["ply with quads", "cube.ply", ply],
  ])("reads a 10 mm cube from %s", (_n, name, make) => {
    const m = computeMetrics(parseModel(name, make()));
    expect(m.volumeCm3).toBe(1);
    expect(m.size).toEqual({ x: 10, y: 10, z: 10 });
  });
  it("rejects unsupported extensions", () => {
    expect(() => parseModel("cube.step", asciiStl())).toThrow(/formato/i);
  });
  it("rejects a file with no triangles", () => {
    expect(() =>
      parseModel("empty.obj", new TextEncoder().encode("# nothing\n").buffer as ArrayBuffer),
    ).toThrow();
  });
});
