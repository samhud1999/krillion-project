import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function KingParrot({ base }: AnimalProps) {
  const headLine = '#7f1d26';
  return (
    <g>
      {/* green back & wings */}
      <ellipse cx={46} cy={86} rx={28} ry={26} fill="#2f8f3f" stroke="#1e5c2a" strokeWidth={OUTLINE} />
      <ellipse cx={30} cy={86} rx={8} ry={16} fill="#6fb86a" opacity={0.85} />
      {/* red breast */}
      <ellipse cx={58} cy={82} rx={16} ry={20} fill={base} />
      {/* head */}
      <circle cx={54} cy={46} r={23} fill={base} stroke={headLine} strokeWidth={OUTLINE} />
      {/* beak */}
      <path d="M72 44 C84 42 86 54 79 61 C77 56 73 53 70 50 Z" fill="#e06a2e" stroke="#9a4218" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M70 52 C74 56 77 58 78 61 C74 60 70 58 68 54 Z" fill="#b84f1e" />
      {/* eye with yellow ring */}
      <circle cx={62} cy={42} r={5.4} fill="#f2c84b" />
      <Eye cx={62} cy={42} />
      <Shine d="M38 34 Q46 26 58 28" />
    </g>
  );
}
