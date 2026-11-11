import { useLayoutEffect, useRef, useState } from 'react';

export interface PromptTextProps {
  text: string;
  /** px */
  min?: number;
  /** px */
  max?: number;
  className?: string;
  as?: 'h1' | 'h2' | 'p' | 'div';
}

/**
 * Fits the prompt into its parent box by binary-searching the font size.
 * The parent must have a bounded height (e.g. `flex-1 min-h-0`).
 */
export function PromptText({ text, min = 18, max = 88, className = '', as = 'h1' }: PromptTextProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [size, setSize] = useState(max);

  useLayoutEffect(() => {
    const el = ref.current;
    const parent = el?.parentElement;
    if (!el || !parent) return;

    const fit = () => {
      const ph = parent.clientHeight;
      const pw = parent.clientWidth;
      if (ph <= 0 || pw <= 0) return;
      let lo = min;
      let hi = max;
      let best = min;
      const prev = el.style.fontSize;
      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        el.style.fontSize = `${mid}px`;
        const ok = el.scrollHeight <= ph && el.scrollWidth <= pw;
        if (ok) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }
      el.style.fontSize = prev;
      setSize(best);
    };

    fit();
    const ro = new ResizeObserver(() => fit());
    ro.observe(parent);
    // The display face can arrive after the first fit (a reload straight into
    // /play mid-round); the fallback serif measures narrower, so fit again.
    let mounted = true;
    document.fonts?.ready.then(() => mounted && fit()).catch(() => {});
    return () => {
      mounted = false;
      ro.disconnect();
    };
  }, [text, min, max]);

  const Tag = as;
  return (
    <Tag
      ref={ref as never}
      className={['display font-semibold leading-[1.08] text-balance m-0', className].join(' ')}
      style={{ fontSize: size }}
    >
      {text}
    </Tag>
  );
}
