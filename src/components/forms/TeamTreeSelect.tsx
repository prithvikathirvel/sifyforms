import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Search,
  UsersRound,
  X,
} from 'lucide-react';
import type { TeamNode } from '../../types';
import { cn } from '../../lib/utils';

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

/** Iterative flattening avoids recursive rendering limits for unusually deep trees. */
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

/** A searchable, horizontally scrollable tree picker for form ownership. */
export default function TeamTreeSelect({ teams, value, onChange, isLoading = false }: TeamTreeSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const rows = useMemo(() => flattenTeams(teams), [teams]);
  const selected = rows.find((row) => row.team.id === value);
  const expandableIds = rows.filter((row) => row.team.children.length > 0).map((row) => row.team.id);
  const normalizedSearch = search.trim().toLowerCase();

  const visibleTreeRows = rows.filter((row) =>
    row.ancestorIds.every((ancestorId, ancestorIndex) =>
      expanded[ancestorId] ?? ancestorIndex === 0
    )
  );
  const searchRows = normalizedSearch
    ? rows.filter((row) =>
        [...row.pathNames, row.team.name].join(' / ').toLowerCase().includes(normalizedSearch)
      )
    : [];

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const toggleOpen = () => {
    const nextOpen = !open;
    if (nextOpen && selected) {
      setExpanded((current) => ({
        ...current,
        ...Object.fromEntries(selected.ancestorIds.map((id) => [id, true])),
      }));
    }
    setOpen(nextOpen);
    if (!nextOpen) setSearch('');
  };

  const choose = (teamId: string) => {
    onChange(teamId);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        id="formTeam"
        onClick={toggleOpen}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={isLoading || rows.length === 0}
        className="flex min-h-11 w-full items-center gap-2.5 rounded-lg border border-input bg-card px-3 text-left transition-colors hover:border-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/[0.06] text-primary">
          <UsersRound className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-foreground">
            {isLoading ? 'Loading teams…' : selected?.team.name || 'Choose a team'}
          </span>
          {selected && selected.pathNames.length > 0 && (
            <span className="mt-0.5 block truncate text-[10px] font-medium text-muted-foreground">
              {[...selected.pathNames, selected.team.name].join(' / ')}
            </span>
          )}
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-[80] mt-2 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-[0_12px_32px_rgba(15,23,42,0.12)]">
          <div className="border-b border-border/70 p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search any team or branch…"
                className="h-9 w-full rounded-lg border border-input bg-background pl-9 pr-9 text-[12px] outline-none placeholder:text-muted-foreground focus:border-primary/35 focus:ring-2 focus:ring-primary/10"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  aria-label="Clear team search"
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-ink-50/70 px-3 py-2">
            <p className="text-[10px] font-semibold text-muted-foreground">
              {normalizedSearch
                ? `${searchRows.length} matching team${searchRows.length === 1 ? '' : 's'}`
                : `${rows.length} team${rows.length === 1 ? '' : 's'} · select the form owner`}
            </p>
            {!normalizedSearch && expandableIds.length > 0 && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setExpanded(Object.fromEntries(expandableIds.map((id) => [id, true])))}
                  title="Expand all branches"
                  aria-label="Expand all team branches"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                >
                  <ChevronsDown className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(Object.fromEntries(expandableIds.map((id) => [id, false])))}
                  title="Collapse all branches"
                  aria-label="Collapse all team branches"
                  className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-card hover:text-foreground"
                >
                  <ChevronsUp className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <div role="listbox" aria-label="Teams" className="max-h-72 overflow-auto overscroll-contain p-1.5">
            {normalizedSearch ? (
              searchRows.length > 0 ? (
                <div className="space-y-0.5">
                  {searchRows.map((row) => {
                    const isSelected = row.team.id === value;
                    return (
                      <button
                        key={row.team.id}
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => choose(row.team.id)}
                        className={cn(
                          'flex w-full min-w-0 items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors',
                          isSelected ? 'bg-primary/[0.065]' : 'hover:bg-muted/60'
                        )}
                      >
                        <span className={cn(
                          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md border',
                          isSelected ? 'border-primary/15 bg-card text-primary' : 'border-border bg-ink-50 text-ink-500'
                        )}>
                          <UsersRound className="h-3.5 w-3.5" strokeWidth={1.7} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[12px] font-semibold text-foreground">{row.team.name}</span>
                          <span className="mt-0.5 block truncate text-[10px] font-medium text-muted-foreground">
                            {[...row.pathNames, row.team.name].join(' / ')}
                          </span>
                        </span>
                        {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-8 text-center">
                  <Search className="mx-auto h-5 w-5 text-ink-300" />
                  <p className="mt-2 text-xs font-semibold text-foreground">No matching team</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">Try a team name from another branch.</p>
                </div>
              )
            ) : (
              <div className="min-w-max space-y-0.5">
                {visibleTreeRows.map((row) => {
                  const hasChildren = row.team.children.length > 0;
                  const isExpanded = expanded[row.team.id] ?? row.level === 0;
                  const isSelected = row.team.id === value;
                  return (
                    <div
                      key={row.team.id}
                      className={cn(
                        'flex min-w-full items-center rounded-lg pr-2 transition-colors',
                        isSelected ? 'bg-primary/[0.065]' : 'hover:bg-muted/60'
                      )}
                      style={{ paddingLeft: `${6 + row.level * 20}px` }}
                    >
                      <button
                        type="button"
                        disabled={!hasChildren}
                        onClick={() => setExpanded((current) => ({ ...current, [row.team.id]: !isExpanded }))}
                        aria-label={isExpanded ? `Collapse ${row.team.name}` : `Expand ${row.team.name}`}
                        className="flex h-8 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-card disabled:opacity-20"
                      >
                        {hasChildren ? (
                          isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />
                        ) : (
                          <span className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => choose(row.team.id)}
                        className="flex h-10 min-w-52 flex-1 items-center gap-2 py-1 text-left"
                      >
                        <span className={cn(
                          'flex h-6 w-6 shrink-0 items-center justify-center rounded-md border',
                          isSelected ? 'border-primary/15 bg-card text-primary' : 'border-border bg-ink-50 text-ink-500'
                        )}>
                          <UsersRound className="h-3 w-3" strokeWidth={1.7} />
                        </span>
                        <span className="whitespace-nowrap text-[12px] font-semibold text-foreground">{row.team.name}</span>
                        {row.team.isDefault && (
                          <span className="rounded-full border border-border bg-card px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                            Default
                          </span>
                        )}
                        <span className="ml-auto whitespace-nowrap text-[10px] font-medium text-muted-foreground">
                          {row.team._count?.members ?? 0} member{(row.team._count?.members ?? 0) === 1 ? '' : 's'}
                        </span>
                        {isSelected && <Check className="ml-1 h-4 w-4 shrink-0 text-primary" />}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border-t border-border/70 bg-ink-50/70 px-3 py-2">
            <p className="text-[10px] font-medium text-muted-foreground">
              Deep branches scroll horizontally. Search shows the complete path to every match.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
