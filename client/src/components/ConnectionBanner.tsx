import { AnimatePresence, motion } from 'motion/react';
import { reconnect, useStore } from '../ws';

/**
 * Thin top banner while the socket is down, and the "seat taken elsewhere"
 * notice with a button to take it back (the server closes a superseded socket
 * and we deliberately stop reconnecting until the person asks).
 */
export function ConnectionBanner() {
  const { status, everOpened, notice, kicked, session } = useStore();
  const reconnecting = status === 'reconnecting' || (status === 'connecting' && !everOpened);
  const halted = status === 'closed' && !!notice && !kicked && !!session;
  const show = reconnecting || halted;
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: -40, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -40, opacity: 0 }}
          className="fixed inset-x-0 top-0 z-40 flex justify-center px-3 pointer-events-none"
          role="status"
        >
          {halted ? (
            <div className="pointer-events-auto mt-[max(env(safe-area-inset-top),0.5rem)] flex max-w-md items-center gap-3 rounded-2xl bg-amber-400/95 px-4 py-2 text-sm font-semibold text-ink shadow-lg">
              <span className="min-w-0 flex-1">{notice}</span>
              <button
                type="button"
                onClick={() => reconnect()}
                className="shrink-0 rounded-xl bg-ink px-3 py-2 text-sm font-bold text-amber-200 hover:bg-ink/90 min-h-11"
              >
                Use this device
              </button>
            </div>
          ) : (
            <div className="mt-[max(env(safe-area-inset-top),0.5rem)] flex items-center gap-2 rounded-full bg-amber-400/95 px-4 py-1.5 text-xs font-semibold text-ink shadow">
              <span className="size-2 rounded-full bg-ink/70 animate-pulse-soft" />
              {everOpened ? 'Reconnecting…' : 'Connecting…'}
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
