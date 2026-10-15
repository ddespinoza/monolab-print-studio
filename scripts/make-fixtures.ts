/** Generates the STL fixtures used by the smoke test. Never committed as binary blobs (tests/fixtures is gitignored). */
import { mkdirSync, writeFileSync } from "node:fs";

function boxTriangles(x: number, y: number, z: number): number[][][] {
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
  return quads.flatMap(([a, b, c, d]) => [
    [v[a], v[b], v[c]],
    [v[a], v[c], v[d]],
  ]);
}

function binaryStl(tris: number[][][]): Buffer {
  const buf = Buffer.alloc(84 + 50 * tris.length);
  buf.write("monolab fixture", 0);
  buf.writeUInt32LE(tris.length, 80);
  tris.forEach((t, i) => {
    let o = 84 + 50 * i + 12;
    for (const p of t)
      for (const c of p) {
        buf.writeFloatLE(c, o);
        o += 4;
      }
  });
  return buf;
}

mkdirSync("tests/fixtures", { recursive: true });
writeFileSync("tests/fixtures/cube-10.stl", binaryStl(boxTriangles(10, 10, 10)));
writeFileSync("tests/fixtures/box-20x10x5.stl", binaryStl(boxTriangles(20, 10, 5)));
writeFileSync("tests/fixtures/oversize.stl", binaryStl(boxTriangles(100, 154, 100)));
writeFileSync("tests/fixtures/broken.stl", "not a model");
console.log("fixtures written to tests/fixtures");
