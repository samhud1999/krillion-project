import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function Wallaby({ base }: AnimalProps) {
  const line = '#5f4a35';
  return (
    <g>
      {/* ears */}
      <g transform="rotate(-18 36 28)">
        <ellipse cx={36} cy={28} rx={8.5} ry={19} fill={base} stroke={line} strokeWidth={OUTLINE} />
        <ellipse cx={36} cy={30} rx={4} ry={12} fill="#d9a7a0" />
      </g>
      <g transform="rotate(18 64 28)">
        <ellipse cx={64} cy={28} rx={8.5} ry={19} fill={base} stroke={line} strokeWidth={OUTLINE} />
        <ellipse cx={64} cy={30} rx={4} ry={12} fill="#d9a7a0" />
      </g>
      {/* head */}
      <ellipse cx={50} cy={62} rx={25} ry={27} fill={base} stroke={line} strokeWidth={OUTLINE} />
      {/* muzzle */}
      <ellipse cx={50} cy={74} rx={14} ry={12} fill="#c9ad8c" />
      {/* nose + mouth */}
      <ellipse cx={50} cy={67} rx={6} ry={4.2} fill="#2b2a28" />
      <path d="M50 71 Q46 77 40 75 M50 71 Q54 77 60 75" fill="none" stroke={line} strokeWidth={1.6} strokeLinecap="round" />
      {/* whisker dots */}
      <circle cx={40} cy={69} r={1} fill={line} />
      <circle cx={60} cy={69} r={1} fill={line} />
      <Eye cx={40} cy={55} />
      <Eye cx={60} cy={55} />
      <Shine d="M34 44 Q44 36 56 38" />
    </g>
  );
}
