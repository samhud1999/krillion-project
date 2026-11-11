import { useEffect, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'motion/react';

export interface DrawerProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  width?: number;
}

/** Right-hand slide-over used for host setup. */
export function Drawer({ open, onClose, title, children, width = 520 }: DrawerProps) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            aria-label="Close setup"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.aside
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-y-0 right-0 z-50 flex max-w-[100vw] flex-col bg-creek-900 border-l border-white/10 shadow-2xl"
            style={{ width }}
            initial={{ x: width }}
            animate={{ x: 0 }}
            exit={{ x: width }}
            transition={{ type: 'spring', stiffness: 380, damping: 36 }}
          >
            <header className="flex items-center justify-between gap-3 border-b border-white/10 px-5 py-4">
              <h2 className="display text-2xl font-semibold">{title}</h2>
              <button
                onClick={onClose}
                className="grid size-10 place-items-center rounded-full bg-white/8 text-foam-muted hover:bg-white/15 hover:text-foam"
                aria-label="Close"
              >
                ✕
              </button>
            </header>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
