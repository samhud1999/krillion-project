import type { TierId } from '@shared/types';
import { TIERS } from '@shared/theme';
import { KrillMark } from './Logo';
import './tokens.css';

export const TIER_COLORS: Record<TierId, string> = {
  dry: '#8f8674',
  puddle: '#9fb7c4',
  shallows: '#4fb1bd',
  rockpool: '#e07a5f',
  deepcut: '#2f6fd1',
  krillion: '#ffd27a',
};

const SIZES = { sm: 32, md: 56, lg: 96 } as const;

export interface TierBadgeProps {
  tier: TierId;
  size?: 'sm' | 'md' | 'lg';
  animate?: boolean;
  className?: string;
}

function Fish({ x, y, s, c }: { x: number; y: number; s: number; c: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`}>
      <ellipse cx={0} cy={0} rx={9} ry={5} fill={c} />
      <path d="M8 0 L15 -5 L15 5 Z" fill={c} />
      <circle cx={-4} cy={-1.2} r={1.1} fill="#06202b" />
    </g>
  );
}

function Emblem({ tier }: { tier: TierId }) {
  const c = TIER_COLORS[tier];
  switch (tier) {
    case 'dry':
      return (
        <g>
          <circle cx={50} cy={52} r={22} fill="#a89a80" />
          <path d="M34 44 L46 52 L42 64 M46 52 L60 48 L66 60 M60 48 L58 36" fill="none" stroke="#5c5244" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" />
          <path d="M30 60 Q50 70 70 60" fill="none" stroke="#5c5244" strokeWidth={1.6} opacity={0.6} />
        </g>
      );
    case 'puddle':
      return (
        <g fill="none" stroke={c} strokeWidth={2.6}>
          <ellipse cx={50} cy={56} rx={8} ry={3.5} />
          <ellipse cx={50} cy={56} rx={17} ry={7.5} opacity={0.8} />
          <ellipse cx={50} cy={56} rx={26} ry={12} opacity={0.5} />
          <path d="M50 30 C46 36 44 40 44 43 A6 6 0 0 0 56 43 C56 40 54 36 50 30 Z" fill={c} stroke="none" />
        </g>
      );
    case 'shallows':
      return (
        <g>
          <Fish x={40} y={44} s={1.1} c={c} />
          <Fish x={58} y={56} s={1.1} c={c} />
          <Fish x={38} y={64} s={0.9} c={c} />
          <Fish x={62} y={38} s={0.8} c="#8ad3dc" />
        </g>
      );
    case 'rockpool':
      return (
        <g>
          {Array.from({ length: 14 }, (_, k) => {
            const ang = (k / 14) * Math.PI * 2;
            return <line key={k} x1={50} y1={54} x2={50 + Math.cos(ang) * 24} y2={54 + Math.sin(ang) * 24} stroke={c} strokeWidth={3.4} strokeLinecap="round" />;
          })}
          <circle cx={50} cy={54} r={12} fill={c} stroke="#9a4a36" strokeWidth={1.5} />
          <circle cx={50} cy={54} r={5} fill="#9a4a36" />
        </g>
      );
    case 'deepcut':
      return (
        <g>
          <path d="M28 54 C34 40 54 38 66 50 C60 62 40 66 28 54 Z" fill={c} stroke="#1b4a97" strokeWidth={1.5} />
          <path d="M66 50 L78 42 L76 58 Z" fill={c} />
          <path d="M44 42 C46 32 54 28 60 30" fill="none" stroke={c} strokeWidth={2} strokeLinecap="round" />
          <circle cx={60} cy={29} r={3.6} fill="#7ee8fa" className="sck-anim-twinkle" style={{ animationDuration: '2s' }} />
          <circle cx={40} cy={50} r={2.4} fill="#06202b" />
          <path d="M30 54 L40 58 M34 56 L44 60" stroke="#f4f1e8" strokeWidth={1.2} opacity={0.6} />
        </g>
      );
    case 'krillion':
    default:
      return (
        <g>
          <g transform="translate(50 54) scale(0.52) translate(-50 -50)">
            <KrillMark />
          </g>
        </g>
      );
  }
}

export function TierBadge({ tier, size = 'md', animate = false, className }: TierBadgeProps) {
  const px = SIZES[size];
  const c = TIER_COLORS[tier];
  const info = TIERS[tier];
  const krillion = tier === 'krillion';
  return (
    <svg
      viewBox="0 0 100 100"
      width={px}
      height={px}
      className={[className, animate ? 'sck-anim-pop' : '', animate && krillion ? 'sck-anim-glow' : ''].filter(Boolean).join(' ') || undefined}
      role="img"
      aria-label={info.label}
      style={{ display: 'inline-block', verticalAlign: 'middle', overflow: 'visible' }}
    >
      <title>{info.label}</title>
      {krillion ? (
        <g className={animate ? 'sck-anim-rays' : undefined} opacity={0.75}>
          {Array.from({ length: 12 }, (_, k) => {
            const ang = (k / 12) * Math.PI * 2;
            return (
              <line
                key={k}
                x1={50 + Math.cos(ang) * 40}
                y1={50 + Math.sin(ang) * 40}
                x2={50 + Math.cos(ang) * 50}
                y2={50 + Math.sin(ang) * 50}
                stroke={c}
                strokeWidth={k % 2 ? 2 : 3.5}
                strokeLinecap="round"
              />
            );
          })}
        </g>
      ) : null}
      <circle cx={50} cy={50} r={38} fill="#0b1d2a" stroke={c} strokeWidth={4} />
      <circle cx={50} cy={50} r={32} fill="none" stroke={c} strokeWidth={1} opacity={0.35} />
      <Emblem tier={tier} />
    </svg>
  );
}
