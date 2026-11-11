import { useEffect, useRef, useState } from 'react';

export interface CountUpProps {
  to: number;
  from?: number;
  durationMs?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  /** restart the animation when this changes */
  replayKey?: string | number;
}

function easeOutCubic(t: number) {
  return 1 - Math.pow(1 - t, 3);
}

export function CountUp({ to, from = 0, durationMs = 900, prefix = '', suffix = '', className = '', replayKey }: CountUpProps) {
  const [value, setValue] = useState(from);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduced || durationMs <= 0) {
      setValue(to);
      return;
    }
    startRef.current = null;
    let raf = 0;
    const tick = (t: number) => {
      if (startRef.current === null) startRef.current = t;
      const p = Math.min(1, (t - startRef.current) / durationMs);
      setValue(Math.round(from + (to - from) * easeOutCubic(p)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [to, from, durationMs, replayKey]);

  return (
    <span className={['tabular', className].join(' ')}>
      {prefix}
      {value.toLocaleString('en-AU')}
      {suffix}
    </span>
  );
}
