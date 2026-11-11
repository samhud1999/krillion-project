import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function Magpie({ base }: AnimalProps) {
  const line = '#000000';
  const white = '#f4f1e8';
  return (
    <g>
      {/* body */}
      <ellipse cx={44} cy={84} rx={32} ry={28} fill={base} stroke={line} strokeWidth={OUTLINE} />
      {/* white shoulder */}
      <path d="M22 70 C30 60 46 60 58 70 C52 80 34 84 22 78 Z" fill={white} />
      {/* head */}
      <circle cx={54} cy={44} r={23} fill={base} stroke={line} strokeWidth={OUTLINE} />
      {/* white nape */}
      <path d="M46 22 C58 20 72 28 77 42 C70 38 60 36 50 40 Z" fill={white} />
      {/* beak */}
      <path d="M72 42 L95 48 L72 53 Z" fill="#b7c0c8" stroke="#6f7a84" strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M88 46.4 L95 48 L88 50 Z" fill="#2a2d31" />
      <path d="M72 48 L91 48.6 L72 53 Z" fill="#8f9aa3" />
      {/* eye: pale ring, red-brown iris */}
      <circle cx={60} cy={40} r={5.4} fill="#9aa3ab" />
      <Eye cx={60} cy={40} iris="#7a2a1f" />
      <Shine d="M38 30 Q44 24 52 24" opacity={0.3} />
    </g>
  );
}
