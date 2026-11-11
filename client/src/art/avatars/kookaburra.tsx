import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function Kookaburra(_: AnimalProps) {
  const brown = '#7a5c3f';
  const brownLine = '#4a3524';
  const cream = '#efe6d2';
  const creamLine = '#8a7b63';
  return (
    <g>
      {/* body */}
      <ellipse cx={48} cy={82} rx={27} ry={27} fill={brown} stroke={brownLine} strokeWidth={OUTLINE} />
      {/* blue wing flash */}
      <ellipse cx={32} cy={84} rx={9} ry={15} fill="#4f8fc9" stroke="#2f5f8c" strokeWidth={1.5} />
      <ellipse cx={32} cy={80} rx={4} ry={8} fill="#8cc0ea" opacity={0.7} />
      {/* cream chest */}
      <ellipse cx={56} cy={82} rx={14} ry={18} fill={cream} opacity={0.9} />
      {/* head */}
      <circle cx={52} cy={44} r={23} fill={cream} stroke={creamLine} strokeWidth={OUTLINE} />
      {/* crown */}
      <path d="M31 38 C36 26 50 20 66 24 C72 26 74 32 75 38 C66 32 44 30 31 38 Z" fill="#8a7b63" />
      {/* eye stripe */}
      <path d="M30 44 C40 38 64 38 74 46 C64 46 42 48 30 44 Z" fill="#5a4631" />
      {/* beak */}
      <path d="M70 43 L98 50 L70 56 Z" fill="#3b3a37" stroke="#1f1e1c" strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M70 52 L94 50.5 L70 56 Z" fill="#8a857b" />
      {/* eye on a pale ring so it reads on the stripe */}
      <circle cx={58} cy={42} r={5.6} fill={cream} />
      <Eye cx={58} cy={42} />
      <Shine d="M36 30 Q44 24 54 25" />
    </g>
  );
}
