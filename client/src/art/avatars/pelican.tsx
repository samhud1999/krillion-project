import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function Pelican(_: AnimalProps) {
  const white = '#f0ebdc';
  const line = '#a89f8c';
  return (
    <g>
      {/* body */}
      <ellipse cx={40} cy={92} rx={32} ry={26} fill={white} stroke={line} strokeWidth={OUTLINE} />
      {/* black wing */}
      <path d="M8 88 C18 78 36 82 48 94 C36 104 18 106 8 98 Z" fill="#1f2328" />
      {/* neck */}
      <path d="M32 72 C30 56 36 46 46 42 L60 48 C56 58 54 68 54 78 Z" fill={white} stroke={line} strokeWidth={OUTLINE} strokeLinejoin="round" />
      {/* head */}
      <circle cx={46} cy={40} r={19} fill={white} stroke={line} strokeWidth={OUTLINE} />
      <path d="M30 34 C28 26 32 20 40 20 C34 24 32 30 32 36 Z" fill="#b8b0a0" />
      {/* bill */}
      <path d="M58 38 L99 50 L58 49 Z" fill="#f2c89b" stroke="#b98b5a" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M96 48 C100 50 100 54 97 55 C96 52 95 50 94 49 Z" fill="#b98b5a" />
      <path d="M58 49 C66 52 82 58 97 53 C88 66 68 68 58 58 Z" fill="#f0b48a" stroke="#b98b5a" strokeWidth={1.6} strokeLinejoin="round" />
      {/* eye */}
      <circle cx={50} cy={36} r={5.6} fill="#f5e3b8" />
      <Eye cx={50} cy={36} />
      <Shine d="M34 30 Q40 24 48 24" />
    </g>
  );
}
