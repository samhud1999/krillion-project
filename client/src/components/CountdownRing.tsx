import type { ReactNode } from 'react';

export interface CountdownRingProps {
  /** 1 = full, 0 = empty */
  fraction: number;
  seconds: number;
  size?: number;
  strokeWidth?: number;
  /** turn amber below this many seconds */
  warnAt?: number;
  done?: boolean;
  className?: string;
  children?: ReactNode;
  label?: string;
}

export function CountdownRing({
  fraction,
  seconds,
  size = 120,
  strokeWidth = 10,
  warnAt = 5,
  done,
  className = '',
  children,
  label,
}: CountdownRingProps) {
  const r = (size - strokeWidth) / 2;
  const c = 2 * Math.PI * r;
  const f = Math.min(1, Math.max(0, fraction));
  const warn = !done && seconds <= warnAt;
  const colour = done ? 'var(--color-rose-400, #fb7185)' : warn ? '#fbbf24' : 'var(--creek-300)';
  return (
    <div
      className={['relative inline-flex items-center justify-center', done ? 'animate-shake' : '', className].join(' ')}
      style={{ width: size, height: size }}
      role="timer"
      aria-live="off"
      aria-label={label ?? `${seconds} seconds left`}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={strokeWidth} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={colour}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          style={{ transition: 'stroke 300ms ease' }}
        />
      </svg>
      <div
        className={['absolute inset-0 flex flex-col items-center justify-center tabular display font-bold', warn ? 'text-amber-300' : 'text-foam'].join(' ')}
        style={{ fontSize: size * 0.34, lineHeight: 1 }}
      >
        {children ?? (done ? '0' : seconds)}
      </div>
    </div>
  );
}
