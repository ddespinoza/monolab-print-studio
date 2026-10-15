export type Axis = "x" | "y" | "z";

/** Rotates triangle positions 90 degrees about an axis (right-handed). Returns a new array. */
export function rotate90(positions: Float32Array, axis: Axis): Float32Array {
  const out = new Float32Array(positions.length);
  for (let i = 0; i < positions.length; i += 3) {
    const x = positions[i];
    const y = positions[i + 1];
    const z = positions[i + 2];
    if (axis === "x") out.set([x, -z, y], i);
    else if (axis === "y") out.set([z, y, -x], i);
    else out.set([-y, x, z], i);
  }
  return out;
}
