import { useId } from 'react';
import type { PlayerPublic } from '@shared/types';
import { MAX_DEPTH } from '@shared/types';
import { ZONES } from '@shared/theme';
import { Avatar } from './Avatar';
import './tokens.css';

export type SceneVariant = 'host' | 'phone' | 'results';

export interface SceneGeometry {
  width: number;
  height: number;
  /** y of the top of the bridge deck */
  deckTop: number;
  deckBottom: number;
  /** y where the water starts (0 m) */
  waterTop: number;
  /** y where MAX_DEPTH sits */
  waterBottom: number;
  /** x extent of the channel */
  channelLeft: number;
  channelRight: number;
  avatarSize: number;
  lanes: number;
  labelFont: number;
  pierX: [number, number];
  pierWidth: number;
  lampX: number;
}

export const SCENE_GEOMETRY: Record<SceneVariant, SceneGeometry> = {
  host: {
    width: 600,
    height: 1400,
    deckTop: 130,
    deckBottom: 154,
    waterTop: 230,
    waterBottom: 1360,
    channelLeft: 56,
    channelRight: 536,
    avatarSize: 44,
    lanes: 5,
    labelFont: 12,
    pierX: [140, 460],
    pierWidth: 26,
    lampX: 300,
  },
  results: {
    width: 600,
    height: 1400,
    deckTop: 130,
    deckBottom: 154,
    waterTop: 230,
    waterBottom: 1360,
    channelLeft: 56,
    channelRight: 536,
    avatarSize: 44,
    lanes: 5,
    labelFont: 12,
    pierX: [140, 460],
    pierWidth: 26,
    lampX: 300,
  },
  phone: {
    width: 360,
    height: 900,
    deckTop: 90,
    deckBottom: 106,
    waterTop: 150,
    waterBottom: 880,
    channelLeft: 30,
    channelRight: 318,
    avatarSize: 28,
    lanes: 4,
    labelFont: 10,
    pierX: [84, 276],
    pierWidth: 18,
    lampX: 180,
  },
};

/**
 * y (viewBox units) of a player's avatar centre for a given depth.
 * depth <= 0 → standing on the bridge deck; otherwise linear from the
 * waterline (0 m) to the bottom of the trench (maxDepth).
 */
export function depthToY(depth: number, maxDepth: number = MAX_DEPTH, variant: SceneVariant = 'host'): number {
  const g = SCENE_GEOMETRY[variant];
  if (depth <= 0) return g.deckTop - g.avatarSize / 2 - 2;
  const t = Math.max(0, Math.min(1, depth / maxDepth));
  return g.waterTop + t * (g.waterBottom - g.waterTop);
}

export function metresToY(m: number, maxDepth: number, g: SceneGeometry): number {
  const t = Math.max(0, Math.min(1, m / maxDepth));
  return g.waterTop + t * (g.waterBottom - g.waterTop);
}

/** Deterministic x/y for every player so the layout never jumps between frames. */
export function layoutPlayers(
  players: PlayerPublic[],
  maxDepth: number,
  variant: SceneVariant,
): { player: PlayerPublic; x: number; y: number; onDeck: boolean }[] {
  const g = SCENE_GEOMETRY[variant];
  const n = players.length;
  const onDeck = players.filter((p) => p.depth <= 0);
  const deckSpacing = n > 1 ? Math.min(g.avatarSize * 0.9, (g.width - 80) / Math.max(1, onDeck.length - 1)) : 0;
  const deckStart = g.width / 2 - (deckSpacing * Math.max(0, onDeck.length - 1)) / 2;
  let deckIndex = 0;
  const laneW = (g.channelRight - g.channelLeft) / g.lanes;
  return players.map((player, i) => {
    if (player.depth <= 0) {
      const k = deckIndex++;
      const x = onDeck.length > 1 ? deckStart + k * deckSpacing : g.width / 2;
      const y = depthToY(0, maxDepth, variant) - (k % 2 === 1 ? g.avatarSize * 0.32 : 0);
      return { player, x, y, onDeck: true };
    }
    const lane = i % g.lanes;
    const row = Math.floor(i / g.lanes);
    const fan = ((row % 4) - 1.5) * g.avatarSize * 0.34;
    const x = g.channelLeft + laneW * (lane + 0.5) + fan;
    const y = depthToY(player.depth, maxDepth, variant) + (row % 2) * g.avatarSize * 0.5;
    return { player, x, y, onDeck: false };
  });
}

function wavePath(y: number, amp: number, wavelength: number, x0: number, x1: number): string {
  let d = `M${x0} ${y}`;
  const half = wavelength / 2;
  let x = x0;
  let up = true;
  while (x < x1) {
    const cx = x + half / 2;
    const nx = x + half;
    d += ` Q${cx} ${y + (up ? -amp : amp)} ${nx} ${y}`;
    x = nx;
    up = !up;
  }
  return d;
}

/**
 * Almost-pixel band edge: a square-wave top edge (stair steps) from x0 to x1
 * at yEdge, closed down to yBottom. The signature retro move of the scene.
 */
function steppedBandPath(yEdge: number, x0: number, x1: number, yBottom: number, step: number, drop: number): string {
  let d = `M${x0} ${yEdge.toFixed(1)}`;
  let x = x0;
  let down = true;
  while (x < x1) {
    const nx = Math.min(x + step, x1);
    d += ` H${nx.toFixed(1)}`;
    if (nx < x1) {
      d += ` v${down ? drop : -drop}`;
      down = !down;
    }
    x = nx;
  }
  d += ` V${yBottom.toFixed(1)} H${x0} Z`;
  return d;
}

function starPath(cx: number, cy: number, outer: number, inner: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (-90 + i * 36) * (Math.PI / 180);
    pts.push(`${(cx + r * Math.cos(a)).toFixed(1)} ${(cy + r * Math.sin(a)).toFixed(1)}`);
  }
  return `M${pts.join(' L')} Z`;
}

export interface CreekSceneProps {
  players: PlayerPublic[];
  maxDepth?: number;
  highlightPlayerId?: string;
  variant: SceneVariant;
  showZoneLabels?: boolean;
  className?: string;
}

/**
 * The creek in cross-section, from the Great Ocean Road bridge down to the
 * mouth. One responsive <svg>; give its wrapper a width (and optionally a
 * max-height) and it keeps the 600×1400 (host/results) or 360×900 (phone)
 * aspect ratio.
 */
export function CreekScene({
  players,
  maxDepth = MAX_DEPTH,
  highlightPlayerId,
  variant,
  showZoneLabels = true,
  className,
}: CreekSceneProps) {
  const g = SCENE_GEOMETRY[variant];
  const uid = useId().replace(/[:]/g, '');
  const id = (s: string) => `sck-${s}-${uid}`;
  const phone = variant === 'phone';
  const s = phone ? 0.6 : 1; // decoration scale
  const W = g.width;
  const H = g.height;
  const cl = g.channelLeft;
  const cr = g.channelRight;
  const cw = cr - cl;
  const zY = (m: number) => metresToY(m, maxDepth, g);
  const zone = (zid: string) => ZONES.find((z) => z.id === zid)!;
  const yRock = zY(zone('rockpools').from);
  const yBeach = zY(zone('beach').from);
  const yMouth = zY(zone('mouth').from);
  const yBottom = g.waterBottom;

  // The channel outline, fanning out to full width at the mouth. Shared by the
  // fill and by the clip that keeps the quantized bands inside the water.
  const waterPath = `M${cl} ${g.waterTop} L${cr} ${g.waterTop} L${cr} ${yBeach + 40 * s} C${cr + 4} ${yMouth - 40 * s} ${cr + 30} ${yMouth} ${W} ${yMouth + 30 * s} L${W} ${H} L0 ${H} L0 ${yMouth + 30 * s} C${cl - 30} ${yMouth} ${cl - 4} ${yMouth - 40 * s} ${cl} ${yBeach + 40 * s} Z`;

  // almost-pixel water: flat zone bands with stair-stepped edges + sparse dither
  const bandStep = phone ? 26 : 44;
  const bandDrop = phone ? 5 : 8;
  const yTrench = yMouth + (yBottom - yMouth) * 0.55;
  const bands: { y: number; color: string; x0: number }[] = [
    { y: yRock, color: '#1f3a3f', x0: 0 },
    { y: yBeach, color: '#2f8f9d', x0: -bandStep / 2 },
    { y: yMouth, color: '#0f4c5c', x0: 0 },
    { y: yTrench, color: '#06202b', x0: -bandStep / 2 },
  ];

  const laid = layoutPlayers(players, maxDepth, variant);
  const showAllNames = variant === 'results';

  // decorative positions (deterministic)
  const stars = [
    [40, 22], [92, 48], [150, 18], [210, 60], [260, 30], [330, 14], [390, 52], [450, 26], [520, 44], [570, 16], [120, 80], [480, 76],
  ].map(([x, y]) => [x! * (W / 600), y! * (phone ? 0.7 : 1)] as [number, number]);

  const ferns: { x: number; y: number; sz: number; flip?: boolean }[] = phone
    ? [
        { x: 4, y: 96, sz: 46 }, { x: 22, y: 110, sz: 38, flip: true }, { x: 300, y: 98, sz: 48, flip: true }, { x: 326, y: 112, sz: 36 },
        { x: -6, y: 128, sz: 34 }, { x: 334, y: 130, sz: 32, flip: true },
      ]
    : [
        { x: 0, y: 150, sz: 78 }, { x: 36, y: 176, sz: 62, flip: true }, { x: 10, y: 200, sz: 54 },
        { x: 522, y: 146, sz: 82, flip: true }, { x: 548, y: 180, sz: 60 }, { x: 536, y: 206, sz: 50, flip: true },
        { x: 60, y: 126, sz: 50 }, { x: 496, y: 124, sz: 54, flip: true }, { x: 572, y: 214, sz: 42 },
      ];

  const anemones = [
    { x: cl + cw * 0.08, y: yRock + (yBeach - yRock) * 0.22, r: 11 * s, c: '#e07a5f' },
    { x: cl + cw * 0.93, y: yRock + (yBeach - yRock) * 0.38, r: 13 * s, c: '#f08a6a' },
    { x: cl + cw * 0.12, y: yRock + (yBeach - yRock) * 0.72, r: 9 * s, c: '#d9643a' },
    { x: cl + cw * 0.9, y: yRock + (yBeach - yRock) * 0.86, r: 12 * s, c: '#e07a5f' },
    { x: cl + cw * 0.5, y: yBeach - 18 * s, r: 10 * s, c: '#f3b19d' },
  ];
  const seaStars = [
    { x: cl + cw * 0.2, y: yRock + (yBeach - yRock) * 0.5, r: 12 * s, c: '#e07a5f' },
    { x: cl + cw * 0.82, y: yRock + (yBeach - yRock) * 0.62, r: 9 * s, c: '#f3b19d' },
    { x: cl + cw * 0.36, y: yBeach - 30 * s, r: 10 * s, c: '#d9643a' },
  ];
  const specks = Array.from({ length: 14 }, (_, i) => ({
    x: cl + cw * ((i * 0.618) % 1),
    y: yMouth + (yBottom - yMouth) * (0.12 + ((i * 0.37) % 1) * 0.84),
    r: (1.6 + (i % 3) * 0.9) * s,
    d: (i * 0.41) % 3,
  }));
  const kelp = [
    { x: cl + cw * 0.1, h: (yBottom - yMouth) * 0.8, w: 14 * s, dur: 7 },
    { x: cl + cw * 0.22, h: (yBottom - yMouth) * 0.55, w: 11 * s, dur: 9 },
    { x: cl + cw * 0.86, h: (yBottom - yMouth) * 0.9, w: 15 * s, dur: 8 },
    { x: cl + cw * 0.74, h: (yBottom - yMouth) * 0.5, w: 10 * s, dur: 10 },
    { x: cl + cw * 0.5, h: (yBottom - yMouth) * 0.35, w: 9 * s, dur: 11 },
  ];
  const foamYs = [yMouth - 26 * s, yMouth - 8 * s, yMouth + 14 * s];
  const necklaceLeft = Array.from({ length: 7 }, (_, i) => ({ x: cl + 10 * s + i * 7 * s, y: yRock + 20 * s + i * 11 * s }));
  const necklaceRight = Array.from({ length: 6 }, (_, i) => ({ x: cr - 12 * s - i * 6 * s, y: yRock + 60 * s + i * 10 * s }));

  const labelX = W - (phone ? 22 : 30);
  const tickX0 = cr;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      width="100%"
      className={className}
      preserveAspectRatio="xMidYMin meet"
      role="img"
      aria-label="Separation Creek, from the bridge down to the creek mouth"
      style={{ display: 'block', fontFamily: 'var(--sck-font-ui)' }}
    >
      <defs>
        <linearGradient id={id('sky')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#07141d" />
          <stop offset="0.7" stopColor="#0b1d2a" />
          <stop offset="1" stopColor="#163447" />
        </linearGradient>
        {/* almost-pixel: the water is flat quantized bands (see steppedBandPath), not a gradient */}
        <radialGradient id={id('lamp')} cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd27a" stopOpacity="0.85" />
          <stop offset="0.4" stopColor="#ffd27a" stopOpacity="0.28" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={id('cone')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd27a" stopOpacity="0.22" />
          <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={id('shaft')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7ee8fa" stopOpacity="0.12" />
          <stop offset="1" stopColor="#7ee8fa" stopOpacity="0" />
        </linearGradient>
        <clipPath id={id('channel')}>
          <rect x={cl} y={g.waterTop} width={cw} height={yBottom - g.waterTop} />
        </clipPath>
        <clipPath id={id('watershape')}>
          <path d={waterPath} />
        </clipPath>
        <clipPath id={id('deep')}>
          <rect x={0} y={yMouth} width={W} height={yBottom - yMouth} />
        </clipPath>
        {/* tree fern symbol: trunk + crown of six fronds */}
        <symbol id={id('fern')} viewBox="0 0 100 100" overflow="visible">
          <rect x={46} y={52} width={8} height={48} rx={3} fill="#4a3a2c" />
          <g fill="#2f6b45" stroke="#1e4731" strokeWidth={1.5} strokeLinejoin="round">
            <path d="M50 54 C36 46 14 46 4 34 C22 36 40 42 50 54 Z" />
            <path d="M50 54 C64 46 86 46 96 34 C78 36 60 42 50 54 Z" />
            <path d="M50 54 C44 40 30 26 14 14 C30 22 44 36 50 54 Z" />
            <path d="M50 54 C56 40 70 26 86 14 C70 22 56 36 50 54 Z" />
            <path d="M50 54 C48 38 46 20 38 4 C46 18 50 36 50 54 Z" />
            <path d="M50 54 C52 38 54 20 62 4 C54 18 50 36 50 54 Z" />
          </g>
          <path d="M50 54 C44 44 34 36 22 28" fill="none" stroke="#4f9a66" strokeWidth={1.2} opacity={0.7} />
          <path d="M50 54 C56 44 66 36 78 28" fill="none" stroke="#4f9a66" strokeWidth={1.2} opacity={0.7} />
        </symbol>
      </defs>

      {/* ---- sky ---- */}
      <rect x={0} y={0} width={W} height={g.waterTop} fill={`url(#${id('sky')})`} />
      {stars.map(([x, y], i) => (
        <circle
          key={i}
          cx={x}
          cy={y}
          r={i % 4 === 0 ? 1.8 : 1.1}
          fill="#f4f1e8"
          className={i % 3 === 0 ? 'sck-anim-twinkle' : undefined}
          style={i % 3 === 0 ? { animationDelay: `${(i * 0.7) % 3}s` } : undefined}
          opacity={0.85}
        />
      ))}
      {/* crescent moon */}
      <circle cx={W * 0.82} cy={phone ? 30 : 44} r={phone ? 11 : 16} fill="#f6ecc8" />
      <circle cx={W * 0.82 + (phone ? 5 : 7)} cy={phone ? 27 : 40} r={phone ? 10 : 14.5} fill="#07141d" />

      {/* distant gully ridge */}
      <path
        d={`M0 ${g.deckTop - 10} C${W * 0.15} ${g.deckTop - 50} ${W * 0.3} ${g.deckTop - 30} ${W * 0.45} ${g.deckTop - 46} C${W * 0.6} ${g.deckTop - 62} ${W * 0.8} ${g.deckTop - 36} ${W} ${g.deckTop - 54} L${W} ${g.waterTop} L0 ${g.waterTop} Z`}
        fill="#13303a"
      />
      {/* gum trunks behind the bridge */}
      {[0.05, 0.11, 0.91, 0.96].map((fx, i) => (
        <g key={i}>
          <rect x={W * fx - 4 * s} y={0} width={8 * s} height={g.deckTop + 30} rx={3} fill="#b9a58e" />
          <rect x={W * fx + 1 * s} y={0} width={3 * s} height={g.deckTop + 30} fill="#7f6d59" opacity={0.6} />
          <ellipse cx={W * fx + (i % 2 ? -14 : 14) * s} cy={22 * s + i * 6} rx={26 * s} ry={16 * s} fill="#1e4731" opacity={0.9} />
          <ellipse cx={W * fx + (i % 2 ? 10 : -10) * s} cy={48 * s + i * 4} rx={20 * s} ry={13 * s} fill="#2f6b45" opacity={0.9} />
        </g>
      ))}

      {/* ---- banks (soil → basalt → sand, tapering out into the mouth) ---- */}
      <path
        d={`M0 ${g.deckBottom} L${cl} ${g.deckBottom} L${cl} ${yBeach + 40 * s} C${cl - 4} ${yMouth - 40 * s} ${cl - 30} ${yMouth} 0 ${yMouth + 30 * s} Z`}
        fill="#1e4731"
      />
      <path
        d={`M${W} ${g.deckBottom} L${cr} ${g.deckBottom} L${cr} ${yBeach + 40 * s} C${cr + 4} ${yMouth - 40 * s} ${cr + 30} ${yMouth} ${W} ${yMouth + 30 * s} Z`}
        fill="#1e4731"
      />
      {/* basalt stretch of the banks */}
      <path d={`M0 ${yRock - 10} L${cl} ${yRock + 6} L${cl} ${yBeach - 6} L0 ${yBeach + 10} Z`} fill="#2b2f36" />
      <path d={`M${W} ${yRock - 10} L${cr} ${yRock + 6} L${cr} ${yBeach - 6} L${W} ${yBeach + 10} Z`} fill="#2b2f36" />
      {/* sand stretch */}
      <path d={`M0 ${yBeach + 10} L${cl} ${yBeach - 6} L${cl} ${yBeach + 40 * s} C${cl - 4} ${yMouth - 40 * s} ${cl - 30} ${yMouth} 0 ${yMouth + 30 * s} Z`} fill="#e9d8b4" />
      <path d={`M${W} ${yBeach + 10} L${cr} ${yBeach - 6} L${cr} ${yBeach + 40 * s} C${cr + 4} ${yMouth - 40 * s} ${cr + 30} ${yMouth} ${W} ${yMouth + 30 * s} Z`} fill="#e9d8b4" />
      <path d={`M0 ${yBeach + 30} L${cl - 6} ${yBeach + 24} M0 ${yBeach + 70} L${cl - 10} ${yBeach + 60}`} stroke="#cdb88e" strokeWidth={2} />
      <path d={`M${W} ${yBeach + 30} L${cr + 6} ${yBeach + 24} M${W} ${yBeach + 70} L${cr + 10} ${yBeach + 60}`} stroke="#cdb88e" strokeWidth={2} />

      {/* ---- water: tannin base + quantized zone bands with stepped edges ---- */}
      <path d={waterPath} fill="#5a3b1e" />
      <g clipPath={`url(#${id('watershape')})`}>
        {bands.map((b) => (
          <path key={b.color} d={steppedBandPath(b.y, b.x0, W, H, bandStep, bandDrop)} fill={b.color} />
        ))}
        {/* sparse dither squares floating above each band edge */}
        {bands.map((b, bi) => (
          <g key={`d${bi}`} fill={b.color}>
            {Array.from({ length: phone ? 7 : 11 }, (_, i) => {
              const x = ((i * 83 + bi * 47) % (W + 40)) - 20;
              const sz = (4 + (i % 2) * 2) * s;
              return <rect key={i} x={x} y={b.y - (12 + (i % 3) * 7) * s} width={sz} height={sz} />;
            })}
          </g>
        ))}
      </g>
      {/* drifting caustic ribbons, clipped to the channel */}
      <g clipPath={`url(#${id('channel')})`} opacity={0.5}>
        <path d={wavePath(g.waterTop + 26 * s, 5 * s, 70 * s, cl - 140, cr + 140)} fill="none" stroke="#f4f1e8" strokeWidth={2} opacity={0.16} className="sck-anim-drift" />
        <path d={wavePath(g.waterTop + 54 * s, 4 * s, 90 * s, cl - 140, cr + 140)} fill="none" stroke="#f4f1e8" strokeWidth={1.5} opacity={0.1} className="sck-anim-drift-back" />
        <path d={wavePath(yBeach + 70 * s, 5 * s, 80 * s, cl - 140, cr + 140)} fill="none" stroke="#f4f1e8" strokeWidth={2} opacity={0.14} className="sck-anim-drift" />
        <path d={wavePath(yBeach + 150 * s, 4 * s, 110 * s, cl - 140, cr + 140)} fill="none" stroke="#f4f1e8" strokeWidth={1.5} opacity={0.1} className="sck-anim-drift-back" />
        <path d={wavePath(yRock + 90 * s, 3 * s, 60 * s, cl - 140, cr + 140)} fill="none" stroke="#7ee8fa" strokeWidth={1.2} opacity={0.12} className="sck-anim-drift-back" />
      </g>
      {/* surface sparkle under the lamp */}
      <path d={`M${g.lampX - 90 * s} ${g.waterTop + 2} L${g.lampX + 90 * s} ${g.waterTop + 2} L${g.lampX + 150 * s} ${g.waterTop + 160 * s} L${g.lampX - 150 * s} ${g.waterTop + 160 * s} Z`} fill={`url(#${id('cone')})`} />
      <rect x={cl} y={g.waterTop} width={cw} height={3} fill="#f4f1e8" opacity={0.35} />

      {/* ---- rock pools ---- */}
      <g>
        {/* basalt ledges jutting into the water */}
        <path d={`M${cl} ${yRock + 30 * s} C${cl + 70 * s} ${yRock + 20 * s} ${cl + 90 * s} ${yRock + 60 * s} ${cl + 40 * s} ${yRock + 80 * s} L${cl} ${yRock + 90 * s} Z`} fill="#2b2f36" />
        <path d={`M${cr} ${yRock + 110 * s} C${cr - 80 * s} ${yRock + 100 * s} ${cr - 90 * s} ${yRock + 150 * s} ${cr - 30 * s} ${yRock + 170 * s} L${cr} ${yRock + 180 * s} Z`} fill="#2b2f36" />
        <path d={`M${cl} ${yBeach - 80 * s} C${cl + 60 * s} ${yBeach - 100 * s} ${cl + 110 * s} ${yBeach - 50 * s} ${cl + 50 * s} ${yBeach - 20 * s} L${cl} ${yBeach - 10 * s} Z`} fill="#3f454f" />
        <path d={`M${cr} ${yBeach - 60 * s} C${cr - 60 * s} ${yBeach - 70 * s} ${cr - 80 * s} ${yBeach - 30 * s} ${cr - 20 * s} ${yBeach - 12 * s} L${cr} ${yBeach - 8 * s} Z`} fill="#3f454f" />
        {/* Neptune's necklace */}
        {[...necklaceLeft, ...necklaceRight].map((b, i) => (
          <circle key={i} cx={b.x} cy={b.y} r={3.2 * s} fill="#6b6a2e" stroke="#3f3f1c" strokeWidth={0.8} />
        ))}
        {/* anemones */}
        {anemones.map((a, i) => (
          <g key={i} className="sck-anim-sway" style={{ animationDuration: `${6 + i}s`, animationDelay: `${i * 0.6}s` }}>
            {Array.from({ length: 12 }, (_, k) => {
              const ang = (k / 12) * Math.PI * 2;
              return (
                <line
                  key={k}
                  x1={a.x}
                  y1={a.y}
                  x2={a.x + Math.cos(ang) * a.r * 1.9}
                  y2={a.y + Math.sin(ang) * a.r * 1.9}
                  stroke={a.c}
                  strokeWidth={2.4 * s}
                  strokeLinecap="round"
                  opacity={0.9}
                />
              );
            })}
            <circle cx={a.x} cy={a.y} r={a.r} fill={a.c} stroke="#9a4a36" strokeWidth={1.2} />
            <circle cx={a.x} cy={a.y} r={a.r * 0.45} fill="#9a4a36" opacity={0.7} />
          </g>
        ))}
        {seaStars.map((st, i) => (
          <g key={i} transform={`rotate(${i * 37} ${st.x} ${st.y})`}>
            <path d={starPath(st.x, st.y, st.r, st.r * 0.45)} fill={st.c} stroke="#9a4a36" strokeWidth={1.2} strokeLinejoin="round" />
          </g>
        ))}
        {/* crab */}
        <g transform={`translate(${cl + cw * 0.68} ${yRock + (yBeach - yRock) * 0.3}) scale(${0.5 * s})`}>
          <path d="M-10 6 L-24 14 L-28 26 M-6 12 L-20 24 M10 6 L24 14 L28 26 M6 12 L20 24" fill="none" stroke="#d9643a" strokeWidth={4} strokeLinecap="round" />
          <path d="M-14 -2 C-26 -8 -34 0 -28 8 L-16 4 Z M14 -2 C26 -8 34 0 28 8 L16 4 Z" fill="#d9643a" stroke="#8c3a1c" strokeWidth={2} />
          <ellipse cx={0} cy={4} rx={16} ry={11} fill="#d9643a" stroke="#8c3a1c" strokeWidth={2} />
          <circle cx={-6} cy={-6} r={2.5} fill="#1a1a1a" />
          <circle cx={6} cy={-6} r={2.5} fill="#1a1a1a" />
        </g>
      </g>

      {/* ---- beach ---- */}
      <g>
        {/* sand bars */}
        <path d={`M${cl} ${yBeach + 60 * s} C${cl + 80 * s} ${yBeach + 40 * s} ${cl + 140 * s} ${yBeach + 90 * s} ${cl + 60 * s} ${yBeach + 120 * s} L${cl} ${yBeach + 130 * s} Z`} fill="#e9d8b4" opacity={0.9} />
        <path d={`M${cr} ${yBeach + 150 * s} C${cr - 90 * s} ${yBeach + 130 * s} ${cr - 150 * s} ${yBeach + 190 * s} ${cr - 60 * s} ${yBeach + 220 * s} L${cr} ${yBeach + 230 * s} Z`} fill="#e9d8b4" opacity={0.9} />
        {/* ripples */}
        {[0.25, 0.45, 0.62, 0.8].map((f, i) => (
          <path key={i} d={wavePath(yBeach + (yMouth - yBeach) * f, 3 * s, 40 * s, cl + 20 * s, cr - 20 * s)} fill="none" stroke="#f4f1e8" strokeWidth={1.4} opacity={0.22} />
        ))}
        {/* dune grass tufts */}
        {[cl + 14 * s, cl + 30 * s, cr - 18 * s, cr - 36 * s].map((x, i) => (
          <path
            key={i}
            d={`M${x} ${yBeach + 8} C${x - 6 * s} ${yBeach - 14 * s} ${x - 8 * s} ${yBeach - 26 * s} ${x - 10 * s} ${yBeach - 34 * s} M${x} ${yBeach + 8} C${x + 2 * s} ${yBeach - 16 * s} ${x + 4 * s} ${yBeach - 30 * s} ${x + 3 * s} ${yBeach - 40 * s} M${x} ${yBeach + 8} C${x + 8 * s} ${yBeach - 10 * s} ${x + 12 * s} ${yBeach - 20 * s} ${x + 14 * s} ${yBeach - 28 * s}`}
            fill="none"
            stroke="#8fa36b"
            strokeWidth={1.6 * s}
            strokeLinecap="round"
            className="sck-anim-sway"
            style={{ animationDuration: `${5 + i}s` }}
          />
        ))}
        {/* driftwood */}
        <g transform={`translate(${cl + cw * 0.3} ${yBeach + 100 * s}) rotate(-12)`}>
          <rect x={-40 * s} y={-5 * s} width={80 * s} height={10 * s} rx={5 * s} fill="#8f8674" stroke="#6c6558" strokeWidth={1.2} />
          <path d={`M${-30 * s} ${-5 * s} L${-38 * s} ${-16 * s} M${18 * s} ${-4 * s} L${26 * s} ${-14 * s}`} stroke="#8f8674" strokeWidth={5 * s} strokeLinecap="round" />
        </g>
      </g>

      {/* ---- surf line at the mouth ---- */}
      <g>
        {foamYs.map((y, i) => (
          <path
            key={i}
            d={wavePath(y, (6 - i) * s, (70 + i * 20) * s, 0, W)}
            fill="none"
            stroke="#f4f1e8"
            strokeWidth={(5 - i) * s}
            strokeLinecap="round"
            opacity={0.7 - i * 0.18}
            className="sck-anim-foam"
            style={{ animationDuration: `${5 + i * 1.5}s`, animationDelay: `${i * -1.3}s` }}
          />
        ))}
      </g>

      {/* ---- trench ---- */}
      <g clipPath={`url(#${id('deep')})`}>
        <rect x={cl + cw * 0.25} y={yMouth} width={cw * 0.3} height={(yBottom - yMouth) * 0.9} fill={`url(#${id('shaft')})`} />
        {kelp.map((k, i) => (
          <g key={i} className="sck-anim-sway" style={{ animationDuration: `${k.dur}s`, animationDelay: `${i * -1.7}s` }}>
            <path
              d={`M${k.x} ${yBottom + 4} C${k.x - k.w} ${yBottom - k.h * 0.3} ${k.x + k.w} ${yBottom - k.h * 0.6} ${k.x - k.w * 0.4} ${yBottom - k.h}`}
              fill="none"
              stroke="#1f5a46"
              strokeWidth={k.w * 0.9}
              strokeLinecap="round"
            />
            <path
              d={`M${k.x} ${yBottom + 4} C${k.x - k.w} ${yBottom - k.h * 0.3} ${k.x + k.w} ${yBottom - k.h * 0.6} ${k.x - k.w * 0.4} ${yBottom - k.h}`}
              fill="none"
              stroke="#3b8a66"
              strokeWidth={k.w * 0.3}
              strokeLinecap="round"
              opacity={0.7}
            />
          </g>
        ))}
        {specks.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={p.r}
            fill="#7ee8fa"
            className="sck-anim-twinkle"
            style={{ animationDelay: `${p.d}s`, animationDuration: `${2.4 + (i % 4) * 0.6}s` }}
          />
        ))}
        {/* sea floor */}
        <path d={`M0 ${yBottom + 6} C${W * 0.2} ${yBottom - 10} ${W * 0.4} ${yBottom + 8} ${W * 0.6} ${yBottom - 6} C${W * 0.8} ${yBottom - 16} ${W * 0.9} ${yBottom + 4} ${W} ${yBottom - 2} L${W} ${H} L0 ${H} Z`} fill="#041319" />
      </g>

      {/* ---- bridge ---- */}
      <g>
        {/* piers */}
        {g.pierX.map((px, i) => (
          <g key={i}>
            <rect x={px - g.pierWidth / 2} y={g.deckBottom - 2} width={g.pierWidth} height={g.waterTop - g.deckBottom + 14 * s} fill="#cfc6b4" />
            <rect x={px + g.pierWidth / 2 - g.pierWidth * 0.35} y={g.deckBottom - 2} width={g.pierWidth * 0.35} height={g.waterTop - g.deckBottom + 14 * s} fill="#8f8674" />
            <rect x={px - g.pierWidth / 2 - 4 * s} y={g.waterTop - 4 * s} width={g.pierWidth + 8 * s} height={10 * s} fill="#3a2614" opacity={0.8} />
          </g>
        ))}
        {/* under-deck shadow */}
        <rect x={0} y={g.deckBottom} width={W} height={10 * s} fill="#6c6558" />
        {/* deck */}
        <rect x={0} y={g.deckTop} width={W} height={g.deckBottom - g.deckTop} fill="#cfc6b4" />
        <rect x={0} y={g.deckTop} width={W} height={5 * s} fill="#3a3f45" />
        <path d={`M0 ${g.deckTop + 2.5 * s} L${W} ${g.deckTop + 2.5 * s}`} stroke="#f4f1e8" strokeWidth={1.2 * s} strokeDasharray={`${14 * s} ${12 * s}`} opacity={0.8} />
        {/* railing */}
        <rect x={0} y={g.deckTop - 18 * s} width={W} height={3 * s} fill="#8f8674" />
        <rect x={0} y={g.deckTop - 9 * s} width={W} height={2 * s} fill="#8f8674" opacity={0.8} />
        {Array.from({ length: phone ? 12 : 16 }, (_, i) => (
          <rect key={i} x={(i + 0.5) * (W / (phone ? 12 : 16)) - 1.5 * s} y={g.deckTop - 18 * s} width={3 * s} height={18 * s} fill="#8f8674" />
        ))}
        {/* lamp */}
        <rect x={g.lampX - 2.5 * s} y={g.deckTop - 70 * s} width={5 * s} height={70 * s} fill="#6c6558" />
        <path d={`M${g.lampX} ${g.deckTop - 70 * s} L${g.lampX + 22 * s} ${g.deckTop - 76 * s}`} stroke="#6c6558" strokeWidth={4 * s} strokeLinecap="round" />
        <circle cx={g.lampX + 24 * s} cy={g.deckTop - 76 * s} r={70 * s} fill={`url(#${id('lamp')})`} className="sck-anim-shimmer" style={{ animationDuration: '5s' }} />
        <path d={`M${g.lampX + 16 * s} ${g.deckTop - 80 * s} L${g.lampX + 32 * s} ${g.deckTop - 80 * s} L${g.lampX + 28 * s} ${g.deckTop - 70 * s} L${g.lampX + 20 * s} ${g.deckTop - 70 * s} Z`} fill="#ffd27a" stroke="#e2a93c" strokeWidth={1.2} />
      </g>

      {/* ---- ferns on the banks ---- */}
      {ferns.map((f, i) => (
        <use
          key={i}
          href={`#${id('fern')}`}
          x={f.x}
          y={f.y}
          width={f.sz}
          height={f.sz}
          transform={f.flip ? `translate(${2 * f.x + f.sz} 0) scale(-1 1)` : undefined}
        />
      ))}

      {/* ---- zone labels ---- */}
      {showZoneLabels ? (
        <g style={{ fontFamily: 'var(--sck-font-pixel)' }}>
          {[0, ...ZONES.slice(1).map((z) => z.from), maxDepth].map((m, i) => (
            <g key={i}>
              <line x1={tickX0 - 10 * s} y1={zY(m)} x2={W} y2={zY(m)} stroke="#f4f1e8" strokeWidth={1} opacity={0.35} strokeDasharray={m === 0 || m === maxDepth ? undefined : '3 4'} />
              <rect x={W - (phone ? 38 : 50)} y={zY(m) - g.labelFont * 0.85} width={phone ? 36 : 48} height={g.labelFont * 1.5} rx={1} fill="rgba(6,32,43,0.78)" stroke="rgba(244,241,232,0.25)" strokeWidth={1} />
              <text x={W - (phone ? 20 : 26)} y={zY(m) + g.labelFont * 0.3} textAnchor="middle" fontSize={g.labelFont} fontWeight={600} fill="#f4f1e8">
                {m} m
              </text>
            </g>
          ))}
          {ZONES.map((z) => {
            const y0 = zY(z.from);
            const y1 = zY(Math.min(z.to, maxDepth));
            const mid = (y0 + y1) / 2;
            const label = z.label.replace(/^The /, '').toUpperCase();
            const fs = g.labelFont + 1;
            const pillLen = label.length * fs * 0.78 + 18;
            return (
              <g key={z.id} transform={`rotate(-90 ${labelX} ${mid})`}>
                <rect x={labelX - pillLen / 2} y={mid - fs * 0.95} width={pillLen} height={fs * 1.7} rx={1} fill="rgba(6,32,43,0.72)" stroke="rgba(244,241,232,0.25)" strokeWidth={1} />
                <text x={labelX} y={mid + fs * 0.32} textAnchor="middle" fontSize={fs} fontWeight={700} letterSpacing={1.5} fill="#f4f1e8" opacity={0.9}>
                  {label}
                </text>
              </g>
            );
          })}
        </g>
      ) : null}

      {/* ---- players ---- */}
      <g>
        {laid.map(({ player, x, y, onDeck }) => {
          const hl = player.id === highlightPlayerId;
          const size = g.avatarSize;
          const showName = hl || showAllNames;
          const nameW = Math.max(28, player.name.length * (g.labelFont * 0.62) + 14);
          return (
            <g
              key={player.id}
              className="sck-marker"
              style={{ transform: `translate(${x}px, ${y}px)`, opacity: player.connected ? 1 : 0.5 }}
            >
              {!onDeck ? (
                <circle r={size / 2 + 5} fill="rgba(244,241,232,0.16)" stroke="rgba(244,241,232,0.45)" strokeWidth={1.2} />
              ) : null}
              {hl ? <circle r={size / 2 + 6} fill="none" stroke="#ffd27a" strokeWidth={3} className="sck-anim-pulse" /> : null}
              {hl ? <circle r={size / 2 + 6} fill="none" stroke="#ffd27a" strokeWidth={2.5} /> : null}
              <g transform={`translate(${-size / 2} ${-size / 2})`}>
                <Avatar id={player.avatar} size={size} ring={!onDeck || hl} />
              </g>
              {showName ? (
                <g transform={`translate(0 ${size / 2 + 6})`}>
                  <rect x={-nameW / 2} y={0} width={nameW} height={g.labelFont * 1.6} rx={1} fill="rgba(6,32,43,0.82)" stroke={hl ? '#ffd27a' : 'rgba(244,241,232,0.25)'} strokeWidth={1} />
                  <text x={0} y={g.labelFont * 1.15} textAnchor="middle" fontSize={g.labelFont} fontWeight={700} fill="#f4f1e8" style={{ fontFamily: 'var(--sck-font-pixel)' }}>
                    {player.name}
                  </text>
                </g>
              ) : null}
            </g>
          );
        })}
      </g>
    </svg>
  );
}
