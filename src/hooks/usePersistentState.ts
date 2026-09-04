import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * State that survives a component being unmounted.
 *
 * The form builder swaps its whole centre pane between the canvas, the preview
 * and the settings workspace, so the settings tree is torn down every time
 * someone glances at the preview. Ordinary `useState` starts over from the
 * first tab on the way back, which is why people kept losing their place.
 *
 * Values are held in `sessionStorage`, keyed per form, so the position is
 * per-tab and per-form and does not linger after the browser is closed. Reads
 * and writes are wrapped because private browsing modes can make either throw.
 */

function readValue<T>(key: string, fallback: T): T {
  try {
    const raw = window.sessionStorage.getItem(key);
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeValue(key: string, value: unknown): void {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage unavailable or full: the state still works for this mount.
  }
}

export function usePersistentState<T>(
  key: string | null,
  initial: T
): [T, (value: T | ((previous: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => (key ? readValue(key, initial) : initial));

  // Following a key change (a different form) re-reads rather than carrying the
  // previous form's position across.
  const previousKey = useRef(key);
  useEffect(() => {
    if (previousKey.current === key) return;
    previousKey.current = key;
    setValue(key ? readValue(key, initial) : initial);
    // `initial` is intentionally excluded: it is a default, not a dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((previous: T) => T)) => {
      setValue((previous) => {
        const resolved = typeof next === 'function' ? (next as (p: T) => T)(previous) : next;
        if (key) writeValue(key, resolved);
        return resolved;
      });
    },
    [key]
  );

  return [value, update];
}

/**
 * Remembers how far a scroll container had been scrolled and puts it back on
 * the next mount. Pairs with `usePersistentState`: restoring the tab without
 * the scroll offset still drops someone at the top of a long settings page.
 */
export function usePersistentScroll<T extends HTMLElement>(key: string | null) {
  const ref = useRef<T | null>(null);

  useEffect(() => {
    const element = ref.current;
    if (!element || !key) return;

    const saved = readValue<number>(key, 0);
    if (saved > 0) {
      // After paint, so the restored content has its final height.
      const frame = window.requestAnimationFrame(() => {
        element.scrollTop = saved;
      });
      return () => window.cancelAnimationFrame(frame);
    }
  }, [key]);

  useEffect(() => {
    const element = ref.current;
    if (!element || !key) return;

    let frame = 0;
    const onScroll = () => {
      // Coalesced to one write per frame; scroll fires far too often to store
      // on every event.
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        writeValue(key, element.scrollTop);
      });
    };

    element.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      element.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
      writeValue(key, element.scrollTop);
    };
  }, [key]);

  return ref;
}
