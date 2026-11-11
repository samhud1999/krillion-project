import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function Platypus({ base }: AnimalProps) {
  const line = '#352a20';
  return (
    <g>
      {/* tail */}
      <ellipse cx={18} cy={68} rx={16} ry={9} fill="#3f3227" stroke="#2a2118" strokeWidth={OUTLINE} />
      {/* body */}
      <ellipse cx={46} cy={60} rx={29} ry={23} fill={base} stroke={line} strokeWidth={OUTLINE} />
      {/* belly */}
      <ellipse cx={44} cy={72} rx={17} ry={8} fill="#8a7560" opacity={0.55} />
      {/* bill */}
      <path
        d="M60 60 C70 54 90 55 98 62 C94 68 78 71 60 69 Z"
        fill="#7a7f85"
        stroke="#4a4e52"
        strokeWidth={OUTLINE}
        strokeLinejoin="round"
      />
      <path d="M62 66 C72 70 86 70 96 64 C90 70 72 72 62 68 Z" fill="#5f646a" />
      <circle cx={87} cy={60} r={1.5} fill="#2b2f33" />
      <circle cx={92} cy={61.5} r={1.5} fill="#2b2f33" />
      {/* webbed foot */}
      <path d="M30 80 L26 90 L34 88 L38 92 L42 86 L48 90 L44 80 Z" fill="#7a7f85" stroke="#4a4e52" strokeWidth={1.5} strokeLinejoin="round" />
      <Eye cx={58} cy={52} />
      <Shine d="M28 46 Q38 38 52 39" />
    </g>
  );
}
