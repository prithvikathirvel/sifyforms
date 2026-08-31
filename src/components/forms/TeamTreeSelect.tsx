import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Search,
  UsersRound,
  X,
} from 'lucide-react';
import type { Team } from '../../types';
import { cn } from '../../lib/utils';

interface TeamTreeSelectProps {
  teams: Team[];
  value: string | null;
  onChange: (teamId: string) => void;
  isLoading?: boolean;
}

/**
 * A flat team picker. Teams are organizational buckets with no hierarchy, so a
 * simple searchable list is the whole control.
 */
export default function TeamTreeSelect({ teams, value, onChange, isLoading = false }: TeamTreeSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');

  const normalized = search.trim().toLowerCase();
  const rows = useMemo(() => {
    if (!normalized) return teams;
    return teams.filter((team) => team.name.toLowerCase().includes(normalized));
  }, [teams, normalized]);

  const selected = teams.find((team) => team.id === value) ?? null;

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
        onClick={() => setOpen((current) => !current)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={isLoading || teams.length === 0}
        className="flex min-h-10 w-full items-center gap-2.5 rounded-lg border border-input bg-card px-3 text-left transition-colors hover:border-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/[0.06] text-primary">
          <UsersRound className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-foreground">
            {isLoading ? 'Loading teams…' : selected?.name || 'Choose a team'}
          </span>
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
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search teams…"
                className="h-8 w-full rounded-lg border border-input bg-background pl-9 pr-8 text-[11px] outline-none placeholder:text-muted-foreground focus:border-ink-400 focus:ring-4 focus:ring-primary/[0.06]"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} aria-label="Clear team search" className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div role="listbox" aria-label="Teams" className="scrollbar-compact min-h-0 flex-1 overflow-y-auto p-1.5">
            {rows.length > 0 ? (
              <div className="space-y-0.5">
                {rows.map((team) => {
                  const isSelected = team.id === value;
                  return (
                    <button
                      key={team.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => choose(team.id)}
                      className={cn(
                        'flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                        isSelected ? 'bg-primary/[0.065]' : 'hover:bg-muted/60'
                      )}
                    >
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-card text-ink-500">
                        <UsersRound className="h-3 w-3" strokeWidth={1.7} />
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-foreground">
                        {team.name}
                        {team.isDefault && <span className="ml-1.5 text-[9px] font-medium text-muted-foreground">· default</span>}
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
        </div>
      )}
    </div>
  );
}
