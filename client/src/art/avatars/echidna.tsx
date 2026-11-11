import { Eye, OUTLINE, Shine, type AnimalProps } from './shared';

export function Echidna({ base }: AnimalProps) {
  const line = '#5b4a3a';
  // long cream spines with dark tips, fanned over the back
  const spines =
    'M16 64 L2 50 L24 56 Z ' +
    'M20 54 L10 34 L30 48 Z ' +
    'M28 46 L24 24 L38 42 Z ' +
    'M38 40 L40 16 L48 38 Z ' +
    'M48 38 L56 14 L58 38 Z ' +
    'M58 40 L72 20 L66 42 Z ' +
    'M66 44 L84 30 L72 48 Z ' +
    'M72 50 L92 44 L76 56 Z ' +
    'M12 74 L0 68 L14 66 Z';
  const tips =
    'M2 50 L8 53 L6 55 Z M10 34 L15 38 L12 40 Z M24 24 L28 29 L25 31 Z M40 16 L43 22 L40 23 Z M56 14 L57 20 L54 20 Z M72 20 L70 26 L67 24 Z M84 30 L80 35 L78 32 Z M92 44 L87 47 L86 44 Z';
  return (
    <g>
      <path d={spines} fill="#e9d8b4" stroke={line} strokeWidth={1.6} strokeLinejoin="round" />
      <path d={tips} fill={line} />
      {/* body dome */}
      <path
        d="M10 78 C10 52 30 40 54 40 C74 40 86 52 88 72 C88 80 84 84 78 84 L20 84 C14 84 10 82 10 78 Z"
        fill={base}
        stroke={line}
        strokeWidth={OUTLINE}
      />
      {/* paler face */}
      <path d="M62 56 C76 54 86 62 88 74 C86 82 76 84 64 82 Z" fill="#a98a66" />
      {/* long thin snout */}
      <path d="M82 68 C90 68 98 72 104 80 C98 82 90 82 82 79 Z" fill={line} stroke="#3a2e22" strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={101} cy={79} r={2} fill="#1a1a1a" />
      {/* feet with digging claws */}
      <ellipse cx={32} cy={86} rx={10} ry={4.5} fill={line} />
      <ellipse cx={66} cy={86} rx={10} ry={4.5} fill={line} />
      <path d="M26 88 L23 93 M32 89 L32 94 M38 88 L41 93 M60 88 L57 93 M66 89 L66 94 M72 88 L75 93" stroke="#2b2118" strokeWidth={1.8} strokeLinecap="round" />
      <Eye cx={78} cy={66} r={3.3} />
      <Shine d="M30 58 Q42 50 56 50" />
    </g>
  );
}
