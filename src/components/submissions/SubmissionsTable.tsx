import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownUp,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Columns3,
  Download,
  Inbox,
  ListFilter,
  Rows3,
  Search,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Tooltip } from '../ui/tooltip';
import SubmissionDetailModal from './SubmissionDetailModal';
import { useTruncationTooltip } from './useTruncationTooltip';
import type { FormField, Submission } from '../../types';
import type { SubmissionsQuery } from './query';

/**
 * The Submissions tab.
 *
 * Written for the person who owns the form, and built around the loop they
 * actually perform: narrow the set, scan it, open one, act. Everything here
 * serves that loop, and the shape is borrowed from the tools that have already
 * solved it — Attio and Airtable for the toolbar grammar (a row of quiet chips
 * that each open one popover, with a count on the chip when it is doing
 * something), Stripe and GitHub for making the active query visible as
 * removable chips, Linear for the row-to-detail transition.
 *
 * Four rules the earlier version broke:
 *
 *   1. The query runs on the server. Search, status and date range now go to
 *      the API, so a search finds a response on page nine and the count under
 *      the table describes the set you are actually looking at. The old table
 *      filtered the fifty rows it happened to be holding and said so in the
 *      empty state, which is not a feature, it is an apology.
 *   2. Whatever is filtering the table is visible as a chip you can remove.
 *      A filtered table that looks unfiltered is how people misread data.
 *   3. Density is the reader's choice, not ours, and it is remembered. An
 *      analyst comparing two hundred responses and someone reading one
 *      carefully want different row heights.
 *   4. Nothing decorative. The three stat cards that used to sit on top were
 *      read-only trivia; the total belongs under the table where the paging
 *      is, and "unread" is worth more as a filter than as a number.
 */

export interface SubmissionsTableProps {
  formId: string;
  fields: FormField[];
  submissions: Submission[];
  pagination: { page: number; limit: number; total: number; totalPages: number };
  isLoading: boolean;
  error: string | null;
  canDelete: boolean;
  query: SubmissionsQuery;
  onQueryChange: (patch: Partial<SubmissionsQuery>) => void;
  onPageChange: (page: number) => void;
  onLimitChange: (limit: number) => void;
  onDelete: (submissionId: string) => void;
  onBulkDelete?: (submissionIds: string[]) => void;
  onExport?: (format: 'csv' | 'json', ids?: string[]) => void;
}

const PAGE_SIZES = [25, 50, 100];

/** Question types that read well in a narrow cell. Long prose and files do not. */
const COLUMN_FRIENDLY_TYPES = new Set([
  'text', 'email', 'phone', 'number', 'date', 'time', 'datetime',
  'select', 'radio', 'checkbox', 'multiselect', 'rating', 'scale', 'url', 'currency',
]);

/*
 * Six columns by default, whatever the density.
 *
 * Beyond that the table stops being scannable and becomes a wall you navigate
 * sideways, and the columns people care about are no longer the visible ones.
 * The rest are one click away in the column picker.
 */
const MAX_DEFAULT_COLUMNS = 6;

/*
 * Fixed column widths, in pixels, so the table can be wider than its container.
 *
 * `width: 100%` is what caused the original problem: with eight questions the
 * browser dutifully divided the panel eight ways and produced columns too
 * narrow to read a date in. Naming the widths instead means a column is always
 * legible and the table simply overflows, which is what horizontal scroll is
 * for. They also make `table-fixed` layout possible, which is what lets every
 * cell truncate on one line without measuring anything.
 */
const NUMBER_COL_WIDTH = 64;
const RECEIVED_COL_WIDTH = 172;
const ANSWER_COL_WIDTH = 220;
const ACTIONS_COL_WIDTH = 92;

/** Row padding per density. Names, not numbers, so the intent survives edits. */
const DENSITY: Record<Density, { cell: string; label: string }> = {
  compact: { cell: 'py-1.5', label: 'Compact' },
  cosy: { cell: 'py-3', label: 'Cosy' },
  roomy: { cell: 'py-4', label: 'Roomy' },
};
type Density = 'compact' | 'cosy' | 'roomy';

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

  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Numbers line up when they are right-aligned; prose does not.
 *
 * A column of scores read down the right edge with tabular figures is scannable
 * in a way that the same column left-aligned against ragged text is not.
 */
const NUMERIC_TYPES = new Set(['number', 'rating', 'nps', 'csat', 'ces']);
function isNumericField(field: FormField): boolean {
  return NUMERIC_TYPES.has(field.type);
}

const todayISO = () => new Date().toISOString().slice(0, 10);
const daysAgoISO = (days: number) =>
  new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);

/** Reads a stored preference without letting a bad value break the page. */
function readStored<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const stored = window.localStorage.getItem(key);
  return allowed.includes(stored as T) ? (stored as T) : fallback;
}

export default function SubmissionsTable({
  formId,
  fields,
  submissions,
  pagination,
  isLoading,
  error,
  canDelete,
  query,
  onQueryChange,
  onPageChange,
  onLimitChange,
  onDelete,
  onBulkDelete,
  onExport,
}: SubmissionsTableProps) {
  const [openSubmissionId, setOpenSubmissionId] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [menu, setMenu] = useState<'filter' | 'sort' | 'columns' | 'density' | null>(null);
  const [canScrollRight, setCanScrollRight] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const truncationTooltip = useTruncationTooltip(scrollRef);

  const densityKey = `sifyforms.submissions.density`;
  const columnsKey = `sifyforms.submissions.columns.${formId}`;
  const [density, setDensity] = useState<Density>(() =>
    readStored(densityKey, ['compact', 'cosy', 'roomy'] as const, 'cosy'));

  /*
   * The search box is local and the query is debounced.
   *
   * Typing has to feel instant, and every keystroke cannot be a round trip.
   * 300ms is long enough to absorb a word and short enough that the table has
   * usually caught up by the time the eye moves down to it.
   */
  const [searchDraft, setSearchDraft] = useState(query.search);
  useEffect(() => { setSearchDraft(query.search); }, [query.search]);
  useEffect(() => {
    if (searchDraft === query.search) return;
    const timer = window.setTimeout(() => onQueryChange({ search: searchDraft }), 300);
    return () => window.clearTimeout(timer);
    // onQueryChange is recreated per render by the page; depending on it would
    // restart the timer on every keystroke and the search would never fire.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchDraft, query.search]);

  const answerableFields = useMemo(
    () => fields.filter((field) => field.type !== 'display' && field.type !== 'html'),
    [fields],
  );

  const defaultColumnIds = useMemo(() => {
    const friendly = answerableFields.filter((field) => COLUMN_FRIENDLY_TYPES.has(field.type));
    const chosen = (friendly.length > 0 ? friendly : answerableFields).slice(0, MAX_DEFAULT_COLUMNS);
    return chosen.map((field) => field.id);
  }, [answerableFields]);

  // Which questions are on screen is a per-form preference, so it is stored
  // per form. `null` means "never chosen", which is different from "chose to
  // show none" and has to stay distinguishable.
  const [visibleColumnIds, setVisibleColumnIds] = useState<string[] | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const stored = window.localStorage.getItem(columnsKey);
      const parsed = stored ? JSON.parse(stored) : null;
      return Array.isArray(parsed) ? (parsed as string[]) : null;
    } catch { return null; }
  });

  const columnIds = visibleColumnIds ?? defaultColumnIds;
  const columns = useMemo(
    () => columnIds
      .map((id) => answerableFields.find((field) => field.id === id))
      .filter((field): field is FormField => Boolean(field)),
    [columnIds, answerableFields],
  );

  const setColumns = (next: string[]) => {
    setVisibleColumnIds(next);
    try { window.localStorage.setItem(columnsKey, JSON.stringify(next)); } catch { /* private mode */ }
  };
  const changeDensity = (next: Density) => {
    setDensity(next);
    try { window.localStorage.setItem(densityKey, next); } catch { /* private mode */ }
  };

  // Close whichever menu is open on an outside click or Escape, the way every
  // other menu on the page behaves.
  useEffect(() => {
    if (!menu) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!toolbarRef.current?.contains(event.target as Node)) setMenu(null);
    };
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') setMenu(null); };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [menu]);

  // Whether there is table to the right that has not been reached yet. Read
  // from the element rather than computed from column counts, because the
  // container's width depends on the sidebar, the window and the zoom level.
  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;
    const update = () => {
      setCanScrollRight(element.scrollWidth - element.clientWidth - element.scrollLeft > 4);
    };
    update();
    element.addEventListener('scroll', update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      element.removeEventListener('scroll', update);
      observer.disconnect();
    };
  }, [submissions.length, columns.length]);

  // A page of rows the person never saw should not stay selected underneath
  // them; carrying a hidden selection into a delete is how accidents happen.
  useEffect(() => { setSelected(new Set()); }, [pagination.page, query]);

  const open = submissions.find((submission) => submission.id === openSubmissionId) ?? null;
  const openIndex = open ? submissions.findIndex((submission) => submission.id === open.id) : -1;

  // Responses are newest first, so the newest one on page 1 is number `total`.
  // Oldest-first inverts the count rather than renumbering the responses,
  // because a response's number is a property of the response, not of the sort.
  const responseNumber = (submissionId: string) => {
    const index = submissions.findIndex((submission) => submission.id === submissionId);
    if (index < 0) return 0;
    const offset = (pagination.page - 1) * pagination.limit + index;
    return query.sort === 'oldest'
      ? offset + 1
      : Math.max(pagination.total - offset, 1);
  };

  const firstOnPage = pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1;
  const lastOnPage = Math.min(pagination.page * pagination.limit, pagination.total);

  const toggleColumn = (fieldId: string) => {
    // Rebuilt from the form's own order rather than appended, so the columns
    // always read left to right in the order the questions were asked.
    const wanted = new Set(columnIds);
    if (wanted.has(fieldId)) wanted.delete(fieldId); else wanted.add(fieldId);
    setColumns(answerableFields.filter((field) => wanted.has(field.id)).map((field) => field.id));
  };

  const toggleRow = (submissionId: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(submissionId)) next.delete(submissionId); else next.add(submissionId);
      return next;
    });
  };
  const allOnPageSelected = submissions.length > 0 && submissions.every((s) => selected.has(s.id));
  const toggleAllOnPage = () => {
    setSelected(allOnPageSelected ? new Set() : new Set(submissions.map((s) => s.id)));
  };

  // What is currently narrowing the table, as removable chips. Built from the
  // query rather than tracked separately, so the chips cannot disagree with
  // the rows.
  const activeFilters = useMemo(() => {
    const chips: Array<{ key: string; label: string; clear: Partial<SubmissionsQuery> }> = [];
    if (query.search) {
      chips.push({ key: 'search', label: `Contains “${query.search}”`, clear: { search: '' } });
    }
    if (query.status) {
      chips.push({
        key: 'status',
        label: query.status === 'unread' ? 'Unread only' : 'Opened only',
        clear: { status: '' },
      });
    }
    if (query.startDate || query.endDate) {
      const from = query.startDate ? new Date(query.startDate).toLocaleDateString() : null;
      const to = query.endDate ? new Date(query.endDate).toLocaleDateString() : null;
      chips.push({
        key: 'dates',
        label: from && to ? `${from} – ${to}` : from ? `From ${from}` : `Until ${to}`,
        clear: { startDate: '', endDate: '' },
      });
    }
    return chips;
  }, [query]);

  const filterCount = (query.status ? 1 : 0) + (query.startDate || query.endDate ? 1 : 0);
  const selectionCount = selected.size;
  const cellPad = DENSITY[density].cell;

  return (
    <div className="flex h-full min-h-0 flex-col p-4 sm:p-5 lg:p-6">
      {/*
       * One surface.
       *
       * The previous version stacked three bordered stat boxes above a fourth
       * bordered box holding the table: four competing rectangles that read as
       * an admin template. The numbers that mattered have moved into the
       * controls and the footer, where they are actionable.
       */}
      {/* No `overflow-hidden` on the panel, deliberately. It would neatly clip
          the rounded corners and would also clip every toolbar popover the
          moment it dropped past the toolbar's own height. Nothing inside
          reaches a corner — the toolbar and footer are transparent and the
          table's own header is below the toolbar — so there is nothing to
          clip, and the popovers can hang over the rows where they belong. */}
      <section className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-card">

        {/* ── Toolbar ──────────────────────────────────────────────────────
            When rows are selected this whole strip is replaced in place by the
            bulk bar. A separate floating bar would cover the very rows the
            person is deciding about, and a permanent bar of disabled buttons
            is noise on every other visit. */}
        <div ref={toolbarRef} className="relative z-30 shrink-0 border-b border-border/70">
          {selectionCount > 0 ? (
            <div className="flex flex-wrap items-center gap-2 bg-primary/[0.06] px-3 py-2">
              <span className="px-1.5 text-sm font-semibold text-primary">
                {selectionCount} selected
              </span>
              <span className="h-4 w-px bg-primary/20" />
              {onExport && (
                <Chip onClick={() => onExport('csv', Array.from(selected))}>
                  <Download className="h-3.5 w-3.5" />
                  Export selected
                </Chip>
              )}
              {canDelete && onBulkDelete && (
                <Chip tone="danger" onClick={() => onBulkDelete(Array.from(selected))}>
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </Chip>
              )}
              <button
                type="button"
                onClick={() => setSelected(new Set())}
                className="ml-auto rounded-md px-2 py-1 text-xs font-semibold text-muted-foreground hover:bg-card hover:text-foreground"
              >
                Clear selection
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5 px-3 py-2">
              {/* Search sits first and widest: it is the control people reach
                  for before they know which column holds what they want. */}
              <div className="relative min-w-[13rem] flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="search"
                  aria-label="Search every response to this form"
                  placeholder="Search all responses…"
                  value={searchDraft}
                  onChange={(event) => setSearchDraft(event.target.value)}
                  className="h-8 rounded-lg border-transparent bg-ink-50 pl-8 pr-8 text-sm focus-visible:border-input focus-visible:bg-background"
                />
                {searchDraft && (
                  <button
                    type="button"
                    onClick={() => setSearchDraft('')}
                    aria-label="Clear search"
                    className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded text-muted-foreground hover:bg-ink-100 hover:text-foreground"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>

              <Chip
                active={filterCount > 0}
                expanded={menu === 'filter'}
                onClick={() => setMenu(menu === 'filter' ? null : 'filter')}
              >
                <ListFilter className="h-3.5 w-3.5" />
                Filter
                {filterCount > 0 && (
                  <span className="ml-0.5 rounded bg-primary px-1 text-[10px] font-bold leading-4 text-primary-foreground">
                    {filterCount}
                  </span>
                )}
              </Chip>

              <Chip
                active={query.sort !== 'newest'}
                expanded={menu === 'sort'}
                onClick={() => setMenu(menu === 'sort' ? null : 'sort')}
              >
                <ArrowDownUp className="h-3.5 w-3.5" />
                {query.sort === 'oldest' ? 'Oldest first' : 'Newest first'}
              </Chip>

              <Chip expanded={menu === 'columns'} onClick={() => setMenu(menu === 'columns' ? null : 'columns')}>
                <Columns3 className="h-3.5 w-3.5" />
                Columns
                <span className="ml-0.5 text-muted-foreground">{columns.length}</span>
              </Chip>

              <Chip expanded={menu === 'density'} onClick={() => setMenu(menu === 'density' ? null : 'density')}>
                <Rows3 className="h-3.5 w-3.5" />
                <span className="sr-only">Row height</span>
              </Chip>

              {onExport && (
                <Tooltip content="Download every response that matches this view" side="bottom" tone="dark">
                  <Chip onClick={() => onExport('csv')}>
                    <Download className="h-3.5 w-3.5" />
                    Export
                  </Chip>
                </Tooltip>
              )}

              {/* ── Popovers ── */}
              {menu === 'filter' && (
                <Popover label="Filter responses">
                  <PopoverSection title="Status">
                    {([['', 'Everything'], ['unread', 'Unread only'], ['read', 'Opened only']] as const).map(
                      ([value, label]) => (
                        <PopoverOption
                          key={value || 'all'}
                          selected={query.status === value}
                          onClick={() => onQueryChange({ status: value })}
                        >
                          {label}
                        </PopoverOption>
                      ),
                    )}
                  </PopoverSection>

                  <PopoverSection title="Received">
                    <PopoverOption
                      selected={!query.startDate && !query.endDate}
                      onClick={() => onQueryChange({ startDate: '', endDate: '' })}
                    >
                      Any time
                    </PopoverOption>
                    <PopoverOption
                      selected={query.startDate === todayISO() && !query.endDate}
                      onClick={() => onQueryChange({ startDate: todayISO(), endDate: '' })}
                    >
                      Today
                    </PopoverOption>
                    <PopoverOption
                      selected={query.startDate === daysAgoISO(7) && !query.endDate}
                      onClick={() => onQueryChange({ startDate: daysAgoISO(7), endDate: '' })}
                    >
                      Last 7 days
                    </PopoverOption>
                    <PopoverOption
                      selected={query.startDate === daysAgoISO(30) && !query.endDate}
                      onClick={() => onQueryChange({ startDate: daysAgoISO(30), endDate: '' })}
                    >
                      Last 30 days
                    </PopoverOption>
                    <div className="mt-1.5 flex items-center gap-1.5 px-2.5 pb-1">
                      <input
                        type="date"
                        aria-label="Received on or after"
                        value={query.startDate}
                        max={query.endDate || undefined}
                        onChange={(event) => onQueryChange({ startDate: event.target.value })}
                        className="h-7 w-full rounded-md border border-input bg-background px-1.5 text-xs text-foreground"
                      />
                      <span className="text-xs text-muted-foreground">to</span>
                      <input
                        type="date"
                        aria-label="Received on or before"
                        value={query.endDate}
                        min={query.startDate || undefined}
                        onChange={(event) => onQueryChange({ endDate: event.target.value })}
                        className="h-7 w-full rounded-md border border-input bg-background px-1.5 text-xs text-foreground"
                      />
                    </div>
                  </PopoverSection>
                </Popover>
              )}

              {menu === 'sort' && (
                <Popover label="Sort responses">
                  <PopoverSection title="Received">
                    <PopoverOption selected={query.sort === 'newest'} onClick={() => { onQueryChange({ sort: 'newest' }); setMenu(null); }}>
                      Newest first
                    </PopoverOption>
                    <PopoverOption selected={query.sort === 'oldest'} onClick={() => { onQueryChange({ sort: 'oldest' }); setMenu(null); }}>
                      Oldest first
                    </PopoverOption>
                  </PopoverSection>
                  <p className="px-2.5 pb-1.5 pt-1 text-[11px] leading-4 text-muted-foreground">
                    Responses can only be ordered by when they arrived. Sorting by an answer
                    would reorder one page at a time and mislead you about the rest.
                  </p>
                </Popover>
              )}

              {menu === 'columns' && (
                <Popover label="Choose which questions appear as columns">
                  <div className="flex items-center justify-between px-2.5 pb-1 pt-1.5">
                    <p className="text-[11px] text-muted-foreground">Every answer is still in the response.</p>
                    <button
                      type="button"
                      onClick={() => setColumns(defaultColumnIds)}
                      className="text-[11px] font-semibold text-primary hover:underline"
                    >
                      Reset
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto pb-1">
                    {answerableFields.map((field) => (
                      <PopoverOption
                        key={field.id}
                        role="checkbox"
                        selected={columnIds.includes(field.id)}
                        onClick={() => toggleColumn(field.id)}
                      >
                        <span className="truncate">{field.label || 'Untitled question'}</span>
                      </PopoverOption>
                    ))}
                  </div>
                </Popover>
              )}

              {menu === 'density' && (
                <Popover label="Row height">
                  <PopoverSection title="Row height">
                    {(Object.keys(DENSITY) as Density[]).map((value) => (
                      <PopoverOption
                        key={value}
                        selected={density === value}
                        onClick={() => { changeDensity(value); setMenu(null); }}
                      >
                        {DENSITY[value].label}
                      </PopoverOption>
                    ))}
                  </PopoverSection>
                </Popover>
              )}
            </div>
          )}

          {/* Active filters, spelled out. The one thing a filtered table must
              never do is look like an unfiltered one. */}
          {activeFilters.length > 0 && selectionCount === 0 && (
            <div className="flex flex-wrap items-center gap-1.5 border-t border-border/60 bg-ink-50/50 px-3 py-1.5">
              <SlidersHorizontal className="h-3 w-3 shrink-0 text-muted-foreground" />
              {activeFilters.map((chip) => (
                <span
                  key={chip.key}
                  className="inline-flex max-w-[16rem] items-center gap-1 rounded-md border border-border bg-card py-0.5 pl-2 pr-1 text-xs font-medium text-foreground"
                >
                  <span className="truncate">{chip.label}</span>
                  <button
                    type="button"
                    onClick={() => onQueryChange(chip.clear)}
                    aria-label={`Remove filter: ${chip.label}`}
                    className="flex h-4 w-4 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-ink-100 hover:text-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={() => onQueryChange({ search: '', status: '', startDate: '', endDate: '' })}
                className="rounded px-1.5 py-0.5 text-xs font-semibold text-primary hover:underline"
              >
                Clear all
              </button>
            </div>
          )}
        </div>

        {/* ── The responses ────────────────────────────────────────────────
            Two width problems have to be solved at once. A table of eight
            questions cannot fit in a panel, and squeezing it to fit turns every
            column into a two-character sliver — so the table is allowed to be
            wider than its container and the container scrolls sideways. But a
            table you have scrolled sideways loses its anchor: you are looking
            at column six with no idea which response the row belongs to. So the
            response number stays pinned to the left edge and the row actions
            stay pinned to the right, and only the answers move. */}
        <div className="relative min-h-0 flex-1">
          <div ref={scrollRef} className="scrollbar-subtle h-full overflow-auto">
            {error ? (
              <div className="m-4 rounded-lg border border-destructive/20 bg-destructive/[0.05] px-4 py-6 text-center text-sm font-medium text-destructive">
                {error}
              </div>
            ) : submissions.length === 0 && !isLoading ? (
              <EmptyState
                filtered={activeFilters.length > 0}
                onClear={() => onQueryChange({ search: '', status: '', startDate: '', endDate: '' })}
              />
            ) : (
              <>
                {/* Desktop: a real table, `table-fixed` so the column widths in
                    the colgroup are honoured exactly and every cell can truncate
                    predictably. `w-max` lets the total exceed the container. */}
                <table className="hidden w-max min-w-full table-fixed border-collapse text-sm md:table">
                  <colgroup>
                    <col style={{ width: NUMBER_COL_WIDTH }} />
                    <col style={{ width: RECEIVED_COL_WIDTH }} />
                    {columns.map((field) => <col key={field.id} style={{ width: ANSWER_COL_WIDTH }} />)}
                    <col style={{ width: ACTIONS_COL_WIDTH }} />
                  </colgroup>
                  <thead className="sticky top-0 z-20">
                    <tr>
                      <th
                        scope="col"
                        style={{ left: 0, width: NUMBER_COL_WIDTH }}
                        className="sticky z-30 border-b border-border bg-ink-50 px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-500"
                      >
                        <label className="flex cursor-pointer items-center gap-2">
                          <CheckBox
                            checked={allOnPageSelected}
                            indeterminate={selectionCount > 0 && !allOnPageSelected}
                            onChange={toggleAllOnPage}
                            label="Select every response on this page"
                          />
                          <span aria-hidden="true">#</span>
                        </label>
                      </th>
                      {/* The only genuinely sortable column. Answers are not
                          sortable because the server pages before it could
                          order them, and a per-page sort is a lie. */}
                      <th
                        scope="col"
                        aria-sort={query.sort === 'oldest' ? 'ascending' : 'descending'}
                        style={{ left: NUMBER_COL_WIDTH, width: RECEIVED_COL_WIDTH }}
                        className="sticky z-30 border-b border-r border-border/70 bg-ink-50 p-0 text-left"
                      >
                        <button
                          type="button"
                          onClick={() => onQueryChange({ sort: query.sort === 'newest' ? 'oldest' : 'newest' })}
                          className="flex h-full w-full items-center gap-1 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-500 hover:text-foreground"
                        >
                          Received
                          <ChevronDown
                            className={`h-3 w-3 transition-transform ${query.sort === 'oldest' ? 'rotate-180' : ''}`}
                          />
                        </button>
                      </th>
                      {columns.map((field) => (
                        <th
                          key={field.id}
                          scope="col"
                          className={`border-b border-border bg-ink-50 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-500 ${
                            isNumericField(field) ? 'text-right' : 'text-left'
                          }`}
                        >
                          <span className="block truncate" data-truncated-text={field.label || 'Untitled question'}>
                            {field.label || 'Untitled question'}
                          </span>
                        </th>
                      ))}
                      <th
                        scope="col"
                        style={{ right: 0, width: ACTIONS_COL_WIDTH }}
                        className="sticky z-30 border-b border-l border-border/70 bg-ink-50 px-3 py-2"
                      >
                        <span className="sr-only">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {isLoading && submissions.length === 0
                      ? <SkeletonRows columns={columns.length} cellPad={cellPad} />
                      : submissions.map((submission) => {
                        const isOpen = open?.id === submission.id;
                        const isSelected = selected.has(submission.id);
                        // Sticky cells need their own background or the
                        // scrolling answers show through them.
                        const pinnedBg = isSelected ? 'bg-primary/[0.07]'
                          : isOpen ? 'bg-[#F4F5FF]'
                            : 'bg-card group-hover:bg-ink-50/70';
                        return (
                          <tr
                            key={submission.id}
                            onClick={() => setOpenSubmissionId(submission.id)}
                            className={`group cursor-pointer border-b border-border/40 transition-colors last:border-b-0 ${
                              isSelected ? 'bg-primary/[0.05]' : isOpen ? 'bg-primary/[0.035]' : 'hover:bg-ink-50/70'
                            }`}
                          >
                            <td
                              style={{ left: 0 }}
                              className={`sticky z-10 px-3 align-middle transition-colors ${cellPad} ${pinnedBg}`}
                              onClick={(event) => event.stopPropagation()}
                            >
                              {isOpen && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-primary" />}
                              {/* The number is the checkbox. Hovering or
                                  selecting swaps one for the other, which buys
                                  a whole column back and is the pattern people
                                  already know from Attio and Linear. */}
                              <span className="flex items-center gap-2">
                                <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                                  <span className={`absolute tabular-nums text-xs font-medium text-ink-400 transition-opacity ${
                                    isSelected ? 'opacity-0' : 'opacity-100 group-hover:opacity-0'
                                  }`}>
                                    {responseNumber(submission.id)}
                                  </span>
                                  <span className={`transition-opacity ${
                                    isSelected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-within:opacity-100'
                                  }`}>
                                    <CheckBox
                                      checked={isSelected}
                                      onChange={() => toggleRow(submission.id)}
                                      label={`Select response ${responseNumber(submission.id)}`}
                                    />
                                  </span>
                                </span>
                                {!submission.isRead && (
                                  <span aria-label="Not opened yet" title="Not opened yet" className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                                )}
                              </span>
                            </td>
                            <td
                              style={{ left: NUMBER_COL_WIDTH }}
                              className={`sticky z-10 border-r border-border/70 px-4 align-middle transition-colors ${cellPad} ${pinnedBg}`}
                            >
                              <span className={`block truncate text-foreground ${submission.isRead ? '' : 'font-semibold'}`}>
                                {relativeTime(submission.createdAt)}
                              </span>
                              {density !== 'compact' && (
                                <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                                  {formatDateTime(submission.createdAt)}
                                </span>
                              )}
                            </td>
                            {columns.map((field) => {
                              const text = plainValue(field, submission.data[field.id]);
                              const redacted = submission.redactedFields?.includes(field.id);
                              return (
                                <td
                                  key={field.id}
                                  className={`px-4 align-middle ${cellPad} ${
                                    isNumericField(field) ? 'text-right tabular-nums' : ''
                                  }`}
                                >
                                  {redacted ? (
                                    <span className="italic text-muted-foreground">Hidden</span>
                                  ) : text ? (
                                    /* One line, cut cleanly. The full value is
                                       one hover away — see useTruncationTooltip. */
                                    <span className="block truncate text-foreground" data-truncated-text={text}>{text}</span>
                                  ) : (
                                    <span className="text-ink-300">—</span>
                                  )}
                                </td>
                              );
                            })}
                            <td
                              style={{ right: 0 }}
                              className={`sticky z-10 border-l border-border/70 px-2 text-right align-middle transition-colors ${cellPad} ${pinnedBg}`}
                            >
                              {/* Two buttons on every row is two hundred
                                  buttons on a full page. They appear on the row
                                  under the pointer, and stay for keyboard users
                                  through focus-within. */}
                              <div className={`flex items-center justify-end gap-0.5 transition-opacity focus-within:opacity-100 group-hover:opacity-100 ${
                                isOpen ? 'opacity-100' : 'opacity-0'
                              }`}>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={(event) => { event.stopPropagation(); setOpenSubmissionId(submission.id); }}
                                  className="h-7 rounded-md px-2 text-xs font-semibold text-primary hover:bg-primary/[0.07]"
                                >
                                  Open
                                </Button>
                                {canDelete && (
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    aria-label={`Delete response ${responseNumber(submission.id)}`}
                                    onClick={(event) => { event.stopPropagation(); onDelete(submission.id); }}
                                    className="h-7 w-7 rounded-md text-muted-foreground hover:bg-destructive/[0.07] hover:text-destructive"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>

                {/* Mobile: the same rows, stacked, because a six-column table on
                    a phone is unreadable however it is styled. */}
                <ul className="divide-y divide-border/60 md:hidden">
                  {submissions.map((submission) => (
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

          {/* A fade at the right edge is the only honest way to say "there is
              more table over here" without adding a control nobody asked for.
              It sits outside the scrolling element so it stays pinned to the
              edge, and it disappears the moment the end is reached. */}
          {canScrollRight && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-card via-card/80 to-transparent"
            />
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────────
            Full width, under the thing it paginates, and it names the set. A
            page number with no total is the most common way a table loses
            someone. */}
        <div className="flex shrink-0 flex-col gap-2 border-t border-border/70 px-3 py-2 sm:flex-row sm:items-center sm:justify-between">
          {/* Announced politely, because a filter that changes the row count
              gives a screen-reader user no other signal that anything moved. */}
          <p aria-live="polite" className="text-xs text-muted-foreground">
            {pagination.total === 0 ? (
              activeFilters.length > 0 ? 'No responses match' : 'No responses yet'
            ) : (
              <>
                <span className="font-semibold text-foreground">{firstOnPage.toLocaleString()}–{lastOnPage.toLocaleString()}</span>
                {' of '}
                <span className="font-semibold text-foreground">{pagination.total.toLocaleString()}</span>
                {activeFilters.length > 0 ? ' matching responses' : ' responses'}
              </>
            )}
          </p>

          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="hidden sm:inline">Rows</span>
              <select
                value={pagination.limit}
                onChange={(event) => onLimitChange(Number(event.target.value))}
                className="h-7 rounded-md border border-input bg-background px-1.5 text-xs text-foreground"
                aria-label="Responses per page"
              >
                {PAGE_SIZES.map((size) => <option key={size} value={size}>{size}</option>)}
              </select>
            </label>

            {pagination.totalPages > 1 && (
              <div className="flex items-center gap-0.5">
                <Button
                  type="button" variant="ghost" size="icon"
                  aria-label="Previous page"
                  disabled={pagination.page <= 1 || isLoading}
                  onClick={() => onPageChange(pagination.page - 1)}
                  className="h-7 w-7 rounded-md"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-1.5 text-xs text-muted-foreground">
                  <span className="font-semibold text-foreground">{pagination.page}</span> / {pagination.totalPages}
                </span>
                <Button
                  type="button" variant="ghost" size="icon"
                  aria-label="Next page"
                  disabled={pagination.page >= pagination.totalPages || isLoading}
                  onClick={() => onPageChange(pagination.page + 1)}
                  className="h-7 w-7 rounded-md"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>

      {open && (
        <SubmissionDetailModal
          submission={open}
          number={responseNumber(open.id)}
          fields={fields}
          canDelete={canDelete}
          onClose={() => setOpenSubmissionId(null)}
          onDelete={() => onDelete(open.id)}
          onPrevious={openIndex > 0 ? () => setOpenSubmissionId(submissions[openIndex - 1].id) : undefined}
          onNext={openIndex >= 0 && openIndex < submissions.length - 1 ? () => setOpenSubmissionId(submissions[openIndex + 1].id) : undefined}
        />
      )}

      {truncationTooltip}
    </div>
  );
}

/* ── Toolbar primitives ─────────────────────────────────────────────────────
   One shape for every toolbar control, so the strip reads as a set rather than
   as a collection of differently-sized buttons. */

function Chip({
  children, onClick, active = false, expanded, tone = 'default',
}: {
  children: React.ReactNode;
  onClick: () => void;
  active?: boolean;
  expanded?: boolean;
  tone?: 'default' | 'danger';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={expanded}
      aria-haspopup={expanded === undefined ? undefined : 'true'}
      className={`inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-lg border px-2.5 text-xs font-semibold transition-colors ${
        tone === 'danger'
          ? 'border-destructive/25 bg-card text-destructive hover:bg-destructive/[0.07]'
          : active || expanded
            ? 'border-primary/30 bg-primary/[0.07] text-primary'
            : 'border-transparent bg-transparent text-ink-600 hover:bg-ink-50'
      }`}
    >
      {children}
    </button>
  );
}

function Popover({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div
      role="group"
      aria-label={label}
      className="absolute right-0 top-full z-40 mt-1 w-64 overflow-hidden rounded-xl border border-border bg-card py-1 shadow-[0_12px_32px_-8px_rgba(15,23,42,0.18)]"
    >
      {children}
    </div>
  );
}

function PopoverSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-border/60 pb-1 last:border-b-0 last:pb-0">
      <p className="px-2.5 pb-1 pt-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground">
        {title}
      </p>
      {children}
    </div>
  );
}

function PopoverOption({
  children, selected, onClick, role = 'menuitemradio',
}: {
  children: React.ReactNode;
  selected: boolean;
  onClick: () => void;
  role?: 'menuitemradio' | 'checkbox';
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={selected}
      onClick={onClick}
      className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm text-foreground hover:bg-ink-50"
    >
      <Check className={`h-3.5 w-3.5 shrink-0 text-primary ${selected ? 'opacity-100' : 'opacity-0'}`} strokeWidth={3} />
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </button>
  );
}

/** A checkbox that looks like the rest of the product rather than the browser's. */
function CheckBox({
  checked, onChange, label, indeterminate = false,
}: {
  checked: boolean;
  onChange: () => void;
  label: string;
  indeterminate?: boolean;
}) {
  return (
    <span className="relative flex h-4 w-4 items-center justify-center">
      <input
        type="checkbox"
        checked={checked}
        aria-label={label}
        ref={(node) => { if (node) node.indeterminate = indeterminate && !checked; }}
        onChange={onChange}
        onClick={(event) => event.stopPropagation()}
        className="peer h-4 w-4 cursor-pointer appearance-none rounded border border-ink-300 bg-card transition-colors checked:border-primary checked:bg-primary indeterminate:border-primary indeterminate:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
      <Check
        aria-hidden="true"
        className="pointer-events-none absolute h-3 w-3 text-primary-foreground opacity-0 peer-checked:opacity-100 peer-indeterminate:opacity-100"
        strokeWidth={3}
      />
    </span>
  );
}

/**
 * Placeholder rows at the real row height.
 *
 * A spinner in the middle of an empty panel makes the layout jump when the
 * data lands. Skeletons hold the table still, so the only thing that changes
 * is the text.
 */
function SkeletonRows({ columns, cellPad }: { columns: number; cellPad: string }) {
  return (
    <>
      {Array.from({ length: 8 }).map((_, row) => (
        <tr key={row} className="border-b border-border/40">
          {Array.from({ length: columns + 3 }).map((__, cell) => (
            <td key={cell} className={`px-4 ${cellPad}`}>
              <span
                className="block h-3 animate-pulse rounded bg-ink-100"
                style={{ width: cell === 0 ? '1.5rem' : `${55 + ((row * 7 + cell * 13) % 40)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

function EmptyState({ filtered, onClear }: { filtered: boolean; onClear: () => void }) {
  return (
    <div className="flex h-full min-h-64 items-center justify-center px-6 py-12 text-center">
      <div className="max-w-sm">
        <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-ink-50 text-ink-400">
          <Inbox className="h-5 w-5" strokeWidth={1.7} />
        </span>
        <p className="mt-3.5 text-sm font-semibold text-foreground">
          {filtered ? 'No responses match this view' : 'No responses yet'}
        </p>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">
          {filtered
            ? 'Try a broader date range, or clear the filters to see everything.'
            : 'Share the form’s link and the answers people send will show up here automatically.'}
        </p>
        {filtered && (
          <Button type="button" variant="outline" size="sm" onClick={onClear} className="mt-3 h-8 rounded-lg text-xs">
            Clear filters
          </Button>
        )}
      </div>
    </div>
  );
}
