import type { StlMetrics } from "@/lib/stl-metrics";

type Size = StlMetrics["size"];

/** Anycubic Photon Mono 4 Ultra build volume in mm: X, Y and Z (up), as exported in the STL. */
export const BUILD_VOLUME: Size = { x: 153.4, y: 77, z: 165 };

const round1 = (n: number): number => Math.round(n * 10) / 10;

export function exceedsBuild(size: Size): boolean {
  return size.x > BUILD_VOLUME.x || size.y > BUILD_VOLUME.y || size.z > BUILD_VOLUME.z;
}

/** Largest whole-percent scale (5 to 100) that keeps the model within 98 % of the build volume. */
export function autoFitPercent(size: Size): number {
  const factor = Math.min(
    (BUILD_VOLUME.x * 0.98) / size.x,
    (BUILD_VOLUME.y * 0.98) / size.y,
    (BUILD_VOLUME.z * 0.98) / size.z,
    1,
  );
  return Math.max(5, Math.floor(factor * 100 + 1e-9));
}

/** Metrics after the customer's uniform scale: size scales linearly, volume cubically. */
export function scaledMetrics(base: StlMetrics, percent: number): StlMetrics {
  const f = percent / 100;
  return {
    size: { x: round1(base.size.x * f), y: round1(base.size.y * f), z: round1(base.size.z * f) },
    volumeCm3: round1(base.volumeCm3 * f ** 3),
  };
}
