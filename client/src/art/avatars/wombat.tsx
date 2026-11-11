import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function Wombat({ base }: AnimalProps) {
  const line = '#43362a';
  return (
    <g>
      {/* small ears set wide on a broad, flat head */}
      <ellipse cx={19} cy={38} rx={8} ry={9} fill={base} stroke={line} strokeWidth={OUTLINE} />
      <ellipse cx={81} cy={38} rx={8} ry={9} fill={base} stroke={line} strokeWidth={OUTLINE} />
      <ellipse cx={20} cy={39} rx={4} ry={5} fill="#9c8270" />
      <ellipse cx={80} cy={39} rx={4} ry={5} fill="#9c8270" />
      {/* head: wider than tall, chunky */}
      <path
        d="M12 58 C12 36 30 30 50 30 C70 30 88 36 88 58 C88 78 72 90 50 90 C28 90 12 78 12 58 Z"
        fill={base}
        stroke={line}
        strokeWidth={OUTLINE}
      />
      {/* coarse fur tufts on the crown */}
      <path d="M36 32 L34 24 L42 30 M50 30 L50 21 L56 29 M64 32 L68 24 L70 31" fill="none" stroke={line} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {/* cheeks */}
      <ellipse cx={30} cy={72} rx={12} ry={9} fill="#8a7560" />
      <ellipse cx={70} cy={72} rx={12} ry={9} fill="#8a7560" />
      {/* big leathery nose */}
      <path d="M36 62 C36 54 64 54 64 62 C64 72 56 76 50 76 C44 76 36 72 36 62 Z" fill="#2b2a28" />
      <ellipse cx={44} cy={62} rx={2.6} ry={2} fill="#4a4542" />
      <ellipse cx={56} cy={62} rx={2.6} ry={2} fill="#4a4542" />
      <ellipse cx={43} cy={57.5} rx={4} ry={1.8} fill="#ffffff" opacity={0.28} />
      {/* mouth */}
      <path d="M50 76 L50 80 M42 81 Q50 86 58 81" fill="none" stroke={line} strokeWidth={1.8} strokeLinecap="round" />
      <Eye cx={33} cy={52} r={3.3} />
      <Eye cx={67} cy={52} r={3.3} />
      <Shine d="M26 40 Q38 33 54 34" />
    </g>
  );
}
