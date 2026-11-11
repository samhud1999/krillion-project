import './tokens.css';

/**
 * The krill, drawn in a 100×100 box, swimming to the right. Coral body, dark
 * outline, a big eye and long antennae. Shared by the logo and the top tier badge.
 */
export function KrillMark({ color = '#ff7a5c', line = '#8c3a1c' }: { color?: string; line?: string }) {
  return (
    <g>
      {/* antennae */}
      <path d="M70 40 C82 28 94 22 100 10 M72 44 C86 40 96 36 102 30" fill="none" stroke={line} strokeWidth={2.2} strokeLinecap="round" />
      {/* tail fan */}
      <path d="M12 58 L0 48 L8 60 L0 70 L14 64 Z" fill={color} stroke={line} strokeWidth={2} strokeLinejoin="round" />
      {/* segmented tail, five plates, back to front */}
      <path d="M12 56 C14 50 20 48 26 50 L28 66 C22 68 14 66 12 62 Z" fill={color} stroke={line} strokeWidth={2} strokeLinejoin="round" />
      <path d="M24 50 C28 44 36 44 40 48 L40 68 C34 70 26 68 26 64 Z" fill={color} stroke={line} strokeWidth={2} strokeLinejoin="round" />
      <path d="M38 48 C42 40 52 40 54 46 L52 70 C46 72 38 70 38 66 Z" fill={color} stroke={line} strokeWidth={2} strokeLinejoin="round" />
      {/* head / carapace */}
      <path d="M50 46 C56 32 78 30 84 44 C88 54 80 66 66 66 L52 68 Z" fill={color} stroke={line} strokeWidth={2} strokeLinejoin="round" />
      {/* swimming legs */}
      <path d="M30 68 L28 80 M38 70 L38 82 M46 70 L48 82 M56 68 L60 80 M64 66 L70 76" fill="none" stroke={line} strokeWidth={2} strokeLinecap="round" />
      {/* segment highlights */}
      <path d="M28 52 C32 50 36 50 38 52 M42 50 C46 46 50 46 52 48 M56 40 C62 36 70 36 76 40" fill="none" stroke="#ffd1c4" strokeWidth={1.6} strokeLinecap="round" opacity={0.8} />
      {/* eye */}
      <circle cx={74} cy={46} r={5.5} fill="#1a1a1a" />
      <circle cx={72.3} cy={44.3} r={1.9} fill="#ffffff" />
      {/* glow dot */}
      <circle cx={62} cy={56} r={2} fill="#7ee8fa" opacity={0.9} />
    </g>
  );
}

export interface LogoProps {
  variant?: 'full' | 'mark';
  className?: string;
}

export function Logo({ variant = 'full', className }: LogoProps) {
  if (variant === 'mark') {
    return (
      <svg viewBox="0 0 110 100" className={className} role="img" aria-label="Separation Creek Krillion" style={{ display: 'block', overflow: 'visible' }}>
        <title>Separation Creek Krillion</title>
        <circle cx={52} cy={54} r={46} fill="#0f4c5c" />
        <circle cx={52} cy={54} r={46} fill="none" stroke="#7ee8fa" strokeWidth={2} opacity={0.6} />
        <g transform="translate(6 10) scale(0.9)">
          <KrillMark />
        </g>
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 440 124" className={className} role="img" aria-label="Separation Creek Krillion" style={{ display: 'block', overflow: 'visible' }}>
      <title>Separation Creek Krillion</title>
      <circle cx={56} cy={62} r={50} fill="#0f4c5c" />
      <circle cx={56} cy={62} r={50} fill="none" stroke="#7ee8fa" strokeWidth={2} opacity={0.6} />
      <g transform="translate(8 16) scale(0.96)">
        <KrillMark />
      </g>
      <text
        x={124}
        y={42}
        fontFamily="var(--sck-font-ui)"
        fontSize={15}
        fontWeight={700}
        letterSpacing={4.5}
        fill="#b8c4c9"
      >
        SEPARATION CREEK
      </text>
      <text
        x={122}
        y={96}
        fontFamily="var(--sck-font-display)"
        fontSize={58}
        fontWeight={800}
        letterSpacing={1}
        fill="#f4f1e8"
        style={{ fontVariationSettings: '"opsz" 144, "SOFT" 60, "WONK" 1' }}
      >
        KRILLION
      </text>
      <path
        d="M124 108 Q144 100 164 108 T204 108 T244 108 T284 108 T324 108 T364 108 T404 108"
        fill="none"
        stroke="#7ee8fa"
        strokeWidth={3}
        strokeLinecap="round"
        opacity={0.9}
      />
    </svg>
  );
}
