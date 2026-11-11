/** Shared building blocks so all twenty animals have the same eye and line weight. */

export const OUTLINE = 2;

export function Eye({ cx, cy, r = 3.6, iris = '#1a1a1a' }: { cx: number; cy: number; r?: number; iris?: string }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={r} fill={iris} />
      <circle cx={cx - r * 0.33} cy={cy - r * 0.33} r={r * 0.34} fill="#ffffff" />
    </g>
  );
}

/** A soft rim highlight: a short arc of white at low opacity. */
export function Shine({ d, width = 3, opacity = 0.45 }: { d: string; width?: number; opacity?: number }) {
  return <path d={d} fill="none" stroke="#ffffff" strokeWidth={width} strokeLinecap="round" opacity={opacity} />;
}

export interface AnimalProps {
  /** base colour from theme AVATARS */
  base: string;
}
