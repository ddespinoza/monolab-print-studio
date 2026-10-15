/**
 * Subtle hexagon mesh for dark brand bands. Purely decorative (aria-hidden, no pointer events).
 * The parent must be `relative isolate overflow-hidden`; the mesh fades out toward the left via CSS.
 * Drawn in real pixels on one right-anchored canvas, so cell size is the same on every screen width and the
 * faint filled cells sit exactly on the mesh lattice.
 */
const W = 48.497;
const CELL = "M24.249 0 L48.497 14 L48.497 42 L24.249 56 L0 42 L0 14 Z";

/** [column, row, offset row?, opacity]: a cell's top-left corner on the lattice (offset rows shift by half a cell). */
const FILLED: [number, number, boolean, number][] = [
  [24, 1, false, 0.1],
  [24, 1, true, 0.16],
  [26, 0, true, 0.07],
  [27, 2, false, 0.12],
  [25, 2, true, 0.18],
  [23, 3, true, 0.08],
  [26, 3, false, 0.06],
];

export function HexArt({ variant = "hero", id }: { variant?: "hero" | "band"; id: string }) {
  const band = variant === "band";
  return (
    <div className={`hex-art ${band ? "hex-band" : ""}`} aria-hidden="true">
      <svg className="absolute right-0 top-0 block h-full w-[1600px] max-w-none" focusable="false">
        <defs>
          <path id={`${id}-cell`} d={CELL} />
          <pattern id={`${id}-mesh`} width={W} height="84" patternUnits="userSpaceOnUse">
            <g fill="none" stroke="var(--hex-line)" strokeWidth="1" strokeLinejoin="round">
              <use href={`#${id}-cell`} />
              <use href={`#${id}-cell`} x={-W / 2} y="42" />
              <use href={`#${id}-cell`} x={W / 2} y="42" />
            </g>
          </pattern>
          <radialGradient id={`${id}-glow`} cx="85%" cy="40%" r="40%">
            <stop offset="0" stopColor="var(--hex-glow)" stopOpacity="0.3" />
            <stop offset="1" stopColor="var(--hex-glow)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill={`url(#${id}-glow)`} />
        <rect width="100%" height="100%" fill={`url(#${id}-mesh)`} opacity="0.6" />
        {!band && (
          <g fill="var(--hex-glow)">
            {FILLED.map(([col, row, odd, o]) => (
              <use
                key={`${col}-${row}-${odd}`}
                href={`#${id}-cell`}
                x={col * W + (odd ? W / 2 : 0)}
                y={row * 84 + (odd ? 42 : 0)}
                fillOpacity={o}
              />
            ))}
          </g>
        )}
      </svg>
    </div>
  );
}
