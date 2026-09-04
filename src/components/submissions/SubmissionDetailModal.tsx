import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  Copy,
  Globe2,
  Hash,
  Monitor,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import SubmissionViewer from '../ui/SubmissionViewer';
import type { FormField, Submission } from '../../types';

/**
 * One response, opened.
 *
 * This used to be a panel that slid in from the right. The problem with that
 * shape is not decoration, it is proportion: a form is a tall, narrow, centred
 * column of questions, and a side panel is a tall, narrow column pinned to one
 * edge with the table still visible and still competing for attention behind
 * it. The answers ended up in a different place, a different width and a
 * different order from the form the person actually filled in, so reading a
 * response meant re-deriving which question each answer belonged to.
 *
 * A centred dialog is the same shape as the form. The answers can be laid out
 * exactly as the questions were — one column, in order, label above value — and
 * the page behind is dimmed rather than fighting for the eye. Everything that
 * is true but uninteresting (ids, IP, browser, processing state) is folded away
 * underneath, where it is available the day something goes wrong and invisible
 * every other day.
 */

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

export interface SubmissionDetailModalProps {
  submission: Submission;
  number: number;
  fields: FormField[];
  canDelete: boolean;
  onClose: () => void;
  onDelete: () => void;
  /** Move to the response before/after this one without closing. */
  onPrevious?: () => void;
  onNext?: () => void;
}

export default function SubmissionDetailModal({
  submission,
  number,
  fields,
  canDelete,
  onClose,
  onDelete,
  onPrevious,
  onNext,
}: SubmissionDetailModalProps) {
  const [showTechnical, setShowTechnical] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  // Escape closes; Tab is trapped. A modal that leaks focus to the table behind
  // it is a modal a keyboard user cannot get out of.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  // Opening a dialog while the page behind can still scroll is disorienting:
  // the wheel moves the wrong thing.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    return () => { document.body.style.overflow = previous; };
  }, []);

  const answered = useMemo(
    () => Object.keys(submission.data).filter((key) => {
      const value = submission.data[key];
      return value !== null && value !== undefined && value !== ''
        && !(Array.isArray(value) && value.length === 0);
    }).length,
    [submission.data],
  );

  // Only questions, in the order they were asked. Headings and dividers are
  // form furniture; an answer sheet does not need them.
  const answerFields = useMemo(
    () => fields.filter((field) => !['heading', 'paragraph', 'divider', 'spacer', 'html', 'display'].includes(field.type)),
    [fields],
  );

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        aria-label="Close response"
        onClick={onClose}
        className="absolute inset-0 cursor-default bg-ink-950/45 backdrop-blur-[2px]"
      />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="submission-detail-title"
        className="relative z-10 flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_64px_rgba(15,23,42,0.28)]"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-card px-5 py-4 sm:px-7">
          <div className="min-w-0">
            <h2 id="submission-detail-title" className="font-display text-lg font-bold text-foreground">
              Response {number}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {formatDateTime(submission.createdAt)}
              </span>
              <span aria-hidden="true">·</span>
              <span>{answered} of {answerFields.length} questions answered</span>
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-1">
            {(onPrevious || onNext) && (
              <div className="mr-1 hidden items-center gap-1 sm:flex">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!onPrevious}
                  onClick={onPrevious}
                  className="h-8 rounded-lg px-2.5 text-xs"
                >
                  Newer
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={!onNext}
                  onClick={onNext}
                  className="h-8 rounded-lg px-2.5 text-xs"
                >
                  Older
                </Button>
              </div>
            )}
            {canDelete && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onDelete}
                aria-label="Delete this response"
                className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-destructive/[0.07] hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              ref={closeRef}
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close response"
              className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </header>

        <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto bg-ink-50/40 px-5 py-5 sm:px-7 sm:py-6">
          {/* The answers, in the shape of the form they came from. */}
          <SubmissionViewer
            fields={answerFields}
            data={submission.data}
            redactedFields={submission.redactedFields}
          />

          <div className="mt-5 overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => setShowTechnical((value) => !value)}
              aria-expanded={showTechnical}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-[13px] font-semibold text-muted-foreground hover:bg-ink-50/70 hover:text-foreground"
            >
              Technical details
              <ChevronDown className={`h-4 w-4 transition-transform ${showTechnical ? 'rotate-180' : ''}`} />
            </button>
            {showTechnical && (
              <dl className="grid gap-2 border-t border-border/70 p-3 sm:grid-cols-2">
                <DetailRow icon={<Hash className="h-3.5 w-3.5" />} label="Response ID" value={submission.id} mono copyable />
                <DetailRow icon={<Globe2 className="h-3.5 w-3.5" />} label="IP address" value={submission.ip || 'Not recorded'} />
                <DetailRow icon={<CalendarDays className="h-3.5 w-3.5" />} label="Submitted" value={formatDateTime(submission.createdAt)} />
                <DetailRow
                  icon={<Check className="h-3.5 w-3.5" />}
                  label="Processing"
                  value={submission.processingStatus
                    ? submission.processingStatus.charAt(0).toUpperCase() + submission.processingStatus.slice(1)
                    : 'Not applicable'}
                />
                {submission.userAgent && (
                  <div className="rounded-lg border border-border/70 bg-ink-50/55 px-3 py-2.5 sm:col-span-2">
                    <dt className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                      <Monitor className="h-3.5 w-3.5" /> Browser
                    </dt>
                    <dd className="mt-1 break-words text-xs leading-5 text-ink-700">{submission.userAgent}</dd>
                  </div>
                )}
                {submission.tags?.length > 0 && (
                  <div className="rounded-lg border border-border/70 bg-ink-50/55 px-3 py-2.5 sm:col-span-2">
                    <dt className="text-xs font-semibold text-muted-foreground">Tags</dt>
                    <dd className="mt-1.5 flex flex-wrap gap-1.5">
                      {submission.tags.map((tag) => (
                        <span key={tag} className="rounded-full border border-border bg-card px-2 py-0.5 text-xs font-medium text-ink-600">
                          {tag}
                        </span>
                      ))}
                    </dd>
                  </div>
                )}
              </dl>
            )}
          </div>
        </div>

        {/* Mobile gets the move-between-responses controls as a real footer,
            because the header is already full at that width. */}
        {(onPrevious || onNext) && (
          <footer className="flex shrink-0 items-center justify-between gap-2 border-t border-border px-5 py-3 sm:hidden">
            <Button type="button" variant="outline" size="sm" disabled={!onPrevious} onClick={onPrevious} className="h-9 flex-1 rounded-lg">
              Newer
            </Button>
            <Button type="button" variant="outline" size="sm" disabled={!onNext} onClick={onNext} className="h-9 flex-1 rounded-lg">
              Older
            </Button>
          </footer>
        )}
      </div>
    </div>
  );
}

function DetailRow({
  icon,
  label,
  value,
  mono = false,
  copyable = false,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
  copyable?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    void navigator.clipboard.writeText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-ink-50/55 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {icon}{label}
      </dt>
      <dd className="mt-1 flex items-center gap-1.5">
        <span className={`min-w-0 truncate text-xs text-ink-700 ${mono ? 'font-mono' : ''}`} data-truncated-text={value}>
          {value}
        </span>
        {copyable && (
          <button
            type="button"
            onClick={copy}
            aria-label={copied ? 'Copied' : `Copy ${label}`}
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground"
          >
            {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
      </dd>
    </div>
  );
}
