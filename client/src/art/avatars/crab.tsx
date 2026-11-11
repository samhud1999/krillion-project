import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function Crab({ base }: AnimalProps) {
  const line = '#8c3a1c';
  return (
    <g>
      {/* legs */}
      <path
        d="M30 64 L14 72 L10 86 M33 70 L18 82 L16 94 M38 74 L28 88 M70 64 L86 72 L90 86 M67 70 L82 82 L84 94 M62 74 L72 88"
        fill="none"
        stroke={base}
        strokeWidth={4.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M30 64 L14 72 L10 86 M33 70 L18 82 L16 94 M38 74 L28 88 M70 64 L86 72 L90 86 M67 70 L82 82 L84 94 M62 74 L72 88"
        fill="none"
        stroke={line}
        strokeWidth={1.2}
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.5}
      />
      {/* claws */}
      <path d="M28 52 C16 44 4 50 6 62 C10 70 20 66 24 60 L18 58 Z" fill={base} stroke={line} strokeWidth={OUTLINE} strokeLinejoin="round" />
      <path d="M72 52 C84 44 96 50 94 62 C90 70 80 66 76 60 L82 58 Z" fill={base} stroke={line} strokeWidth={OUTLINE} strokeLinejoin="round" />
      {/* eye stalks */}
      <path d="M40 40 L40 30 M60 40 L60 30" stroke={line} strokeWidth={3} strokeLinecap="round" />
      {/* carapace */}
      <path
        d="M24 58 C22 40 38 34 50 34 C62 34 78 40 76 58 C78 72 62 82 50 82 C38 82 22 72 24 58 Z"
        fill={base}
        stroke={line}
        strokeWidth={OUTLINE}
      />
      <circle cx={42} cy={64} r={2} fill="#f3b19d" opacity={0.8} />
      <circle cx={58} cy={64} r={2} fill="#f3b19d" opacity={0.8} />
      <circle cx={50} cy={72} r={2} fill="#f3b19d" opacity={0.8} />
      {/* mouth */}
      <path d="M44 52 Q50 56 56 52" fill="none" stroke={line} strokeWidth={1.6} strokeLinecap="round" />
      <Eye cx={40} cy={29} r={3.4} />
      <Eye cx={60} cy={29} r={3.4} />
      <Shine d="M32 46 Q40 40 50 40" />
    </g>
  );
}
