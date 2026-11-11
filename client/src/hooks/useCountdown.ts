import { useEffect, useState } from 'react';
import { serverNow } from '../ws';

export interface Countdown {
  remainingMs: number;
  seconds: number;
  /** 1 at the start of the prompt → 0 at the end */
  fraction: number;
  done: boolean;
}

/**
 * Smooth countdown to `endsAt` (a server timestamp), corrected by the
 * server clock offset. Re-renders on animation frames while running, and
 * keeps checking (slowly) after the end so a corrected clock that moves the
 * deadline back into the future brings the countdown back to life.
 */
export function useCountdown(endsAt: number | undefined, startedAt?: number): Countdown {
  const [now, setNow] = useState(() => serverNow());

  useEffect(() => {
    if (endsAt === undefined) return;
    let raf = 0;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let last = 0;
    let stopped = false;
    const tick = (t: number) => {
      if (stopped) return;
      // ~30 fps is plenty for a ring and keeps phones cool
      if (t - last > 32) {
        last = t;
        setNow(serverNow());
      }
      if (serverNow() < endsAt + 400) {
        raf = requestAnimationFrame(tick);
      } else {
        setNow(serverNow());
        // past the end: poll gently in case the clock offset is corrected
        timer = setTimeout(() => raf = requestAnimationFrame(tick), 500);
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      if (timer) clearTimeout(timer);
    };
  }, [endsAt]);

  if (endsAt === undefined) return { remainingMs: 0, seconds: 0, fraction: 0, done: false };
  const remainingMs = Math.max(0, endsAt - now);
  const total = startedAt !== undefined ? Math.max(1000, endsAt - startedAt) : Math.max(1000, remainingMs);
  const fraction = Math.min(1, Math.max(0, remainingMs / total));
  return { remainingMs, seconds: Math.ceil(remainingMs / 1000), fraction, done: remainingMs <= 0 };
}
