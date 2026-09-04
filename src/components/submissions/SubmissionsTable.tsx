import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarDays,
  Check,
  ChevronDown,
  Columns3,
  Copy,
  Download,
  Globe2,
  Hash,
  Inbox,
  Monitor,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tooltip } from '../ui/tooltip';
import SubmissionViewer from '../ui/SubmissionViewer';
import type { FormField, Submission } from '../../types';

/**
 * The Submissions tab.
 *
 * Written for the person who owns the form, not the person who built the app.
 * Three decisions follow from that:
 *
 *   - Responses are a table, because a list of answers is a spreadsheet in
 *     everybody's head. The old cramped master/detail list showed two arbitrary
 *     fields per card at nine pixels and made comparing two responses
 *     impossible.
 *   - Only the questions people asked are columns. Submission ids, IP
 *     addresses, user agents and processing states are real but they are not
 *     what anyone came here for, so they sit behind a disclosure in the detail
 *     panel.
 *   - Pagination is a full-width footer that says how many responses there are
 *     and which ones you are looking at, rather than a control tucked into the
 *     bottom of a narrow column.
 */

export interface SubmissionsTableProps {
  fields: FormField[];
  submissions: Submission[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  isLoading: boolean;
  error: string | null;
  canDelete: boolean;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onDelete: (submissionId: string) => void;
  onExport?: (format: 'csv' | 'json') => void;
}

const PAGE_SIZES = [20, 50, 100];

/** Question types that read well in a narrow cell. Long prose and files do not. */
const COLUMN_FRIENDLY_TYPES = new Set([
  'text', 'email', 'phone', 'number', 'date', 'time', 'datetime',
  'select', 'radio', 'checkbox', 'multiselect', 'rating', 'scale', 'url', 'currency',
]);

const MAX_DEFAULT_COLUMNS = 4;

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

/** "3 minutes ago", "Yesterday" — the phrasing people actually use. */
function relativeTime(value: string): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return '';
  const seconds = Math.round((Date.now() - then) / 1000);
  if (seconds < 60) return 'Just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days} days ago`;
  return formatDateTime(value);
}

function plainValue(field: FormField | undefined, value: unknown): string {
  if (value === null || value === undefined || value === '') return '';

  if (field?.options?.length) {
    const label = (item: unknown) =>
      field.options?.find((option) => option.value === String(item))?.label ?? String(item);
    return Array.isArray(value) ? value.map(label).join(', ') : label(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    const names = value
      .map((item) => {
        if (!item || typeof item !== 'object') return String(item);
        const record = item as Record<string, unknown>;
        return typeof record.filename === 'string' ? record.filename
          : typeof record.name === 'string' ? record.name
            : null;
      })
      .filter((name): name is string => Boolean(name));
    return names.length > 0 ? names.join(', ') : `${value.length} items`;
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.filename === 'string') return record.filename;
    if (typeof record.name === 'string') return record.name;
    return 'Attached';
  }

  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export default function SubmissionsTable({
  fields,
  submissions,
  pagination,
  isLoading,
  error,
  canDelete,
  onPageChange,
  onLimitChange,
  onDelete,
  onExport,
}: SubmissionsTableProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [openSubmissionId, setOpenSubmissionId] = useState<string | null>(null);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const columnMenuRef = useRef<HTMLDivElement>(null);

  const answerableFields = useMemo(
    () => fields.filter((field) => !['heading', 'paragraph', 'divider', 'spacer', 'html'].includes(field.type)),
    [fields],
  );

  const defaultColumnIds = useMemo(() => {
    const friendly = answerableFields.filter((field) => COLUMN_FRIENDLY_TYPES.has(field.type));
    const chosen = (friendly.length > 0 ? friendly : answerableFields).slice(0, MAX_DEFAULT_COLUMNS);
    return chosen.map((field) => field.id);
  }, [answerableFields]);

  const [visibleColumnIds, setVisibleColumnIds] = useState<string[] | null>(null);
  const columnIds = visibleColumnIds ?? defaultColumnIds;
  const columns = columnIds
    .map((id) => answerableFields.find((field) => field.id === id))
    .filter((field): field is FormField => Boolean(field));

  // Close the column picker on an outside click, the way every other menu on
  // the page behaves.
  useEffect(() => {
    if (!columnMenuOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!columnMenuRef.current?.contains(event.target as Node)) setColumnMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [columnMenuOpen]);

  const fieldsById = useMemo(() => new Map(fields.map((field) => [field.id, field])), [fields]);

  const visible = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return submissions;
    return submissions.filter((submission) =>
      Object.entries(submission.data).some(([fieldId, value]) => {
        const label = fieldsById.get(fieldId)?.label ?? fieldId;
        return label.toLowerCase().includes(query)
          || plainValue(fieldsById.get(fieldId), value).toLowerCase().includes(query);
      }),
    );
  }, [submissions, searchQuery, fieldsById]);

  const open = submissions.find((submission) => submission.id === openSubmissionId) ?? null;

  // Responses are newest first, so the newest one on page 1 is number `total`.
  const responseNumber = (submissionId: string) => {
    const index = submissions.findIndex((submission) => submission.id === submissionId);
    if (index < 0) return 0;
    return Math.max(pagination.total - ((pagination.page - 1) * pagination.limit + index), 1);
  };

  const newCount = submissions.filter((submission) => !submission.isRead).length;
  const latest = submissions[0]?.createdAt;

  const firstOnPage = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const lastOnPage = Math.min(pagination.page * pagination.limit, pagination.total);

  const toggleColumn = (fieldId: string) => {
    const next = columnIds.includes(fieldId)
      ? columnIds.filter((id) => id !== fieldId)
      : [...answerableFields.map((f) => f.id).filter((id) => columnIds.includes(id) || id === fieldId)];
    setVisibleColumnIds(next);
  };

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 p-4 sm:p-5 lg:p-6">
      {/* What happened, in three numbers, before any table appears. */}
      <section aria-label="Response summary" className="grid shrink-0 gap-3 sm:grid-cols-3">
        <SummaryCard label="Total responses" value={pagination.total.toLocaleString()} hint="Everything received so far" />
        <SummaryCard
          label="Unread"
          value={newCount.toLocaleString()}
          hint={newCount > 0 ? 'Not opened yet, on this page' : 'You are all caught up'}
          tone={newCount > 0 ? 'accent' : 'muted'}
        />
        <SummaryCard
          label="Most recent"
          value={latest ? relativeTime(latest) : '—'}
          hint={latest ? formatDateTime(latest) : 'No responses yet'}
        />
      </section>

      <section className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border bg-card">
        {/* Toolbar */}
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              aria-label="Search the responses on this page"
              placeholder="Search these responses…"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="h-9 rounded-lg pl-9 pr-9 text-sm"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="relative" ref={columnMenuRef}>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setColumnMenuOpen((value) => !value)}
              aria-expanded={columnMenuOpen}
              aria-haspopup="true"
              className="h-9 rounded-lg"
            >
              <Columns3 className="mr-2 h-4 w-4" />
              Questions shown
              <ChevronDown className="ml-1.5 h-3.5 w-3.5" />
            </Button>
            {columnMenuOpen && (
              <div
                role="group"
                aria-label="Choose which questions appear as columns"
                className="absolute right-0 z-30 mt-1.5 max-h-80 w-72 overflow-y-auto rounded-xl border border-border bg-card p-1.5 shadow-lg"
              >
                <p className="px-2.5 py-2 text-xs text-muted-foreground">
                  Pick the questions you want to see side by side. Every answer is still in the response itself.
                </p>
                {answerableFields.map((field) => {
                  const checked = columnIds.includes(field.id);
                  return (
                    <button
                      key={field.id}
                      type="button"
                      role="checkbox"
                      aria-checked={checked}
                      onClick={() => toggleColumn(field.id)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm hover:bg-muted"
                    >
                      <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${
                        checked ? 'border-primary bg-primary text-primary-foreground' : 'border-input'
                      }`}>
                        {checked && <Check className="h-3 w-3" strokeWidth={3} />}
                      </span>
                      <span className="truncate">{field.label || 'Untitled question'}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {onExport && (
            <Tooltip content="Download every response as a spreadsheet" side="bottom" tone="dark">
              <Button type="button" variant="outline" size="sm" onClick={() => onExport('csv')} className="h-9 rounded-lg">
                <Download className="mr-2 h-4 w-4" />
                Download
              </Button>
            </Tooltip>
          )}
        </div>

        {/* Table */}
        <div className="scrollbar-subtle min-h-0 flex-1 overflow-auto">
          {error ? (
            <div className="m-4 rounded-lg border border-destructive/20 bg-destructive/[0.05] px-4 py-6 text-center text-sm font-medium text-destructive">
              {error}
            </div>
          ) : visible.length === 0 ? (
            <EmptyState searching={Boolean(searchQuery.trim())} loading={isLoading} />
          ) : (
            <>
              {/* Desktop: a real table. */}
              <table className="hidden w-full border-collapse text-sm md:table">
                <thead className="sticky top-0 z-10 bg-ink-50/95 backdrop-blur">
                  <tr className="border-b border-border text-left">
                    <th scope="col" className="w-16 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">#</th>
                    <th scope="col" className="w-48 px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Received</th>
                    {columns.map((field) => (
                      <th key={field.id} scope="col" className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        <span className="line-clamp-2">{field.label || 'Untitled question'}</span>
                      </th>
                    ))}
                    <th scope="col" className="w-28 px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((submission) => (
                    <tr
                      key={submission.id}
                      onClick={() => setOpenSubmissionId(submission.id)}
                      className={`cursor-pointer border-b border-border/60 transition-colors last:border-b-0 hover:bg-ink-50/70 ${
                        open?.id === submission.id ? 'bg-primary/[0.04]' : ''
                      }`}
                    >
                      <td className="px-4 py-3 align-top">
                        <span className="flex items-center gap-1.5 font-semibold text-foreground">
                          {responseNumber(submission.id)}
                          {!submission.isRead && (
                            <span
                              aria-label="Not opened yet"
                              className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                            />
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="block text-foreground">{relativeTime(submission.createdAt)}</span>
                        <span className="block text-xs text-muted-foreground">{formatDateTime(submission.createdAt)}</span>
                      </td>
                      {columns.map((field) => {
                        const text = plainValue(field, submission.data[field.id]);
                        const redacted = submission.redactedFields?.includes(field.id);
                        return (
                          <td key={field.id} className="max-w-xs px-4 py-3 align-top">
                            {redacted ? (
                              <span className="italic text-muted-foreground">Hidden</span>
                            ) : text ? (
                              <span className="line-clamp-2 text-foreground" title={text}>{text}</span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </td>
                        );
                      })}
                      <td className="px-4 py-3 text-right align-top">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(event) => { event.stopPropagation(); setOpenSubmissionId(submission.id); }}
                            className="h-8 rounded-lg px-2.5 text-xs font-semibold text-primary hover:bg-primary/[0.07]"
                          >
                            View
                          </Button>
                          {canDelete && (
                            <Tooltip content="Delete this response" side="left" tone="dark">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                aria-label={`Delete response ${responseNumber(submission.id)}`}
                                onClick={(event) => { event.stopPropagation(); onDelete(submission.id); }}
                                className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/[0.07] hover:text-destructive"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </Tooltip>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Mobile: the same rows, stacked, because a five-column table on
                  a phone is unreadable however it is styled. */}
              <ul className="divide-y divide-border/60 md:hidden">
                {visible.map((submission) => (
                  <li key={submission.id}>
                    <button
                      type="button"
                      onClick={() => setOpenSubmissionId(submission.id)}
                      className="w-full px-4 py-3.5 text-left hover:bg-ink-50/70"
                    >
                      <span className="flex items-center justify-between gap-3">
                        <span className="flex items-center gap-2 text-sm font-semibold text-foreground">
                          Response {responseNumber(submission.id)}
                          {!submission.isRead && (
                            <span className="rounded-full bg-primary/[0.09] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                              New
                            </span>
                          )}
                        </span>
                        <span className="shrink-0 text-xs text-muted-foreground">{relativeTime(submission.createdAt)}</span>
                      </span>
                      <span className="mt-2 block space-y-1">
                        {columns.slice(0, 3).map((field) => {
                          const text = plainValue(field, submission.data[field.id]);
                          if (!text) return null;
                          return (
                            <span key={field.id} className="block truncate text-xs text-muted-foreground">
                              <span className="font-medium text-ink-600">{field.label}:</span> {text}
                            </span>
                          );
                        })}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        {/* Pagination: full width, under the thing it paginates, and it says
            plainly which responses are on screen. */}
        <div className="flex shrink-0 flex-col gap-3 border-t border-border/70 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            {pagination.total === 0 ? (
              'No responses yet'
            ) : (
              <>
                Showing <span className="font-semibold text-foreground">{firstOnPage}–{lastOnPage}</span>
                {' '}of <span className="font-semibold text-foreground">{pagination.total.toLocaleString()}</span> responses
                {searchQuery.trim() && visible.length !== submissions.length && (
                  <span className="text-muted-foreground"> · {visible.length} match your search on this page</span>
                )}
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-muted-foreground">
              <span className="hidden sm:inline">Per page</span>
              <select
                value={pagination.limit}
                onChange={(event) => onLimitChange(Number(event.target.value))}
                className="h-9 rounded-lg border border-input bg-background px-2 text-sm text-foreground"
                aria-label="Responses per page"
              >
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>

            {pagination.totalPages > 1 && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1 || isLoading}
                  onClick={() => onPageChange(pagination.page - 1)}
                  className="h-9 rounded-lg px-3 text-sm"
                >
                  Previous
                </Button>
                <span className="px-2 text-sm text-muted-foreground">
                  Page <span className="font-semibold text-foreground">{pagination.page}</span> of {pagination.totalPages}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.totalPages || isLoading}
                  onClick={() => onPageChange(pagination.page + 1)}
                  className="h-9 rounded-lg px-3 text-sm"
                >
                  Next
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {open && (
        <SubmissionDetails
          submission={open}
          number={responseNumber(open.id)}
          fields={fields}
          canDelete={canDelete}
          onClose={() => setOpenSubmissionId(null)}
          onDelete={() => onDelete(open.id)}
        />
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  hint,
  tone = 'muted',
}: {
  label: string;
  value: string;
  hint: string;
  tone?: 'muted' | 'accent';
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3.5">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${tone === 'accent' ? 'text-primary' : 'text-foreground'}`}>{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}

function EmptyState({ searching, loading }: { searching: boolean; loading: boolean }) {
  return (
    <div className="flex h-full min-h-64 items-center justify-center px-6 py-12 text-center">
      <div className="max-w-sm">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-ink-50 text-ink-400">
          <Inbox className="h-5 w-5" strokeWidth={1.7} />
        </span>
        <p className="mt-4 text-base font-semibold text-foreground">
          {loading ? 'Loading responses…' : searching ? 'Nothing matched that search' : 'No responses yet'}
        </p>
        <p className="mt-1.5 text-sm text-muted-foreground">
          {loading
            ? 'This will only take a moment.'
            : searching
              ? 'Search looks at the responses on this page only. Try another word, or move to a different page.'
              : 'Share the form’s link and the answers people send will show up here automatically.'}
        </p>
      </div>
    </div>
  );
}

function SubmissionDetails({
  submission,
  number,
  fields,
  canDelete,
  onClose,
  onDelete,
}: {
  submission: Submission;
  number: number;
  fields: FormField[];
  canDelete: boolean;
  onClose: () => void;
  onDelete: () => void;
}) {
  const [showTechnical, setShowTechnical] = useState(false);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const answered = Object.keys(submission.data).filter(
    (key) => submission.data[key] !== null && submission.data[key] !== undefined && submission.data[key] !== '',
  ).length;

  return (
    <div className="fixed inset-0 z-[150] flex justify-end">
      <button type="button" aria-label="Close response" onClick={onClose} className="absolute inset-0 bg-ink-950/30" />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="submission-details-title"
        className="relative z-10 flex h-full w-full max-w-2xl flex-col bg-card shadow-2xl"
      >
        <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border px-5 py-4">
          <div className="min-w-0">
            <h2 id="submission-details-title" className="font-display text-lg font-bold text-foreground">
              Response {number}
            </h2>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-4 w-4" />
                {formatDateTime(submission.createdAt)}
              </span>
              <span>{answered} question{answered === 1 ? '' : 's'} answered</span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {canDelete && (
              <Tooltip content="Delete this response" side="bottom" tone="dark">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={onDelete}
                  aria-label="Delete response"
                  className="h-9 w-9 rounded-lg text-muted-foreground hover:bg-destructive/[0.07] hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </Tooltip>
            )}
            <Button
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

        <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto px-5 py-5">
          <SubmissionViewer fields={fields} data={submission.data} redactedFields={submission.redactedFields} />

          {/* Everything below is true, useful when something has gone wrong,
              and of no interest on an ordinary day. Collapsed by default. */}
          <div className="mt-6 border-t border-border pt-4">
            <button
              type="button"
              onClick={() => setShowTechnical((value) => !value)}
              aria-expanded={showTechnical}
              className="flex w-full items-center justify-between gap-3 rounded-lg px-1 py-2 text-left text-sm font-semibold text-muted-foreground hover:text-foreground"
            >
              Technical details
              <ChevronDown className={`h-4 w-4 transition-transform ${showTechnical ? 'rotate-180' : ''}`} />
            </button>
            {showTechnical && (
              <dl className="mt-2 grid gap-2 sm:grid-cols-2">
                <DetailRow icon={<Hash className="h-4 w-4" />} label="Response ID" value={submission.id} mono copyable />
                <DetailRow icon={<Globe2 className="h-4 w-4" />} label="IP address" value={submission.ip || 'Not recorded'} />
                <DetailRow
                  icon={<CalendarDays className="h-4 w-4" />}
                  label="Submitted"
                  value={formatDateTime(submission.createdAt)}
                />
                <DetailRow
                  icon={<Check className="h-4 w-4" />}
                  label="Processing"
                  value={submission.processingStatus
                    ? submission.processingStatus.charAt(0).toUpperCase() + submission.processingStatus.slice(1)
                    : 'Not applicable'}
                />
                {submission.userAgent && (
                  <div className="rounded-lg border border-border/70 bg-ink-50/55 px-3 py-2.5 sm:col-span-2">
                    <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      <Monitor className="h-4 w-4" /> Browser
                    </dt>
                    <dd className="mt-1 break-words text-xs text-ink-700">{submission.userAgent}</dd>
                  </div>
                )}
                {submission.tags.length > 0 && (
                  <div className="rounded-lg border border-border/70 bg-ink-50/55 px-3 py-2.5 sm:col-span-2">
                    <dt className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Tags</dt>
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
      </aside>
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
  return (
    <div className="min-w-0 rounded-lg border border-border/70 bg-ink-50/55 px-3 py-2.5">
      <dt className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {icon}{label}
      </dt>
      <dd className="mt-1 flex items-center gap-1.5">
        <span className={`min-w-0 truncate text-xs text-ink-700 ${mono ? 'font-mono' : ''}`} title={value}>{value}</span>
        {copyable && (
          <button
            type="button"
            onClick={() => void navigator.clipboard.writeText(value)}
            aria-label={`Copy ${label}`}
            className="shrink-0 rounded p-1 text-muted-foreground hover:bg-card hover:text-foreground"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>
        )}
      </dd>
    </div>
  );
}
