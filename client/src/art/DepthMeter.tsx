import type { ZoneId } from '@shared/types';
import { MAX_DEPTH } from '@shared/types';
import { ZONES, zoneForDepth } from '@shared/theme';
import './tokens.css';

export const ZONE_COLORS: Record<ZoneId, string> = {
  bridge: '#5a3b1e',
  rockpools: '#2b2f36',
  beach: '#2f8f9d',
  mouth: '#0f4c5c',
};

export const ZONE_ACCENTS: Record<ZoneId, string> = {
  bridge: '#ffd27a',
  rockpools: '#e07a5f',
  beach: '#e9d8b4',
  mouth: '#7ee8fa',
};

export interface DepthMeterProps {
  depth: number;
  maxDepth?: number;
  orientation?: 'horizontal' | 'vertical';
  className?: string;
  /** optional caption, e.g. the player's name */
  label?: string;
}

/**
 * A gauge of the whole creek with the four zones, tick marks at the zone
 * boundaries and a marker that eases to the current depth.
 */
export function DepthMeter({ depth, maxDepth = MAX_DEPTH, orientation = 'horizontal', className, label }: DepthMeterProps) {
  const d = Math.max(0, Math.min(maxDepth, depth));
  const zone = zoneForDepth(d);
  const t = d / maxDepth;
  const ticks = [0, ...ZONES.slice(1).map((z) => z.from), maxDepth];

  if (orientation === 'vertical') {
    const W = 96;
    const H = 420;
    const x0 = 30;
    const y0 = 28;
    const len = 360;
    const th = 16;
    const y = y0 + t * len;
    return (
      <svg viewBox={`0 0 ${W} ${H}`} className={className} width="100%" role="img" aria-label={`${Math.round(d)} metres, ${zone.label}`} style={{ display: 'block', fontFamily: 'var(--sck-font-ui)' }}>
        <rect x={x0} y={y0} width={th} height={len} rx={th / 2} fill="#06202b" />
        {ZONES.map((z) => {
          const a = y0 + (z.from / maxDepth) * len;
          const b = y0 + (Math.min(z.to, maxDepth) / maxDepth) * len;
          return <rect key={z.id} x={x0 + 2} y={a} width={th - 4} height={b - a} fill={ZONE_COLORS[z.id]} />;
        })}
        <rect x={x0 + 2} y={y0} width={th - 4} height={len} rx={(th - 4) / 2} fill="none" stroke="rgba(244,241,232,0.25)" />
        {ticks.map((m) => {
          const ty = y0 + (m / maxDepth) * len;
          return (
            <g key={m}>
              <line x1={x0 + th} y1={ty} x2={x0 + th + 6} y2={ty} stroke="#f4f1e8" strokeWidth={1.2} opacity={0.6} />
              <text x={x0 + th + 10} y={ty + 3.5} fontSize={10} fill="#b8c4c9">
                {m}
              </text>
            </g>
          );
        })}
        <g className="sck-meter-marker" style={{ transform: `translate(0px, ${y}px)` }}>
          <path d={`M${x0 - 4} 0 L${x0 - 14} -7 L${x0 - 14} 7 Z`} fill={ZONE_ACCENTS[zone.id]} />
          <circle cx={x0 + th / 2} cy={0} r={6} fill="#f4f1e8" stroke={ZONE_ACCENTS[zone.id]} strokeWidth={2.5} />
        </g>
        <text x={W / 2} y={H - 8} textAnchor="middle" fontSize={11} fontWeight={700} fill="#f4f1e8">
          {Math.round(d)} m
        </text>
        {label ? (
          <text x={W / 2} y={14} textAnchor="middle" fontSize={10} fill="#b8c4c9">
            {label}
          </text>
        ) : null}
      </svg>
    );
  }

  const W = 420;
  const H = 76;
  const x0 = 16;
  const len = W - 32;
  const yTrack = 36;
  const th = 14;
  const x = x0 + t * len;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={className} width="100%" role="img" aria-label={`${Math.round(d)} metres, ${zone.label}`} style={{ display: 'block', fontFamily: 'var(--sck-font-ui)' }}>
      <text x={x0} y={16} fontSize={13} fontWeight={700} fill="#f4f1e8">
        {label ? `${label} · ` : ''}
        {Math.round(d)} m
      </text>
      <text x={W - 16} y={16} textAnchor="end" fontSize={12} fontWeight={600} fill={ZONE_ACCENTS[zone.id]} letterSpacing={1}>
        {zone.label.toUpperCase()}
      </text>
      <rect x={x0} y={yTrack} width={len} height={th} rx={th / 2} fill="#06202b" />
      {ZONES.map((z) => {
        const a = x0 + (z.from / maxDepth) * len;
        const b = x0 + (Math.min(z.to, maxDepth) / maxDepth) * len;
        return <rect key={z.id} x={a} y={yTrack + 2} width={b - a} height={th - 4} fill={ZONE_COLORS[z.id]} />;
      })}
      <rect x={x0 + 1} y={yTrack + 1} width={len - 2} height={th - 2} rx={(th - 2) / 2} fill="none" stroke="rgba(244,241,232,0.25)" />
      {ticks.map((m) => {
        const tx = x0 + (m / maxDepth) * len;
        return (
          <g key={m}>
            <line x1={tx} y1={yTrack + th} x2={tx} y2={yTrack + th + 5} stroke="#f4f1e8" strokeWidth={1.2} opacity={0.6} />
            <text x={tx} y={yTrack + th + 17} textAnchor={m === 0 ? 'start' : m === maxDepth ? 'end' : 'middle'} fontSize={10} fill="#b8c4c9">
              {m}
            </text>
          </g>
        );
      })}
      <g className="sck-meter-marker" style={{ transform: `translate(${x}px, 0px)` }}>
        <path d={`M0 ${yTrack - 4} L-6 ${yTrack - 13} L6 ${yTrack - 13} Z`} fill={ZONE_ACCENTS[zone.id]} />
        <circle cx={0} cy={yTrack + th / 2} r={6.5} fill="#f4f1e8" stroke={ZONE_ACCENTS[zone.id]} strokeWidth={2.5} />
      </g>
    </svg>
  );
}
