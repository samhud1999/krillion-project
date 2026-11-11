import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function Possum({ base }: AnimalProps) {
  const line = '#4a413b';
  const cream = '#e8e1d2';
  return (
    <g>
      {/* prehensile tail with white tip */}
      <path d="M68 92 C90 94 98 76 86 66 C78 60 70 68 76 76" fill="none" stroke={line} strokeWidth={11} strokeLinecap="round" />
      <path d="M68 92 C90 94 98 76 86 66 C78 60 70 68 76 76" fill="none" stroke={base} strokeWidth={8} strokeLinecap="round" />
      <path d="M68 92 C76 93 82 92 86 89" fill="none" stroke={cream} strokeWidth={8} strokeLinecap="round" />
      {/* ears */}
      <circle cx={27} cy={36} r={13} fill={base} stroke={line} strokeWidth={OUTLINE} />
      <circle cx={73} cy={36} r={13} fill={base} stroke={line} strokeWidth={OUTLINE} />
      <circle cx={28} cy={37} r={7.5} fill="#c9b8ac" />
      <circle cx={72} cy={37} r={7.5} fill="#c9b8ac" />
      {/* head */}
      <ellipse cx={50} cy={60} rx={26} ry={24} fill={base} stroke={line} strokeWidth={OUTLINE} />
      {/* pale eye patches */}
      <ellipse cx={39} cy={60} rx={7.5} ry={8.5} fill={cream} />
      <ellipse cx={61} cy={60} rx={7.5} ry={8.5} fill={cream} />
      {/* chin */}
      <ellipse cx={50} cy={80} rx={10} ry={5} fill={cream} />
      {/* nose */}
      <ellipse cx={50} cy={72} rx={4.8} ry={3.6} fill="#e8a0a0" stroke="#b86d6d" strokeWidth={1} />
      <Eye cx={40} cy={58} r={4.6} />
      <Eye cx={60} cy={58} r={4.6} />
      <Shine d="M34 44 Q44 36 56 38" />
    </g>
  );
}
