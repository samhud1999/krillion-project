/**
 * The float-down. A camera-follow cinematic for the phone reveal: your avatar
 * hangs in the middle of the viewport while a tall almost-pixel "world" —
 * the whole creek from the bridge to the trench, with everyone else's bubbles
 * parked at their depths — scrolls past behind you. Duration scales with the
 * metres gained; a Krillion gets the gold burst and a krill escort.
 *
 * Tap to skip. prefers-reduced-motion jumps straight to the end state.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { AvatarId, PlayerPublic, TierId } from '@shared/types';
import { MAX_DEPTH } from '@shared/types';
import { ZONES } from '@shared/theme';
import { Avatar } from './Avatar';
import './tokens.css';

export interface DescentSceneProps {
  avatar: AvatarId;
  depthBefore: number;
  depthAfter: number;
  tier: TierId;
  /** everyone else, drawn at their (settled) depths so you float past them */
  others?: PlayerPublic[];
  /** replay the cinematic when this changes (round index) */
  replayKey: number;
  maxDepth?: number;
  className?: string;
}

// world geometry (SVG units). 3 units per metre keeps a 100 m drop ≈ one viewport.
const W = 360;
const SKY_H = 150;
const PX_PER_M = 3;

function yFor(depth: number, maxDepth: number): number {
  if (depth <= 0) return SKY_H - 26; // treading water at the surface
  return SKY_H + Math.min(depth, maxDepth) * PX_PER_M;
}

/** square-wave band edge, same move as CreekScene */
function stepEdge(yEdge: number, step: number, drop: number): string {
  let d = `M0 ${yEdge}`;
  let x = 0;
  let down = true;
  while (x < W) {
    const nx = Math.min(x + step, W);
    d += ` H${nx}`;
    if (nx < W) {
      d += ` v${down ? drop : -drop}`;
      down = !down;
    }
    x = nx;
  }
  return d;
}

const BAND_COLORS: Record<string, string> = {
  bridge: '#5a3b1e',
  rockpools: '#1f3a3f',
  beach: '#2f8f9d',
  mouth: '#0f4c5c',
};

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function DescentScene({
  avatar,
  depthBefore,
  depthAfter,
  tier,
  others = [],
  replayKey,
  maxDepth = MAX_DEPTH,
  className,
}: DescentSceneProps) {
  const worldH = SKY_H + maxDepth * PX_PER_M + 60;
  const points = Math.max(0, depthAfter - depthBefore);
  const duration = prefersReducedMotion() ? 0 : Math.min(3.2, Math.max(0.9, 0.9 + points * 0.022));
  const krillion = tier === 'krillion';

  const viewportRef = useRef<HTMLDivElement>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  const [phase, setPhase] = useState<'start' | 'diving' | 'done'>('start');
  const [shown, setShown] = useState(Math.round(depthBefore));

  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight });
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);

  // kick off the dive one frame after mounting at the start position
  useEffect(() => {
    setPhase('start');
    setShown(Math.round(depthBefore));
    if (duration === 0) {
      setPhase('done');
      setShown(Math.round(depthAfter));
      return;
    }
    const kick = requestAnimationFrame(() => requestAnimationFrame(() => setPhase('diving')));
    const settle = setTimeout(() => setPhase('done'), duration * 1000 + 80);
    return () => {
      cancelAnimationFrame(kick);
      clearTimeout(settle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [replayKey, duration]);

  // the metre ticker, eased to roughly match the CSS transform
  useEffect(() => {
    if (phase !== 'diving') return;
    const from = depthBefore;
    const to = depthAfter;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / (duration * 1000));
      const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; // easeInOutCubic
      setShown(Math.round(from + (to - from) * e));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const depthNow = phase === 'start' ? depthBefore : depthAfter;
  const scale = box.w > 0 ? box.w / W : 1;
  const camY = box.h / 2 - yFor(depthNow, maxDepth) * scale;
  const moving = phase === 'diving' && points > 0;

  // deterministic lanes for the others, keeping the centre clear for me
  const lanes = [52, 118, 244, 310];
  const othersLaid = useMemo(
    () =>
      others
        .filter((p) => p.depth > 0)
        .map((p, i) => ({
          p,
          x: lanes[i % lanes.length]! + ((i * 13) % 3) * 8,
          y: yFor(p.depth, maxDepth) + ((i * 29) % 2) * 14,
        })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [others, maxDepth],
  );

  const zoneEdges = ZONES.slice(1).map((z) => ({ zone: z, y: yFor(z.from, maxDepth) }));
  const yMouth = yFor(ZONES.find((z) => z.id === 'mouth')!.from, maxDepth);
  const yFloor = SKY_H + maxDepth * PX_PER_M;
  const anemoneYs = [0.2, 0.45, 0.7].map((f) => yFor(100 + 200 * f, maxDepth));
  const kelpYs = [0.3, 0.6, 0.85].map((f) => yFor(520 + 180 * f, maxDepth));

  const skip = () => {
    if (phase === 'diving') {
      setPhase('done');
      setShown(Math.round(depthAfter));
    }
  };

  return (
    <div
      ref={viewportRef}
      className={['relative overflow-hidden rounded-none notch bg-[#06131a]', className ?? ''].join(' ')}
      onPointerDown={skip}
      role="img"
      aria-label={`Diving from ${Math.round(depthBefore)} to ${Math.round(depthAfter)} metres`}
    >
      {/* ---- the world ---- */}
      <svg
        viewBox={`0 0 ${W} ${worldH}`}
        width="100%"
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          display: 'block',
          transform: `translate3d(0, ${camY.toFixed(1)}px, 0)`,
          transition: phase === 'diving' ? `transform ${duration}s cubic-bezier(0.34, 0.08, 0.24, 1)` : undefined,
          willChange: 'transform',
        }}
        aria-hidden
      >
        {/* sky, stars, moon, bridge */}
        <rect width={W} height={SKY_H} fill="#0b1d2a" />
        {[[40, 28], [120, 52], [210, 20], [296, 44], [330, 70], [80, 84]].map(([x, y], i) => (
          <rect key={i} x={x} y={y} width={i % 2 ? 4 : 6} height={i % 2 ? 4 : 6} fill={i % 3 ? '#f4f1e8' : '#7ee8fa'} opacity={0.9} />
        ))}
        <rect x={286} y={22} width={22} height={22} fill="#f6ecc8" />
        <rect x={292} y={28} width={22} height={22} fill="#0b1d2a" />
        <rect x={0} y={SKY_H - 46} width={W} height={7} fill="#55504a" />
        <rect x={0} y={SKY_H - 39} width={W} height={12} fill="#3c3730" />
        <rect x={64} y={SKY_H - 27} width={12} height={27} fill="#2b2f36" />
        <rect x={284} y={SKY_H - 27} width={12} height={27} fill="#2b2f36" />
        {/* waterline */}
        <rect x={0} y={SKY_H} width={W} height={3} fill="#f4f1e8" opacity={0.4} />

        {/* water: tannin base + stepped zone bands + floor */}
        <rect x={0} y={SKY_H} width={W} height={worldH - SKY_H} fill={BAND_COLORS.bridge} />
        {zoneEdges.map(({ zone, y }) => (
          <path key={zone.id} d={`${stepEdge(y, 30, 6)} V${worldH} H0 Z`} fill={BAND_COLORS[zone.id] ?? '#0f4c5c'} />
        ))}
        <path d={`${stepEdge(yMouth + (yFloor - yMouth) * 0.55, 34, 6)} V${worldH} H0 Z`} fill="#06202b" />
        {/* dither above each edge */}
        {zoneEdges.map(({ zone, y }, bi) => (
          <g key={`d-${zone.id}`} fill={BAND_COLORS[zone.id] ?? '#0f4c5c'}>
            {Array.from({ length: 7 }, (_, i) => {
              const x = (i * 53 + bi * 31) % (W - 10);
              return <rect key={i} x={x} y={y - 10 - (i % 3) * 7} width={4 + (i % 2) * 2} height={4 + (i % 2) * 2} />;
            })}
          </g>
        ))}

        {/* zone name pills at each boundary */}
        {zoneEdges.map(({ zone, y }) => {
          const label = zone.label.replace(/^The /, '').toUpperCase();
          const w = label.length * 7.5 + 18;
          return (
            <g key={`z-${zone.id}`} style={{ fontFamily: 'var(--sck-font-pixel)' }}>
              <rect x={W / 2 - w / 2} y={y + 10} width={w} height={18} rx={1} fill="rgba(6,32,43,0.8)" stroke="rgba(244,241,232,0.3)" strokeWidth={1} />
              <text x={W / 2} y={y + 23} textAnchor="middle" fontSize={11} fontWeight={700} letterSpacing={2} fill="#f4f1e8">
                {label}
              </text>
            </g>
          );
        })}

        {/* scenery to float past: basalt ledges + anemones (rock pools) */}
        {anemoneYs.map((y, i) => {
          const left = i % 2 === 0;
          const x = left ? 0 : W;
          const dir = left ? 1 : -1;
          return (
            <g key={`a-${i}`}>
              <path d={`M${x} ${y} h${dir * 54} v-8 h${dir * 16} v-8 h${dir * -16} v-8 h${dir * -54} Z`} fill="#2b2f36" />
              <g className="sck-anim-sway" style={{ animationDuration: `${6 + i}s` }}>
                {Array.from({ length: 10 }, (_, k) => {
                  const ang = (k / 10) * Math.PI * 2;
                  const ax = x + dir * 40;
                  const ay = y - 16;
                  return <line key={k} x1={ax} y1={ay} x2={ax + Math.cos(ang) * 13} y2={ay + Math.sin(ang) * 13} stroke="#e07a5f" strokeWidth={2.6} strokeLinecap="round" />;
                })}
                <circle cx={x + dir * 40} cy={y - 16} r={7} fill="#e07a5f" stroke="#9a4a36" strokeWidth={1.2} />
              </g>
            </g>
          );
        })}
        {/* beach ripples + sand bar */}
        <path d={`M0 ${yFor(380, maxDepth)} h64 v-7 h52 v7 h40 Z`} fill="#e9d8b4" opacity={0.85} />
        <path d={`M${W} ${yFor(460, maxDepth)} h-70 v-7 h-48 v7 h-36 Z`} fill="#e9d8b4" opacity={0.85} />
        {/* kelp + glow in the mouth */}
        {kelpYs.map((y, i) => {
          const x = i % 2 === 0 ? 34 : W - 34;
          return (
            <g key={`k-${i}`} className="sck-anim-sway" style={{ animationDuration: `${8 + i * 2}s` }}>
              <path d={`M${x} ${y + 70} C${x - 12} ${y + 40} ${x + 12} ${y + 24} ${x - 5} ${y}`} fill="none" stroke="#1f5a46" strokeWidth={9} strokeLinecap="round" />
              <path d={`M${x} ${y + 70} C${x - 12} ${y + 40} ${x + 12} ${y + 24} ${x - 5} ${y}`} fill="none" stroke="#3b8a66" strokeWidth={3} strokeLinecap="round" opacity={0.7} />
            </g>
          );
        })}
        {Array.from({ length: 10 }, (_, i) => (
          <circle
            key={`g-${i}`}
            cx={(i * 67) % W}
            cy={yMouth + ((i * 53) % Math.max(1, Math.round(yFloor - yMouth)))}
            r={1.6 + (i % 3)}
            fill="#7ee8fa"
            className="sck-anim-twinkle"
            style={{ animationDelay: `${(i * 0.4) % 3}s` }}
          />
        ))}
        {/* krillion escort: a swarm of pixel krill around the landing spot */}
        {krillion && (
          <g fill="#ff7a5c">
            {Array.from({ length: 9 }, (_, i) => {
              const kx = 70 + ((i * 47) % 220);
              const ky = yFor(depthAfter, maxDepth) + 40 + ((i * 31) % 90) - 45;
              return (
                <g key={i} className="sck-anim-float" style={{ animationDuration: `${3 + (i % 3)}s`, animationDelay: `${i * 0.2}s` }}>
                  <rect x={kx} y={ky} width={9} height={5} />
                  <rect x={kx + 9} y={ky - 2} width={4} height={3} />
                </g>
              );
            })}
          </g>
        )}
        {/* sea floor */}
        <path d={`${stepEdge(yFloor, 40, 5)} V${worldH} H0 Z`} fill="#041319" />

        {/* the rest of the room, parked at their depths */}
        {othersLaid.map(({ p, x, y }) => (
          <g key={p.id} opacity={0.6}>
            <circle cx={x} cy={y} r={15} fill="rgba(244,241,232,0.12)" stroke="rgba(244,241,232,0.35)" strokeWidth={1} />
            <g transform={`translate(${x - 11} ${y - 11})`}>
              <Avatar id={p.avatar} size={22} ring={false} />
            </g>
          </g>
        ))}
      </svg>

      {/* ---- me: fixed to the camera ---- */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2"
        style={{ transform: `translate(-50%, -50%) rotate(${moving ? 7 : 0}deg)`, transition: 'transform 0.5s ease' }}
      >
        <div className={moving ? undefined : 'sck-anim-float'} style={{ position: 'relative' }}>
          {krillion && phase === 'done' && (
            <span
              className="sck-anim-pulse"
              style={{ position: 'absolute', inset: -8, border: '3px solid #ffd27a', borderRadius: 4 }}
              aria-hidden
            />
          )}
          <span
            style={{ position: 'absolute', inset: -6, background: 'rgba(244,241,232,0.14)', border: '1.5px solid rgba(244,241,232,0.45)', borderRadius: 6 }}
            aria-hidden
          />
          <Avatar id={avatar} size={44} />
        </div>
        {/* bubble trail while moving */}
        {moving && (
          <span aria-hidden>
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="sck-anim-rise"
                style={{
                  position: 'absolute',
                  left: 8 + i * 14,
                  top: -6,
                  width: 6 - i,
                  height: 6 - i,
                  background: '#7ee8fa',
                  opacity: 0.8,
                  animationDuration: `${1.2 + i * 0.4}s`,
                }}
              />
            ))}
          </span>
        )}
      </div>

      {/* ---- HUD: depth ticker ---- */}
      <div className="pixel absolute right-2 top-2 rounded-sm border-2 border-[#7ee8fa] bg-[#06131a]/90 px-2 py-0.5 text-sm font-bold text-[#7ee8fa]">
        ▼ {shown}m
      </div>
      {moving && <div className="pixel absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] tracking-widest text-foam-faint">TAP TO SKIP</div>}
    </div>
  );
}
