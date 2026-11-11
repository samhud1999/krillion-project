import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { describeError, useStore } from '../ws';

interface Toast {
  id: number;
  text: string;
  tone: 'error' | 'info';
}

/**
 * Shows the latest server error (and protocol mismatch) as a transient toast.
 * Mount once at the app root.
 */
export function ToastHost() {
  const { lastError, protocolMismatch } = useStore();
  const [toasts, setToasts] = useState<Toast[]>([]);
  // one timer per toast: a second error arriving must not keep the first one on screen
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  useEffect(() => {
    if (!lastError) return;
    // room-loss errors are surfaced by the Join screen notice instead
    if (lastError.code === 'room_not_found' || lastError.code === 'not_player') return;
    const t: Toast = { id: lastError.seq, text: describeError(lastError.code, lastError.message), tone: 'error' };
    setToasts((prev) => [...prev.filter((x) => x.id !== t.id), t].slice(-3));
    const map = timers.current;
    map.set(
      t.id,
      setTimeout(() => {
        map.delete(t.id);
        setToasts((prev) => prev.filter((x) => x.id !== t.id));
      }, 4200),
    );
  }, [lastError]);

  useEffect(() => {
    const map = timers.current;
    return () => map.forEach((timer) => clearTimeout(timer));
  }, []);

  return (
    <div className="pointer-events-none fixed inset-x-0 top-0 z-50 flex flex-col items-center gap-2 px-4 safe-top" role="status" aria-live="polite">
      {protocolMismatch && (
        <div className="pointer-events-auto rounded-2xl bg-amber-400 px-4 py-2 text-sm font-semibold text-ink shadow-lg">
          This page is out of date.{' '}
          <button className="underline" onClick={() => location.reload()}>
            Refresh
          </button>
        </div>
      )}
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, y: -12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.22 }}
            className={[
              'pointer-events-auto max-w-sm rounded-2xl px-4 py-3 text-sm font-medium shadow-xl backdrop-blur',
              t.tone === 'error' ? 'bg-rose-500/90 text-white' : 'bg-creek-700/90 text-foam',
            ].join(' ')}
          >
            {t.text}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
