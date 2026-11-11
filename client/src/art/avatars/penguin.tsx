import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function Penguin({ base }: AnimalProps) {
  const line = '#16213a';
  return (
    <g>
      {/* feet */}
      <ellipse cx={42} cy={99} rx={7} ry={3.2} fill="#e4b7a0" stroke="#b58470" strokeWidth={1} />
      <ellipse cx={58} cy={99} rx={7} ry={3.2} fill="#e4b7a0" stroke="#b58470" strokeWidth={1} />
      {/* body */}
      <ellipse cx={50} cy={64} rx={27} ry={33} fill={base} stroke={line} strokeWidth={OUTLINE} />
      {/* belly */}
      <ellipse cx={52} cy={74} rx={17} ry={22} fill="#f4f1e8" />
      {/* chin */}
      <path d="M46 48 C52 52 60 54 66 50 C62 60 50 60 46 56 Z" fill="#f4f1e8" />
      {/* flipper */}
      <g transform="rotate(14 24 66)">
        <ellipse cx={24} cy={66} rx={6.5} ry={17} fill={base} stroke={line} strokeWidth={OUTLINE} />
      </g>
      {/* beak */}
      <path d="M62 44 L84 49 L62 54 Z" fill="#3a3a3a" stroke="#1f1f1f" strokeWidth={1.5} strokeLinejoin="round" />
      <path d="M62 50 L80 49.4 L62 54 Z" fill="#6a6a6a" />
      {/* silver eye */}
      <circle cx={58} cy={41} r={5.3} fill="#c5ccd6" />
      <Eye cx={58} cy={41} />
      <Shine d="M32 40 Q40 30 52 32" />
    </g>
  );
}
