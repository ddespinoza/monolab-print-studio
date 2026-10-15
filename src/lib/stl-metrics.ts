export interface StlMetrics {
  /** Bounding box extents in mm (model units are assumed to be millimetres). */
  size: { x: number; y: number; z: number };
  volumeCm3: number;
}

const round1 = (n: number): number => Math.round(n * 10) / 10;

/**
 * Metrics from non-indexed triangle positions (x,y,z per vertex, 9 numbers per triangle).
 * Trust boundary: these run in the browser and are submitted by the client; the server never re-parses files.
 */
export function computeMetrics(positions: ArrayLike<number>): StlMetrics {
  if (positions.length === 0 || positions.length % 9 !== 0) {
    throw new Error("Invalid STL geometry: expected triangles of 9 numbers each");
  }
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  let signed = 0;
  for (let i = 0; i < positions.length; i += 9) {
    for (let v = 0; v < 3; v++) {
      for (let k = 0; k < 3; k++) {
        const c = positions[i + v * 3 + k];
        if (c < min[k]) min[k] = c;
        if (c > max[k]) max[k] = c;
      }
    }
    const [ax, ay, az, bx, by, bz, cx, cy, cz] = [
      positions[i],
      positions[i + 1],
      positions[i + 2],
      positions[i + 3],
      positions[i + 4],
      positions[i + 5],
      positions[i + 6],
      positions[i + 7],
      positions[i + 8],
    ];
    // Signed tetrahedron volume against the origin: a . (b x c) / 6
    signed += (ax * (by * cz - bz * cy) - ay * (bx * cz - bz * cx) + az * (bx * cy - by * cx)) / 6;
  }
  return {
    size: { x: round1(max[0] - min[0]), y: round1(max[1] - min[1]), z: round1(max[2] - min[2]) },
    volumeCm3: round1(Math.abs(signed) / 1000),
  };
}

export function totalVolumeCm3(volumes: readonly number[]): number {
  return round1(volumes.reduce((sum, v) => sum + v, 0));
}
