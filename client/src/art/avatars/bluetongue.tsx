import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function BlueTongue({ base }: AnimalProps) {
  const line = '#4b5440';
  const blue = '#2f6fd1';
  return (
    <g>
      {/* stubby front leg */}
      <path d="M34 72 L30 88 L40 88" fill="none" stroke={line} strokeWidth={5.5} strokeLinecap="round" strokeLinejoin="round" />
      {/* body + big triangular head, side on, facing right */}
      <path
        d="M8 60 C8 48 20 42 40 42 L62 40 C78 38 92 46 94 58 C95 66 88 72 78 72 L44 74 C26 74 8 70 8 60 Z"
        fill={base}
        stroke={line}
        strokeWidth={OUTLINE}
        strokeLinejoin="round"
      />
      {/* dark bands */}
      <path d="M24 43 L32 42.5 L32 73.5 L24 73.8 Z M46 41.5 L54 41 L54 73.6 L46 73.8 Z" fill={line} opacity={0.55} />
      {/* pale belly */}
      <path d="M12 66 C30 72 52 72 76 70 C60 76 32 78 12 70 Z" fill="#b8bfa5" opacity={0.7} />
      {/* scale rows */}
      <path d="M36 48 L40 48 M58 46 L62 46 M36 58 L40 58 M60 58 L64 58 M72 52 L76 52" stroke={line} strokeWidth={1.4} strokeLinecap="round" opacity={0.5} />
      {/* mouth line */}
      <path d="M70 62 C78 63 86 63 92 61" fill="none" stroke={line} strokeWidth={1.6} strokeLinecap="round" />
      {/* the famous tongue: wide, forked, hanging out */}
      <path d="M84 62 C92 62 100 66 106 74 C101 75 95 73 90 70 L88 66 Z" fill={blue} stroke="#1f4a94" strokeWidth={1.6} strokeLinejoin="round" />
      <path d="M100 70 L106 74 L104 67" fill={blue} stroke="#1f4a94" strokeWidth={1.4} strokeLinejoin="round" />
      <path d="M88 65 C94 66 99 69 103 72" fill="none" stroke="#7fb2ff" strokeWidth={1.6} strokeLinecap="round" />
      {/* nostril */}
      <circle cx={88} cy={52} r={1.7} fill={line} />
      <Eye cx={74} cy={52} r={3.8} />
      <Shine d="M18 50 Q32 44 50 44" />
    </g>
  );
}
