import { useId } from 'react';
import type { RoomPhase, ZoneId } from '@shared/types';
import './tokens.css';

export interface BackdropProps {
  zone: ZoneId;
  phase?: RoomPhase;
  className?: string;
}

const FERN_FRONDS =
  'M50 54 C36 46 14 46 4 34 C22 36 40 42 50 54 Z M50 54 C64 46 86 46 96 34 C78 36 60 42 50 54 Z M50 54 C44 40 30 26 14 14 C30 22 44 36 50 54 Z M50 54 C56 40 70 26 86 14 C70 22 56 36 50 54 Z M50 54 C48 38 46 20 38 4 C46 18 50 36 50 54 Z M50 54 C52 38 54 20 62 4 C54 18 50 36 50 54 Z';

// The viewBox is 16:9 (1600×900) and is "sliced" to cover the element, so on a
// TV the whole picture shows and on a portrait phone the centre third does.
// Decorations therefore run along the full bottom edge and the glow sits top-centre.
const VW = 1600;
const VH = 900;

/**
 * Full-bleed animated background for a zone. Render it inside a
 * `position: relative` parent; it fills the parent and sits behind content.
 */
export function Backdrop({ zone, phase, className }: BackdropProps) {
  const uid = useId().replace(/[:]/g, '');
  const id = (s: string) => `sck-bd-${s}-${uid}`;
  const intense = phase === 'reveal' || phase === 'results';
  const style: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    width: '100%',
    height: '100%',
    display: 'block',
    pointerEvents: 'none',
  };
  const common = {
    className,
    style,
    viewBox: `0 0 ${VW} ${VH}`,
    preserveAspectRatio: 'xMidYMid slice' as const,
    'aria-hidden': true as const,
  };

  if (zone === 'bridge') {
    const ferns: [number, number, number][] = [];
    for (let i = 0; i < 14; i++) {
      const x = -60 + i * 125 + ((i * 37) % 40);
      const sz = 200 + ((i * 53) % 90);
      ferns.push([x, VH - sz * 0.62 - ((i * 29) % 40), sz]);
    }
    return (
      <svg {...common}>
        <defs>
          <linearGradient id={id('g')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#07151e" />
            <stop offset="0.55" stopColor="#0b1d2a" />
            <stop offset="1" stopColor="#173a4b" />
          </linearGradient>
          <radialGradient id={id('lamp')} cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stopColor="#ffd27a" stopOpacity="0.6" />
            <stop offset="0.45" stopColor="#ffd27a" stopOpacity="0.14" />
            <stop offset="1" stopColor="#ffd27a" stopOpacity="0" />
          </radialGradient>
          <symbol id={id('fern')} viewBox="0 0 100 100" overflow="visible">
            <rect x={46} y={52} width={8} height={70} rx={3} fill="#0d2318" />
            <path d={FERN_FRONDS} fill="#15402a" />
            <path d={FERN_FRONDS} fill="none" stroke="#1f5a3a" strokeWidth={0.8} />
          </symbol>
        </defs>
        <rect width={VW} height={VH} fill={`url(#${id('g')})`} />
        {Array.from({ length: 40 }, (_, i) => (
          <circle
            key={i}
            cx={(i * 397) % VW}
            cy={(i * 173) % 480}
            r={i % 5 === 0 ? 2.4 : 1.4}
            fill="#f4f1e8"
            opacity={0.85}
            className={i % 4 === 0 ? 'sck-anim-twinkle' : undefined}
            style={i % 4 === 0 ? { animationDelay: `${(i * 0.9) % 4}s`, animationDuration: '4s' } : undefined}
          />
        ))}
        <circle cx={1310} cy={120} r={40} fill="#f6ecc8" />
        <circle cx={1328} cy={108} r={36} fill="#07151e" />
        <circle cx={800} cy={60} r={520} fill={`url(#${id('lamp')})`} className="sck-anim-shimmer" style={{ animationDuration: '6s' }} />
        {/* distant ridge */}
        <path d="M0 640 C160 580 300 630 460 570 C620 510 760 590 940 540 C1120 490 1260 560 1400 520 C1480 498 1540 520 1600 500 L1600 900 L0 900 Z" fill="#0c2531" />
        {/* a second, nearer ridge */}
        <path d="M0 740 C200 700 340 760 520 720 C700 680 860 740 1040 700 C1220 660 1380 720 1600 680 L1600 900 L0 900 Z" fill="#0a1f28" />
        {ferns.map(([x, y, sz], i) => (
          <use key={i} href={`#${id('fern')}`} x={x} y={y} width={sz} height={sz} transform={i % 2 ? `translate(${2 * x + sz} 0) scale(-1 1)` : undefined} />
        ))}
        <rect width={VW} height={VH} fill="#000" opacity={intense ? 0.1 : 0} />
      </svg>
    );
  }

  if (zone === 'rockpools') {
    const anemones: [number, number, number][] = [
      [90, 840, 40], [300, 820, 30], [520, 850, 44], [760, 830, 34], [980, 845, 40], [1200, 825, 30], [1420, 850, 42], [1560, 835, 28],
    ];
    return (
      <svg {...common}>
        <defs>
          <linearGradient id={id('g')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#24454b" />
            <stop offset="1" stopColor="#0d2227" />
          </linearGradient>
        </defs>
        <rect width={VW} height={VH} fill={`url(#${id('g')})`} />
        {/* caustics */}
        {[0.18, 0.32, 0.46].map((f, i) => (
          <path
            key={i}
            d={`M-120 ${f * VH} Q-60 ${f * VH - 16} 0 ${f * VH} ${Array.from({ length: 15 }, (_, k) => `T${(k + 1) * 120} ${f * VH}`).join(' ')}`}
            fill="none"
            stroke="#7ee8fa"
            strokeWidth={2}
            opacity={0.09}
            className={i % 2 ? 'sck-anim-drift-back' : 'sck-anim-drift'}
          />
        ))}
        {/* basalt shelves */}
        <path d="M0 780 C200 740 360 800 560 760 C760 720 920 800 1140 760 C1340 724 1460 780 1600 750 L1600 900 L0 900 Z" fill="#1c2026" />
        <path d="M0 850 C240 820 420 870 680 840 C940 810 1100 870 1600 830 L1600 900 L0 900 Z" fill="#121519" />
        {anemones.map(([x, y, r], i) => (
          <g key={i} className="sck-anim-sway" style={{ animationDuration: `${7 + (i % 4)}s`, animationDelay: `${i * -0.8}s` }}>
            {Array.from({ length: 13 }, (_, k) => {
              const ang = Math.PI + (k / 12) * Math.PI;
              return <line key={k} x1={x} y1={y} x2={x + Math.cos(ang) * r * 1.9} y2={y + Math.sin(ang) * r * 1.9} stroke="#b35a46" strokeWidth={6} strokeLinecap="round" opacity={0.9} />;
            })}
            <circle cx={x} cy={y} r={r} fill="#c9674f" />
            <circle cx={x} cy={y} r={r * 0.45} fill="#8a3d2e" opacity={0.8} />
          </g>
        ))}
        {/* sea stars on the shelf */}
        {[[220, 870], [860, 880], [1330, 875]].map(([x, y], i) => (
          <path
            key={i}
            d={`M${x} ${y! - 22} L${x! + 7} ${y! - 7} L${x! + 22} ${y! - 6} L${x! + 11} ${y! + 4} L${x! + 14} ${y! + 19} L${x} ${y! + 11} L${x! - 14} ${y! + 19} L${x! - 11} ${y! + 4} L${x! - 22} ${y! - 6} L${x! - 7} ${y! - 7} Z`}
            fill="#e07a5f"
            opacity={0.85}
          />
        ))}
        {/* slow bubbles */}
        {Array.from({ length: 14 }, (_, i) => (
          <circle
            key={i}
            cx={60 + i * 112}
            cy={VH - 40}
            r={4 + (i % 3) * 3}
            fill="none"
            stroke="#7ee8fa"
            strokeWidth={1.6}
            opacity={0.55}
            className="sck-anim-rise"
            style={{ animationDuration: `${7 + (i % 4) * 2}s`, animationDelay: `${(i * 1.3) % 7}s` }}
          />
        ))}
        <rect width={VW} height={VH} fill="#7ee8fa" opacity={intense ? 0.04 : 0} />
      </svg>
    );
  }

  if (zone === 'beach') {
    return (
      <svg {...common}>
        <defs>
          <linearGradient id={id('g')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#0f4c5c" />
            <stop offset="0.6" stopColor="#1d6b76" />
            <stop offset="1" stopColor="#2f8f9d" />
          </linearGradient>
          <linearGradient id={id('sand')} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#cdb88e" />
            <stop offset="1" stopColor="#e9d8b4" />
          </linearGradient>
        </defs>
        <rect width={VW} height={VH} fill={`url(#${id('g')})`} />
        {[0.2, 0.34, 0.48, 0.62].map((f, i) => (
          <path
            key={i}
            d={`M-120 ${f * VH} Q-60 ${f * VH - 14} 0 ${f * VH} ${Array.from({ length: 15 }, (_, k) => `T${(k + 1) * 120} ${f * VH}`).join(' ')}`}
            fill="none"
            stroke="#f4f1e8"
            strokeWidth={2}
            opacity={0.12}
            className={i % 2 ? 'sck-anim-drift-back' : 'sck-anim-drift'}
          />
        ))}
        {/* sand along the bottom */}
        <path d="M0 790 C240 750 400 810 640 780 C880 750 1040 800 1280 770 C1420 752 1520 780 1600 760 L1600 900 L0 900 Z" fill={`url(#${id('sand')})`} />
        {/* dune grass */}
        {[120, 420, 760, 1120, 1480].map((x, i) => (
          <path
            key={i}
            d={`M${x} 800 C${x - 10} 770 ${x - 14} 750 ${x - 18} 730 M${x} 800 C${x + 3} 768 ${x + 6} 746 ${x + 4} 724 M${x} 800 C${x + 12} 776 ${x + 18} 760 ${x + 22} 744`}
            fill="none"
            stroke="#8fa36b"
            strokeWidth={3}
            strokeLinecap="round"
            className="sck-anim-sway"
            style={{ animationDuration: `${5 + i}s` }}
          />
        ))}
        {/* foam lines sliding along the sand edge */}
        {[0, 1, 2].map((i) => (
          <path
            key={i}
            d={`M-80 ${776 + i * 12} C240 ${736 + i * 14} 400 ${796 + i * 12} 640 ${766 + i * 14} C880 ${736 + i * 14} 1040 ${786 + i * 12} 1280 ${756 + i * 14} C1420 ${738 + i * 14} 1520 ${766 + i * 12} 1680 ${746 + i * 14}`}
            fill="none"
            stroke="#f4f1e8"
            strokeWidth={7 - i * 2}
            strokeLinecap="round"
            opacity={0.8 - i * 0.22}
            className="sck-anim-foam"
            style={{ animationDuration: `${5 + i * 1.6}s`, animationDelay: `${i * -1.4}s` }}
          />
        ))}
        <rect width={VW} height={VH} fill="#000" opacity={intense ? 0.06 : 0} />
      </svg>
    );
  }

  // mouth
  const kelp: [number, number, number, number][] = [
    [60, 520, 26, 7], [150, 380, 18, 9], [300, 300, 16, 10], [620, 260, 14, 11], [980, 280, 14, 9], [1280, 340, 18, 10], [1440, 600, 28, 8], [1540, 420, 20, 11],
  ];
  return (
    <svg {...common}>
      <defs>
        <linearGradient id={id('g')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0f4c5c" />
          <stop offset="0.5" stopColor="#083644" />
          <stop offset="1" stopColor="#06202b" />
        </linearGradient>
        <linearGradient id={id('shaft')} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#7ee8fa" stopOpacity="0.16" />
          <stop offset="1" stopColor="#7ee8fa" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width={VW} height={VH} fill={`url(#${id('g')})`} />
      <polygon points="640,0 960,0 1120,700 480,700" fill={`url(#${id('shaft')})`} className="sck-anim-shimmer" style={{ animationDuration: '8s' }} />
      <polygon points="300,0 420,0 560,600 200,600" fill={`url(#${id('shaft')})`} className="sck-anim-shimmer" style={{ animationDuration: '11s', animationDelay: '-3s' }} />
      {kelp.map(([x, h, w, dur], i) => (
        <g key={i} className="sck-anim-sway" style={{ animationDuration: `${dur}s`, animationDelay: `${i * -1.5}s` }}>
          <path d={`M${x} ${VH + 10} C${x - w} ${VH - h * 0.3} ${x + w} ${VH - h * 0.6} ${x - w * 0.4} ${VH - h}`} fill="none" stroke="#1f5a46" strokeWidth={w} strokeLinecap="round" />
          <path d={`M${x} ${VH + 10} C${x - w} ${VH - h * 0.3} ${x + w} ${VH - h * 0.6} ${x - w * 0.4} ${VH - h}`} fill="none" stroke="#3b8a66" strokeWidth={w * 0.3} strokeLinecap="round" opacity={0.7} />
        </g>
      ))}
      <path d="M0 880 C300 860 500 892 800 870 C1100 848 1300 884 1600 866 L1600 900 L0 900 Z" fill="#041319" />
      {Array.from({ length: 36 }, (_, i) => (
        <circle
          key={i}
          cx={(i * 331) % VW}
          cy={160 + ((i * 211) % 700)}
          r={1.6 + (i % 3)}
          fill="#7ee8fa"
          className="sck-anim-twinkle"
          style={{ animationDelay: `${(i * 0.47) % 3}s`, animationDuration: `${2.4 + (i % 4) * 0.7}s` }}
        />
      ))}
      <rect width={VW} height={VH} fill="#7ee8fa" opacity={intense ? 0.05 : 0} />
    </svg>
  );
}
