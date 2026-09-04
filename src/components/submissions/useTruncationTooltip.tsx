import { useEffect, useRef, useState, type RefObject } from 'react';
import { createPortal } from 'react-dom';

/**
 * "What does the rest of this cell say?"
 *
 * A table cell has to be narrow enough that the columns either side are still
 * visible, which means long answers get cut off. The cut-off text still has to
 * be readable somehow, and the two obvious ways of doing that are both wrong:
 *
 *   - `title="…"` is free but the browser decides when it appears (roughly a
 *     second, unconfigurable), renders it in the OS's own style, and never
 *     shows it on touch. People do not wait a second, so they conclude the
 *     value is gone.
 *   - A React tooltip component per cell means a hundred rows times eight
 *     columns of mounted components, each with its own state and its own pair
 *     of listeners, re-rendering on hover. That is eight hundred subscriptions
 *     to solve a problem only one cell has at a time.
 *
 * So: one listener on the table, delegated. Hovering anything carrying
 * `data-truncated-text` measures that element — and only then — and shows a
 * single shared bubble if, and only if, the text really is clipped. A cell that
 * fits shows nothing, which is the difference between a helpful tooltip and a
 * tooltip that fires constantly and gets ignored.
 *
 * The measurement is `scrollWidth > clientWidth`, read once per hover. That is
 * a layout read, so it is deliberately not done during render or in a loop over
 * every cell.
 */
export function useTruncationTooltip(containerRef: RefObject<HTMLElement | null>) {
  const [tip, setTip] = useState<{ text: string; top: number; left: number } | null>(null);
  // Held in a ref so moving the pointer within one cell does not re-measure or
  // re-render; only crossing into a different cell does anything.
  const activeRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const clear = () => {
      activeRef.current = null;
      setTip(null);
    };

    const onOver = (event: Event) => {
      const target = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-truncated-text]');
      if (!target) {
        if (activeRef.current) clear();
        return;
      }
      if (target === activeRef.current) return;

      activeRef.current = target;

      const clipped = target.scrollWidth > target.clientWidth + 1
        || target.scrollHeight > target.clientHeight + 1;
      const text = target.getAttribute('data-truncated-text') || target.textContent || '';
      if (!clipped || !text.trim()) {
        setTip(null);
        return;
      }

      const rect = target.getBoundingClientRect();
      setTip({ text, top: rect.top - 8, left: Math.min(rect.left, window.innerWidth - 24) });
    };

    // Scrolling moves the cell out from under a bubble that is positioned in
    // viewport coordinates, so the bubble has to go with it.
    container.addEventListener('mouseover', onOver);
    container.addEventListener('mouseleave', clear);
    container.addEventListener('scroll', clear, { passive: true });
    window.addEventListener('scroll', clear, { passive: true, capture: true });
    return () => {
      container.removeEventListener('mouseover', onOver);
      container.removeEventListener('mouseleave', clear);
      container.removeEventListener('scroll', clear);
      window.removeEventListener('scroll', clear, { capture: true });
    };
  }, [containerRef]);

  const node = tip
    ? createPortal(
      <div
        role="tooltip"
        style={{ top: tip.top, left: tip.left }}
        className="pointer-events-none fixed z-[400] max-w-md -translate-y-full whitespace-pre-wrap break-words rounded-lg border border-white/10 bg-ink-900 px-3 py-2 text-xs leading-5 text-white shadow-[0_8px_24px_rgba(15,23,42,0.24)]"
      >
        {tip.text}
      </div>,
      document.body,
    )
    : null;

  return node;
}
