import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function Cockatoo(_: AnimalProps) {
  const white = '#f7f3e6';
  const line = '#b9b3a4';
  const crest = '#f5d35a';
  const crestLine = '#c9a62e';
  return (
    <g>
      {/* crest feathers */}
      <path d="M44 32 C40 18 46 8 58 4 C52 14 52 24 54 32 Z" fill={crest} stroke={crestLine} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M52 32 C54 16 66 8 80 10 C68 16 62 26 60 34 Z" fill={crest} stroke={crestLine} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M58 36 C66 24 80 20 92 26 C80 28 70 34 64 40 Z" fill={crest} stroke={crestLine} strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M38 36 C32 24 34 14 42 8 C40 18 42 28 46 36 Z" fill={crest} stroke={crestLine} strokeWidth={1.6} strokeLinejoin="round" />
      {/* body */}
      <ellipse cx={44} cy={94} rx={28} ry={22} fill="#efe9da" stroke={line} strokeWidth={OUTLINE} />
      {/* head */}
      <circle cx={50} cy={56} r={25} fill={white} stroke={line} strokeWidth={OUTLINE} />
      {/* cheek wash */}
      <ellipse cx={60} cy={64} rx={9} ry={6} fill={crest} opacity={0.45} />
      {/* beak */}
      <path d="M60 60 C74 58 78 70 70 80 C68 72 64 68 58 68 Z" fill="#4b4b4b" stroke="#2a2a2a" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M58 68 C64 72 68 76 68 82 C62 80 58 76 56 70 Z" fill="#6a6a6a" />
      {/* eye ring */}
      <circle cx={42} cy={52} r={6.2} fill="#cfd9e3" stroke="#9eafbe" strokeWidth={1} />
      <Eye cx={42} cy={52} />
      <Shine d="M32 44 Q38 36 48 36" />
    </g>
  );
}
