import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function HoodedPlover({ base }: AnimalProps) {
  const white = '#f4f1e8';
  const line = '#a89f8c';
  return (
    <g>
      {/* legs */}
      <path d="M46 80 L44 98 M56 80 L58 98 M40 98 L48 98 M54 98 L62 98" stroke="#e8a160" strokeWidth={2.6} strokeLinecap="round" />
      {/* tail */}
      <path d="M26 66 L10 60 L22 72 Z" fill={base} stroke={line} strokeWidth={1.6} strokeLinejoin="round" />
      {/* body */}
      <ellipse cx={50} cy={68} rx={25} ry={18} fill={white} stroke={line} strokeWidth={OUTLINE} />
      {/* sandy back */}
      <path d="M26 62 C30 50 44 46 56 48 C68 50 74 58 75 66 C64 60 44 58 26 64 Z" fill={base} />
      {/* white collar */}
      <ellipse cx={48} cy={53} rx={14} ry={4.5} fill={white} />
      {/* hood */}
      <circle cx={47} cy={40} r={14.5} fill="#1f2328" stroke="#000000" strokeWidth={OUTLINE} />
      {/* beak */}
      <path d="M60 38 L78 41 L60 44 Z" fill="#e05a3a" stroke="#9a3a22" strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M72 40 L78 41 L72 42 Z" fill="#1f2328" />
      {/* red eye ring */}
      <circle cx={52} cy={37} r={5.4} fill="#e03a2f" />
      <Eye cx={52} cy={37} r={3.2} />
      <Shine d="M38 32 Q44 28 50 28" width={2} opacity={0.3} />
    </g>
  );
}
