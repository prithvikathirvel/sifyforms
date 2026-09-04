/**
 * Getting a person to the thing that is wrong.
 *
 * Validation feedback fails in three ways, and this module exists to prevent
 * all three:
 *
 *   1. The message appears somewhere other than the question it is about — in a
 *      banner at the top, or worse, in a toast that disappears while the person
 *      is still reading it. On a long form the banner is off-screen; on any
 *      form the toast is gone before it has been understood.
 *   2. Nothing moves. The page stays exactly where it was and the person has to
 *      hunt for a red outline they cannot see.
 *   3. On a multi-step form the offending question is on another step
 *      altogether, so there is nothing to scroll to at all.
 *
 * Everything here is plain DOM. No dependencies, no measurement libraries, and
 * a documented fallback for `scrollIntoView` options that older Safari ignores.
 */

/** Every field container is rendered with this id, on the public form and in preview. */
export function fieldDomId(fieldId: string): string {
  return `field-${fieldId}`;
}

/** Where the error message for a field lives, for `aria-describedby`. */
export function fieldErrorDomId(fieldId: string): string {
  return `field-${fieldId}-error`;
}

const FOCUSABLE = [
  'input:not([type="hidden"]):not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'button:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * True when the person has asked not to be moved around. Respecting this is not
 * optional: vestibular disorders make smooth scrolling genuinely unpleasant.
 */
function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined'
    && typeof window.matchMedia === 'function'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Scroll a field into view and put the caret in it.
 *
 * Focus is what actually helps: it moves the screen reader, it moves the
 * keyboard, and in every browser it also scrolls. The explicit scroll runs
 * first so the field is centred rather than jammed against the viewport edge,
 * and `preventScroll` stops focus from undoing that — with a plain `focus()`
 * fallback for the handful of engines that ignore the option.
 */
export function focusField(fieldId: string): boolean {
  if (typeof document === 'undefined') return false;
  const container = document.getElementById(fieldDomId(fieldId));
  if (!container) return false;

  try {
    container.scrollIntoView({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  } catch {
    // Safari below 15.4 and a few embedded webviews take no options at all.
    container.scrollIntoView();
  }

  const target = container.querySelector<HTMLElement>(FOCUSABLE);
  if (target) {
    try {
      target.focus({ preventScroll: true });
    } catch {
      target.focus();
    }
  }
  return true;
}

/**
 * Move to the first field that has a problem.
 *
 * Two details make this reliable, and both are easy to get wrong:
 *
 * `order` is the on-screen order of the questions, not the order the errors
 * arrived in. react-hook-form's error object and the API's `details` payload
 * are both unordered maps, and being thrown at the seventh question when the
 * second is also wrong is disorienting.
 *
 * The work is deferred two animation frames, and the candidate list is then
 * narrowed against what is actually on the page. This is not defensiveness: a
 * caller that has just awaited `trigger()` is holding a render-stale copy of
 * the error object, and a caller that has just switched steps is naming fields
 * that were not in the DOM when it made the call. By the time these frames have
 * passed React has committed and every invalid container is marked, so the DOM
 * is the more current source of truth. If nothing is marked — a renderer that
 * does not set the attribute — the caller's list is used as given.
 */
export function scrollToFirstError(errorFieldIds: string[], order: string[]): void {
  if (errorFieldIds.length === 0 || typeof window === 'undefined') return;

  const pick = () => {
    const stillInvalid = errorFieldIds.filter((id) => {
      const el = document.getElementById(fieldDomId(id));
      return el?.getAttribute('data-field-invalid') === 'true';
    });
    const candidates = stillInvalid.length > 0 ? stillInvalid : errorFieldIds;
    const set = new Set(candidates);
    return order.find((id) => set.has(id)) ?? candidates[0];
  };

  window.requestAnimationFrame(() => {
    // Two frames: one for React to commit, one for the browser to lay out.
    window.requestAnimationFrame(() => focusField(pick()));
  });
}

/**
 * The step a field belongs to, or -1 when the form is single-page.
 *
 * Used to move to the right step before scrolling, so an error on step 1 is
 * reachable while the person is looking at step 3.
 */
export function stepIndexOfField(
  fieldId: string,
  steps: Array<{ fieldIds?: string[] }> | undefined,
): number {
  if (!steps || steps.length === 0) return -1;
  return steps.findIndex((step) => (step.fieldIds ?? []).includes(fieldId));
}
