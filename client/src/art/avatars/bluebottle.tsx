import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function Bluebottle({ base }: AnimalProps) {
  const tentacles =
    'M36 56 C30 68 42 76 34 86 C28 94 38 102 32 110 ' +
    'M46 58 C44 70 52 78 46 90 C42 98 50 106 46 112 ' +
    'M58 58 C62 70 54 80 62 90 C68 98 60 106 64 112 ' +
    'M68 54 C76 66 70 76 78 86 C84 94 76 102 82 108';
  return (
    <g>
      <path d={tentacles} fill="none" stroke={base} strokeWidth={3.2} strokeLinecap="round" />
      <path d={tentacles} fill="none" stroke="#7fb2ff" strokeWidth={1.2} strokeLinecap="round" opacity={0.8} />
      {/* float */}
      <ellipse cx={50} cy={44} rx={28} ry={15.5} fill="#7fb2ff" stroke={base} strokeWidth={OUTLINE} />
      {/* crest */}
      <path d="M24 40 C32 22 68 22 78 38 C66 30 36 30 24 40 Z" fill="#b9d8ff" stroke={base} strokeWidth={OUTLINE} strokeLinejoin="round" />
      <path d="M30 40 C40 36 60 36 72 40" fill="none" stroke="#dbe9ff" strokeWidth={1.4} opacity={0.8} />
      {/* bubbles */}
      <circle cx={84} cy={30} r={2.5} fill="none" stroke="#b9d8ff" strokeWidth={1.2} />
      <circle cx={90} cy={22} r={1.6} fill="none" stroke="#b9d8ff" strokeWidth={1.2} />
      <Eye cx={42} cy={46} r={3} />
      <Eye cx={56} cy={46} r={3} />
      <path d="M46 52 Q49 55 52 52" fill="none" stroke={base} strokeWidth={1.5} strokeLinecap="round" />
      <Shine d="M32 50 Q40 56 52 56" width={2.5} opacity={0.5} />
    </g>
  );
}
