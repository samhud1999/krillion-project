import { useEffect } from 'react';

const INTERACTIVE = 'button, a, [role="button"], input, textarea, select, [contenteditable=""], [contenteditable="true"]';

/** Typing in a field, or focused on a control that handles its own keys (a button taking Enter/Space). */
function onInteractive(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false;
  return !!target.closest(INTERACTIVE);
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

/**
 * Global keyboard shortcut. Ignored while the user is typing in a field or has
 * a button/link focused (so Space on a focused "Reject" never advances the
 * round), unless `allowInInputs` is set. `keys` are compared against `event.key`.
 */
export function useKey(keys: string[], handler: (e: KeyboardEvent) => void, opts?: { allowInInputs?: boolean; enabled?: boolean }) {
  const enabled = opts?.enabled ?? true;
  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey || e.repeat) return;
      if (opts?.allowInInputs ? false : onInteractive(e.target) || isTyping(e.target)) return;
      if (keys.includes(e.key)) {
        e.preventDefault();
        handler(e);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keys.join('|'), handler, enabled, opts?.allowInInputs]);
}
