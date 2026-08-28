import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  CornerDownRight,
  Maximize2,
  Network,
  Search,
  UsersRound,
  X,
} from 'lucide-react';
import type { TeamNode } from '../../types';
import { cn } from '../../lib/utils';
import { Button } from '../ui/button';

interface TeamTreeSelectProps {
  teams: TeamNode[];
  value: string | null;
  onChange: (teamId: string) => void;
  isLoading?: boolean;
}

interface FlatTeam {
  team: TeamNode;
  level: number;
  ancestorIds: string[];
  pathNames: string[];
}

const QUICK_PREVIEW_DEPTH = 1;
const QUICK_PREVIEW_LIMIT = 6;
const QUICK_SEARCH_LIMIT = 8;

/** Iterative flattening keeps unusually deep team structures safe to render. */
function flattenTeams(roots: TeamNode[]): FlatTeam[] {
  const rows: FlatTeam[] = [];
  const stack = [...roots]
    .reverse()
    .map((team) => ({ team, level: 0, ancestorIds: [] as string[], pathNames: [] as string[] }));

  while (stack.length > 0) {
    const row = stack.pop();
    if (!row) break;
    rows.push(row);
    for (let index = row.team.children.length - 1; index >= 0; index -= 1) {
      stack.push({
        team: row.team.children[index],
        level: row.level + 1,
        ancestorIds: [...row.ancestorIds, row.team.id],
        pathNames: [...row.pathNames, row.team.name],
      });
    }
  }
  return rows;
}

function matchesSearch(row: FlatTeam, query: string) {
  return [...row.pathNames, row.team.name].join(' / ').toLowerCase().includes(query);
}

/**
 * A bounded quick picker plus a dedicated full-tree browser. The compact menu
 * cannot grow beyond the form modal, while the portal browser can safely show
 * every depth without affecting any surrounding UI.
 */
export default function TeamTreeSelect({ teams, value, onChange, isLoading = false }: TeamTreeSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [browserOpen, setBrowserOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [browserSearch, setBrowserSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const rows = useMemo(() => flattenTeams(teams), [teams]);
  const selected = rows.find((row) => row.team.id === value);
  const expandableIds = rows.filter((row) => row.team.children.length > 0).map((row) => row.team.id);
  const normalizedQuickSearch = quickSearch.trim().toLowerCase();
  const normalizedBrowserSearch = browserSearch.trim().toLowerCase();
  const previewRows = rows
    .filter((row) => row.level <= QUICK_PREVIEW_DEPTH)
    .slice(0, QUICK_PREVIEW_LIMIT);
  const quickRows = normalizedQuickSearch
    ? rows.filter((row) => matchesSearch(row, normalizedQuickSearch)).slice(0, QUICK_SEARCH_LIMIT)
    : previewRows;
  const fullRows = normalizedBrowserSearch
    ? rows.filter((row) => matchesSearch(row, normalizedBrowserSearch))
    : rows.filter((row) =>
        row.ancestorIds.every((ancestorId, ancestorIndex) =>
          expanded[ancestorId] ?? ancestorIndex === 0
        )
      );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setQuickSearch('');
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setQuickSearch('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (!browserOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setBrowserOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [browserOpen]);

  const choose = (teamId: string) => {
    onChange(teamId);
    setOpen(false);
    setBrowserOpen(false);
    setQuickSearch('');
    setBrowserSearch('');
  };

  const openFullBrowser = () => {
    if (selected) {
      setExpanded((current) => ({
        ...current,
        ...Object.fromEntries(selected.ancestorIds.map((id) => [id, true])),
      }));
    }
    setOpen(false);
    setQuickSearch('');
    setBrowserOpen(true);
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id="formTeam"
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={isLoading || rows.length === 0}
        className="flex min-h-10 w-full items-center gap-2.5 rounded-lg border border-input bg-card px-3 text-left transition-colors hover:border-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/[0.06] text-primary">
          <UsersRound className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-foreground">
            {isLoading ? 'Loading teams…' : selected?.team.name || 'Choose a team'}
          </span>
          {selected && selected.pathNames.length > 0 && (
            <span className="mt-0.5 block truncate text-[9px] font-medium text-muted-foreground">
              {[...selected.pathNames, selected.team.name].join(' / ')}
            </span>
          )}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-[80] mt-2 flex max-h-[min(20rem,calc(100dvh-12rem))] w-full flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
          <div className="shrink-0 border-b border-border/70 p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                type="search"
                value={quickSearch}
                onChange={(event) => setQuickSearch(event.target.value)}
                placeholder="Search teams…"
                className="h-8 w-full rounded-lg border border-input bg-background pl-9 pr-8 text-[11px] outline-none placeholder:text-muted-foreground focus:border-primary/35 focus:ring-2 focus:ring-primary/10"
              />
              {quickSearch && (
                <button type="button" onClick={() => setQuickSearch('')} aria-label="Clear team search" className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="shrink-0 border-b border-border/70 bg-ink-50/70 px-3 py-1.5 text-[9px] font-semibold text-muted-foreground">
            {normalizedQuickSearch
              ? `Showing up to ${QUICK_SEARCH_LIMIT} matching teams`
              : 'Quick view · first two hierarchy levels'}
          </div>

          <div role="listbox" aria-label="Teams" className="scrollbar-compact min-h-0 flex-1 overflow-y-auto p-1.5">
            {quickRows.length > 0 ? (
              <div className="space-y-0.5">
                {quickRows.map((row) => {
                  const isSelected = row.team.id === value;
                  return (
                    <button
                      key={row.team.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => choose(row.team.id)}
                      className={cn(
                        'flex w-full min-w-0 items-center gap-2 rounded-lg py-2 pr-2 text-left transition-colors',
                        isSelected ? 'bg-primary/[0.065]' : 'hover:bg-muted/60'
                      )}
                      style={{ paddingLeft: normalizedQuickSearch ? '8px' : `${8 + row.level * 16}px` }}
                    >
                      {!normalizedQuickSearch && row.level > 0 && <CornerDownRight className="h-3 w-3 shrink-0 text-ink-300" />}
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-card text-ink-500">
                        <UsersRound className="h-3 w-3" strokeWidth={1.7} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[11px] font-semibold text-foreground">{row.team.name}</span>
                        {normalizedQuickSearch && (
                          <span className="mt-0.5 block truncate text-[9px] font-medium text-muted-foreground">
                            {[...row.pathNames, row.team.name].join(' / ')}
                          </span>
                        )}
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-[11px] font-medium text-muted-foreground">No matching team.</div>
            )}
          </div>

          <button
            type="button"
            onClick={openFullBrowser}
            className="flex h-10 shrink-0 items-center justify-between gap-3 border-t border-border/70 bg-ink-50/70 px-3 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/[0.05]"
          >
            <span>Browse full team structure</span>
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {browserOpen && createPortal(
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-3 sm:p-5">
          <button type="button" aria-label="Close full team browser" onClick={() => setBrowserOpen(false)} className="absolute inset-0 bg-ink-950/35 backdrop-blur-[1px]" />
          <section role="dialog" aria-modal="true" aria-labelledby="team-browser-title" className="relative z-10 flex max-h-[86dvh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[0_24px_70px_rgba(15,23,42,0.22)]">
            <header className="flex shrink-0 items-start justify-between gap-3 border-b border-border/70 px-4 py-3.5 sm:px-5 sm:py-4">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-primary/10 bg-primary/[0.06] text-primary">
                  <Network className="h-4 w-4" strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <h2 id="team-browser-title" className="font-display text-base font-bold text-foreground">Choose a team</h2>
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">Browse every branch or search by team name.</p>
                </div>
              </div>
              <button type="button" onClick={() => setBrowserOpen(false)} aria-label="Close team browser" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground">
                <X className="h-4 w-4" />
              </button>
            </header>

            <div className="shrink-0 border-b border-border/70 p-3 sm:px-5">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  autoFocus
                  type="search"
                  value={browserSearch}
                  onChange={(event) => setBrowserSearch(event.target.value)}
                  placeholder="Search the complete team structure…"
                  className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-9 text-[12px] outline-none placeholder:text-muted-foreground focus:border-primary/35 focus:ring-2 focus:ring-primary/10"
                />
                {browserSearch && (
                  <button type="button" onClick={() => setBrowserSearch('')} aria-label="Clear full team search" className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border/70 bg-ink-50/70 px-4 py-2 sm:px-5">
              <p className="text-[10px] font-semibold text-muted-foreground">
                {normalizedBrowserSearch ? `${fullRows.length} matches` : `${rows.length} teams in this workspace`}
              </p>
              {!normalizedBrowserSearch && expandableIds.length > 0 && (
                <div className="flex items-center gap-1">
                  <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(Object.fromEntries(expandableIds.map((id) => [id, true])))} className="h-7 px-2 text-[10px] text-muted-foreground">
                    <ChevronsDown className="mr-1 h-3.5 w-3.5" /> Expand all
                  </Button>
                  <Button type="button" variant="ghost" size="sm" onClick={() => setExpanded(Object.fromEntries(expandableIds.map((id) => [id, false])))} className="h-7 px-2 text-[10px] text-muted-foreground">
                    <ChevronsUp className="mr-1 h-3.5 w-3.5" /> Collapse
                  </Button>
                </div>
              )}
            </div>

            <div role="listbox" aria-label="Full team structure" className="scrollbar-subtle min-h-0 flex-1 overflow-auto p-2.5 sm:p-3">
              {fullRows.length > 0 ? (
                <div className={cn('space-y-0.5', !normalizedBrowserSearch && 'min-w-max')}>
                  {fullRows.map((row) => {
                    const hasChildren = row.team.children.length > 0;
                    const isExpanded = expanded[row.team.id] ?? row.level === 0;
                    const isSelected = row.team.id === value;
                    return normalizedBrowserSearch ? (
                      <button key={row.team.id} type="button" role="option" aria-selected={isSelected} onClick={() => choose(row.team.id)} className={cn('flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left', isSelected ? 'bg-primary/[0.065]' : 'hover:bg-muted/60')}>
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-card text-ink-500"><UsersRound className="h-3.5 w-3.5" /></span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-xs font-semibold text-foreground">{row.team.name}</span>
                          <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">{[...row.pathNames, row.team.name].join(' / ')}</span>
                        </span>
                        {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    ) : (
                      <div key={row.team.id} className={cn('flex min-w-full items-center rounded-lg pr-2', isSelected ? 'bg-primary/[0.065]' : 'hover:bg-muted/60')} style={{ paddingLeft: `${6 + row.level * 20}px` }}>
                        <button type="button" disabled={!hasChildren} onClick={() => setExpanded((current) => ({ ...current, [row.team.id]: !isExpanded }))} aria-label={isExpanded ? `Collapse ${row.team.name}` : `Expand ${row.team.name}`} className="flex h-9 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-card disabled:opacity-20">
                          {hasChildren ? (isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="h-3.5 w-3.5" />}
                        </button>
                        <button type="button" role="option" aria-selected={isSelected} onClick={() => choose(row.team.id)} className="flex h-10 min-w-64 flex-1 items-center gap-2 py-1 text-left">
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-card text-ink-500"><UsersRound className="h-3 w-3" /></span>
                          <span className="whitespace-nowrap text-xs font-semibold text-foreground">{row.team.name}</span>
                          {row.team.isDefault && <span className="rounded-full border border-border bg-card px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">Default</span>}
                          <span className="ml-auto whitespace-nowrap text-[10px] font-medium text-muted-foreground">{row.team._count?.members ?? 0} member{(row.team._count?.members ?? 0) === 1 ? '' : 's'}</span>
                          {isSelected && <Check className="ml-1 h-4 w-4 shrink-0 text-primary" />}
                        </button>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex h-40 items-center justify-center text-xs font-medium text-muted-foreground">No matching team.</div>
              )}
            </div>

            <footer className="shrink-0 border-t border-border/70 bg-ink-50/70 px-4 py-2.5 sm:px-5">
              <p className="truncate text-[10px] font-medium text-muted-foreground">
                Selected: <span className="font-semibold text-foreground">{selected ? [...selected.pathNames, selected.team.name].join(' / ') : 'No team selected'}</span>
              </p>
            </footer>
          </section>
        </div>,
        document.body
      )}
    </div>
  );
}
