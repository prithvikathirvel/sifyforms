import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  Search,
  UsersRound,
  X,
  Folder,
  Shield,
  CornerDownRight,
} from 'lucide-react';
import type { Team } from '../../types';
import { cn } from '../../lib/utils';

interface TeamTreeSelectProps {
  teams: Team[];
  value: string | null;
  onChange: (teamId: string | null) => void;
  isLoading?: boolean;
  placeholder?: string;
  excludeId?: string;
  maxDepth?: number;
  allowRoot?: boolean;
}

interface FlatNode {
  team: Team;
  path: string;
  depth: number;
}

function flattenWithPath(teams: Team[]): FlatNode[] {
  const result: FlatNode[] = [];

  function buildTreeMap(list: Team[]): Map<string, Team[]> {
    const map = new Map<string, Team[]>();

    const flat = (() => {
      const out: Team[] = [];
      function walk(nodes: Team[]) {
        for (const n of nodes) {
          out.push(n);
          if (n.children) walk(n.children);
        }
      }
      const hasTree = list.some(t => t.children && t.children.length > 0);
      if (hasTree) walk(list);
      else out.push(...list);
      return out;
    })();

    const hasTreeStructure = list.some(t => t.children && t.children.length > 0);
    if (hasTreeStructure) {
      function walkPath(nodes: Team[], parentPath: string[], depth: number) {
        for (const node of nodes) {
          const path = [...parentPath, node.name].join(' > ');
          result.push({ team: node, path, depth });
          if (node.children) walkPath(node.children, [...parentPath, node.name], depth + 1);
        }
      }
      walkPath(list, [], 0);
      return map;
    }

    const idMap = new Map<string, Team & { children: Team[] }>();
    for (const t of flat) idMap.set(t.id, { ...t, children: [] });
    const roots: (Team & { children: Team[] })[] = [];
    for (const t of flat) {
      const node = idMap.get(t.id)!;
      if (t.parentId && idMap.has(t.parentId)) {
        idMap.get(t.parentId)!.children.push(node as any);
      } else {
        roots.push(node);
      }
    }

    function walkPath(nodes: Team[], parentPath: string[], depth: number) {
      nodes.sort((a, b) => a.name.localeCompare(b.name));
      for (const node of nodes) {
        const path = [...parentPath, node.name].join(' > ');
        result.push({ team: node, path, depth });
        const children = (node as any).children as Team[] | undefined;
        if (children && children.length > 0) walkPath(children, [...parentPath, node.name], depth + 1);
      }
    }

    walkPath(roots as unknown as Team[], [], 0);
    return map;
  }

  buildTreeMap(teams);
  return result;
}

function getDescendantIds(teamId: string, all: FlatNode[]): Set<string> {
  const set = new Set<string>();
  const map = new Map<string, string | null>();
  for (const n of all) map.set(n.team.id, n.team.parentId || null);

  function isDescendant(id: string): boolean {
    let cur = map.get(id);
    while (cur) {
      if (cur === teamId) return true;
      cur = map.get(cur) || null;
    }
    return false;
  }

  for (const n of all) if (isDescendant(n.team.id) || n.team.id === teamId) set.add(n.team.id);
  return set;
}

export default function TeamTreeSelect({
  teams,
  value,
  onChange,
  isLoading = false,
  placeholder = 'Choose a team',
  excludeId,
  maxDepth = 10,
  allowRoot = true,
}: TeamTreeSelectProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [dropUp, setDropUp] = useState(false);

  const flatNodes = useMemo(() => flattenWithPath(teams), [teams]);

  const excludedIds = useMemo(() => {
    if (!excludeId) return new Set<string>();
    return getDescendantIds(excludeId, flatNodes);
  }, [excludeId, flatNodes]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let nodes = flatNodes.filter((n) => !excludedIds.has(n.team.id));
    if (!q) return nodes;
    return nodes.filter(
      (n) =>
        n.team.name.toLowerCase().includes(q) ||
        n.path.toLowerCase().includes(q) ||
        n.team.description?.toLowerCase().includes(q)
    );
  }, [flatNodes, search, excludedIds]);

  const selectedNode = useMemo(() => flatNodes.find((n) => n.team.id === value) || null, [flatNodes, value]);

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

  useEffect(() => {
    if (!open || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    setDropUp(spaceBelow < 320);
  }, [open]);

  const choose = (teamId: string | null) => {
    onChange(teamId);
    setOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <button
        type="button"
        id="formTeam"
        onClick={() => setOpen((c) => !c)}
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={isLoading}
        className="flex min-h-10 w-full items-center gap-2.5 rounded-lg border border-input bg-card px-3 text-left transition-colors hover:border-ink-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/[0.06] text-primary">
          <UsersRound className="h-3.5 w-3.5" strokeWidth={1.8} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold text-foreground">
            {isLoading ? 'Loading teams…' : selectedNode ? selectedNode.path : placeholder}
          </span>
        </span>
        <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          className={cn(
            'absolute left-0 z-[90] flex w-full flex-col overflow-hidden rounded-xl border border-border bg-popover shadow-[0_12px_32px_rgba(15,23,42,0.12)]',
            dropUp ? 'bottom-full mb-2 max-h-[min(18rem,45vh)]' : 'top-full mt-2 max-h-[min(20rem,50vh)]'
          )}
        >
          <div className="shrink-0 border-b border-border/70 p-2.5">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                autoFocus
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search teams"
                className="h-8 w-full rounded-lg border border-input bg-background pl-9 pr-8 text-[12px] outline-none placeholder:text-muted-foreground focus:border-ink-400 focus:ring-4 focus:ring-primary/[0.06]"
              />
              {search && (
                <button type="button" onClick={() => setSearch('')} className="absolute right-1.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          <div role="listbox" aria-label="Teams" className="scrollbar-compact min-h-0 flex-1 overflow-y-auto p-1.5">
            {allowRoot && !search && (
              <button
                type="button"
                role="option"
                aria-selected={value === null}
                onClick={() => choose(null)}
                className={cn(
                  'mb-1 flex w-full items-center gap-2 rounded-lg border px-2.5 py-2.5 text-left transition-colors',
                  value === null ? 'border-primary/20 bg-primary/[0.06]' : 'border-dashed border-border hover:bg-muted/50'
                )}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-border bg-card text-ink-500">
                  <Folder className="h-3 w-3" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12px] font-semibold">Top level (no parent)</span>
                  <span className="block text-[11px] text-muted-foreground">Main team</span>
                </span>
                {value === null && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
              </button>
            )}

            {filtered.length > 0 ? (
              <div className="space-y-0.5">
                {filtered.map(({ team, path, depth }) => {
                  const isSelected = team.id === value;
                  const isAtMax = team.depth >= maxDepth;
                  const showDisabledHint = isAtMax && team.id !== value;
                  const cappedDepth = Math.min(depth, 6);

                  return (
                    <button
                      key={team.id}
                      type="button"
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => !showDisabledHint && choose(team.id)}
                      disabled={showDisabledHint}
                      className={cn(
                        'flex w-full min-w-0 items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                        isSelected ? 'bg-primary/[0.065]' : 'hover:bg-muted/60',
                        showDisabledHint && 'opacity-50 cursor-not-allowed'
                      )}
                      style={{ paddingLeft: `${8 + cappedDepth * 12}px` }}
                    >
                      <span className="flex items-center gap-1.5">
                        {depth > 0 && <CornerDownRight className="h-3 w-3 shrink-0 text-muted-foreground/50" />}
                        <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-ink-500', isSelected ? 'border-primary/20 bg-primary/[0.08] text-primary' : 'border-border bg-card')}>
                          {team.isDefault ? <Shield className="h-3 w-3" strokeWidth={1.7} /> : <UsersRound className="h-3 w-3" strokeWidth={1.7} />}
                        </span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12px] font-semibold text-foreground">
                          {team.name}
                          {team.isDefault && <span className="ml-1.5 text-[9px] font-medium text-muted-foreground">· default</span>}
                        </span>
                        {path !== team.name && <span className="block truncate text-[10px] text-muted-foreground">{path}</span>}
                      </span>
                      {isSelected && <Check className="h-3.5 w-3.5 shrink-0 text-primary" />}
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="px-4 py-6 text-center text-[11px] text-muted-foreground">No matching team</div>
            )}
          </div>

          <div className="shrink-0 border-t border-border/60 bg-muted/20 px-3 py-2 text-[10px] text-muted-foreground">
            {flatNodes.length} teams
          </div>
        </div>
      )}
    </div>
  );
}
