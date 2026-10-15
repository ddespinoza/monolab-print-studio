import type { BufferGeometry, Group } from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { PLYLoader } from "three/addons/loaders/PLYLoader.js";
import { STLLoader } from "three/addons/loaders/STLLoader.js";

type Format = "stl" | "obj" | "ply";

function formatOf(name: string): Format {
  const ext = /\.(stl|obj|ply)$/i.exec(name)?.[1]?.toLowerCase();
  if (!ext) throw new Error("Formato no compatible. Use archivos STL, OBJ o PLY.");
  return ext as Format;
}

function positionsOf(geometry: BufferGeometry): Float32Array {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  return Float32Array.from(flat.getAttribute("position").array);
}

function concat(parts: Float32Array[]): Float32Array {
  const out = new Float32Array(parts.reduce((n, p) => n + p.length, 0));
  let offset = 0;
  for (const p of parts) {
    out.set(p, offset);
    offset += p.length;
  }
  return out;
}

function objPositions(group: Group): Float32Array {
  const parts: Float32Array[] = [];
  group.traverse((child) => {
    const geometry = (child as { geometry?: BufferGeometry }).geometry;
    if (geometry) parts.push(positionsOf(geometry));
  });
  return concat(parts);
}

/**
 * Triangle positions (9 numbers per triangle, non-indexed) from an STL, OBJ or PLY file.
 * Runs in the browser; the result feeds `computeMetrics` and the viewer.
 */
export function parseModel(name: string, data: ArrayBuffer): Float32Array {
  const format = formatOf(name);
  const positions =
    format === "stl"
      ? positionsOf(new STLLoader().parse(data))
      : format === "ply"
        ? positionsOf(new PLYLoader().parse(data))
        : objPositions(new OBJLoader().parse(new TextDecoder().decode(data)));
  if (positions.length === 0) throw new Error("El archivo no contiene un modelo 3D.");
  return positions;
}
