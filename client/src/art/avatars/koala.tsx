import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function Koala({ base }: AnimalProps) {
  const line = '#5c5649';
  return (
    <g>
      {/* ears */}
      <circle cx={19} cy={44} r={17} fill={base} stroke={line} strokeWidth={OUTLINE} />
      <circle cx={81} cy={44} r={17} fill={base} stroke={line} strokeWidth={OUTLINE} />
      <circle cx={20} cy={45} r={9.5} fill="#d9a7a0" />
      <circle cx={80} cy={45} r={9.5} fill="#d9a7a0" />
      {/* head */}
      <ellipse cx={50} cy={60} rx={31} ry={29} fill={base} stroke={line} strokeWidth={OUTLINE} />
      {/* cheek fluff */}
      <ellipse cx={30} cy={70} rx={11} ry={8} fill="#d9d4c7" opacity={0.85} />
      <ellipse cx={70} cy={70} rx={11} ry={8} fill="#d9d4c7" opacity={0.85} />
      {/* nose */}
      <ellipse cx={50} cy={68} rx={8.5} ry={12.5} fill="#2b2a28" />
      <ellipse cx={47} cy={61} rx={2.4} ry={3.2} fill="#ffffff" opacity={0.35} />
      <Eye cx={36} cy={54} />
      <Eye cx={64} cy={54} />
      <Shine d="M30 38 Q42 30 56 33" />
    </g>
  );
}
