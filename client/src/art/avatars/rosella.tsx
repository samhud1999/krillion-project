import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function Rosella({ base }: AnimalProps) {
  const line = '#6f1522';
  return (
    <g>
      {/* body */}
      <ellipse cx={46} cy={88} rx={28} ry={24} fill={base} stroke={line} strokeWidth={OUTLINE} />
      {/* black wing with blue edge */}
      <ellipse cx={28} cy={86} rx={10} ry={18} fill="#1f2328" />
      <ellipse cx={22} cy={86} rx={4.5} ry={15} fill="#3c63b8" />
      {/* head */}
      <circle cx={54} cy={48} r={23} fill={base} stroke={line} strokeWidth={OUTLINE} />
      {/* blue cheek */}
      <ellipse cx={64} cy={58} rx={9.5} ry={7.5} fill="#3c63b8" stroke="#2a4a8e" strokeWidth={1.4} />
      {/* beak */}
      <path d="M72 46 C82 44 85 54 80 60 C76 57 73 53 70 50 Z" fill="#e8e1d2" stroke="#a89f8c" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M70 52 C74 56 77 58 79 60 C75 60 71 58 69 54 Z" fill="#c9bfae" />
      <Eye cx={62} cy={43} />
      <Shine d="M38 36 Q46 28 58 30" />
    </g>
  );
}
