import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { fieldErrorDomId } from '../../lib/fieldFocus';

/**
 * The one way this product tells someone an answer is wrong.
 *
 * Deliberately quiet. A form full of red is a form people abandon, so this is a
 * single line beneath the question, in the question's own column, with an icon
 * that carries the meaning for anyone who cannot separate red from grey. It is
 * a `role="alert"` so it is announced the moment it appears, and its id is the
 * one the input points at with `aria-describedby`.
 *
 * Whether the message came from the browser or from the server makes no
 * difference to the person reading it, so it makes no difference here either.
 */
export function FieldError({ fieldId, message }: { fieldId: string; message: string }) {
  return (
    <p
      id={fieldErrorDomId(fieldId)}
      role="alert"
      className="flex items-start gap-1.5 text-[13px] font-medium leading-5 text-destructive"
    >
      <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

/** Confirmation that a checked value passed — the counterpart to FieldError. */
export function FieldSuccess({ message }: { message: string }) {
  return (
    <p className="flex items-start gap-1.5 text-[13px] font-medium leading-5 text-emerald-700">
      <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

/** A check that is still running. */
export function FieldPending({ message = 'Checking…' }: { message?: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[13px] font-medium leading-5 text-muted-foreground">
      <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

/**
 * A summary of everything wrong, each entry a link to its question.
 *
 * Shown only after a submit attempt, and only when more than one thing is
 * wrong — one error needs no index. It is the thing a screen-reader user hears
 * first, and the thing a sighted user on a long form uses to work through the
 * list without scrolling past anything.
 */
export function ErrorSummary({
  errors,
  onJump,
}: {
  errors: Array<{ fieldId: string; label: string }>;
  onJump: (fieldId: string) => void;
}) {
  if (errors.length < 2) return null;

  return (
    <div
      role="alert"
      aria-labelledby="error-summary-title"
      className="rounded-xl border border-destructive/30 bg-destructive/[0.05] px-4 py-3.5"
    >
      <p id="error-summary-title" className="flex items-center gap-2 text-sm font-semibold text-destructive">
        <AlertCircle className="h-4 w-4 shrink-0" aria-hidden="true" />
        {errors.length} answers need your attention
      </p>
      <ul className="mt-2 space-y-1">
        {errors.map((error) => (
          <li key={error.fieldId}>
            <button
              type="button"
              onClick={() => onJump(error.fieldId)}
              className="rounded text-left text-[13px] font-medium text-destructive underline underline-offset-2 hover:text-destructive/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-destructive/40"
            >
              {error.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
