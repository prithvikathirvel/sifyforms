import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronRight,
  Search,
  UsersRound,
  X,
  Folder,
  Shield,
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
  hasChildren: boolean;
  parentId: string | null;
}

interface TreeNode {
  team: Team;
  children: TreeNode[];
}

/**
 * Build a deduped tree from flat OR tree list using parentId, then flatten with path.
 * Handles both cases: API returns tree (roots with children) or flat list.
 * Fixes duplicate entries and ensures nested view in create-form picker.
 */
function collectAllTeams(input: Team[]): Team[] {
  const out: Team[] = [];
  const seen = new Set<string>();
  function walk(list: Team[]) {
    for (const t of list) {
      if (!seen.has(t.id)) {
        seen.add(t.id);
        const { children, ...rest } = t as any;
        out.push(rest as Team);
        if (children && Array.isArray(children) && children.length > 0) {
          walk(children as Team[]);
        }
      } else {
        const children = (t as any).children as Team[] | undefined;
        if (children && children.length > 0) walk(children);
      }
    }
  }
  walk(input);
  return out;
}

function buildDedupedTreeAndFlatten(teams: Team[]): { flat: FlatNode[]; tree: TreeNode[] } {
  const allTeams = collectAllTeams(teams);
  const idMap = new Map<string, Team>();
  for (const t of allTeams) {
    const existing = idMap.get(t.id);
    if (!existing) {
      idMap.set(t.id, { ...t });
    } else {
      idMap.set(t.id, { ...existing, ...t });
    }
  }

  // Build parent-child map from parentId
  const nodeMap = new Map<string, TreeNode>();
  for (const [teamId, team] of idMap) {
    nodeMap.set(teamId, { team, children: [] });
  }

  const roots: TreeNode[] = [];
  for (const [, node] of nodeMap) {
    const parentId = node.team.parentId;
    if (parentId && nodeMap.has(parentId)) {
      nodeMap.get(parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort recursively by name
  const sortRecursive = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => a.team.name.localeCompare(b.team.name));
    for (const n of nodes) sortRecursive(n.children);
  };
  sortRecursive(roots);

  // Flatten with path and depth (real depth from tree, not team.depth)
  const flat: FlatNode[] = [];
  function walk(nodes: TreeNode[], parentPath: string[], depth: number) {
    for (const node of nodes) {
      const path = [...parentPath, node.team.name].join(' > ');
      flat.push({
        team: node.team,
        path,
        depth,
        hasChildren: node.children.length > 0,
        parentId: node.team.parentId || null,
      });
      if (node.children.length > 0) walk(node.children, [...parentPath, node.team.name], depth + 1);
    }
  }
  walk(roots, [], 0);

  return { flat, tree: roots };
}

function getDescendantIds(teamId: string, flat: FlatNode[]): Set<string> {
  const set = new Set<string>();
  const parentMap = new Map<string, string | null>();
  for (const n of flat) parentMap.set(n.team.id, n.parentId);

  function isDescendant(id: string): boolean {
    let cur = parentMap.get(id);
    while (cur) {
      if (cur === teamId) return true;
      cur = parentMap.get(cur) || null;
    }
    return false;
  }

  for (const n of flat) if (isDescendant(n.team.id) || n.team.id === teamId) set.add(n.team.id);
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
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const { flat: flatNodes, tree: treeNodes } = useMemo(() => buildDedupedTreeAndFlatten(teams), [teams]);

  // Initialize expanded: expand ancestors of selected value, and show nested by default
  useEffect(() => {
    if (!value) {
      // Expand all by default so nested structure is visible immediately (fixes flat-only bug)
      const allIds = flatNodes.map((n) => n.team.id);
      setExpandedIds(new Set(allIds));
      return;
    }
    // Find path to selected
    const pathIds: string[] = [];
    const parentMap = new Map<string, string | null>();
    for (const n of flatNodes) parentMap.set(n.team.id, n.parentId);
    let cur: string | null = value;
    while (cur) {
      pathIds.push(cur);
      cur = parentMap.get(cur) || null;
    }
    // Expand all ancestors + selected if it has children
    setExpandedIds(new Set(pathIds));
  }, [value, flatNodes, treeNodes]);

  const excludedIds = useMemo(() => {
    if (!excludeId) return new Set<string>();
    return getDescendantIds(excludeId, flatNodes);
  }, [excludeId, flatNodes]);

  // Filtered for search - if searching, show all matching ignoring expansion
  const filteredFlat = useMemo(() => {
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

  // For tree view (non-search): filter visible based on expandedIds
  const visibleTreeNodes = useMemo(() => {
    if (search.trim()) return null; // use flat search mode
    // Build visible flat list respecting expanded state
    const visible: FlatNode[] = [];
    const isExcluded = (id: string) => excludedIds.has(id);

    function walkVisible(nodes: TreeNode[], parentPath: string[], depth: number) {
      for (const node of nodes) {
        if (isExcluded(node.team.id)) continue;
        const path = [...parentPath, node.team.name].join(' > ');
        visible.push({
          team: node.team,
          path,
          depth,
          hasChildren: node.children.length > 0,
          parentId: node.team.parentId || null,
        });
        if (node.children.length > 0 && expandedIds.has(node.team.id)) {
          walkVisible(node.children, [...parentPath, node.team.name], depth + 1);
        }
      }
    }
    walkVisible(treeNodes, [], 0);
    return visible;
  }, [search, treeNodes, expandedIds, excludedIds]);

  const displayNodes = search.trim() ? filteredFlat : visibleTreeNodes || [];

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

  const toggleExpand = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => {
    setExpandedIds(new Set(flatNodes.map((n) => n.team.id)));
  };
  const collapseAll = () => {
    setExpandedIds(new Set());
  };

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
            {!search && flatNodes.length > 3 && (
              <div className="mt-2 flex items-center gap-1.5">
                <button type="button" onClick={expandAll} className="rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Expand all</button>
                <span className="text-[10px] text-border">·</span>
                <button type="button" onClick={collapseAll} className="rounded-md px-2 py-1 text-[10px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground">Collapse all</button>
              </div>
            )}
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

            {displayNodes.length > 0 ? (
              <div className="space-y-0.5">
                {displayNodes.map(({ team, path, depth, hasChildren }) => {
                  const isSelected = team.id === value;
                  const isExpanded = expandedIds.has(team.id);
                  const isAtMax = (team.depth ?? depth) >= maxDepth;
                  const showDisabledHint = isAtMax && team.id !== value;
                  const cappedDepth = Math.min(depth, 6);

                  return (
                    <div
                      key={team.id}
                      className={cn(
                        'flex w-full min-w-0 items-center gap-0.5 rounded-lg transition-colors',
                        isSelected ? 'bg-primary/[0.065]' : 'hover:bg-muted/60',
                        showDisabledHint && 'opacity-50'
                      )}
                      style={{ paddingLeft: `${4 + cappedDepth * 14}px` }}
                    >
                      {hasChildren && !search ? (
                        <button
                          type="button"
                          onClick={(e) => toggleExpand(team.id, e)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                        >
                          {isExpanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
                        </button>
                      ) : (
                        <span className="h-7 w-7 shrink-0" />
                      )}

                      <button
                        type="button"
                        role="option"
                        aria-selected={isSelected}
                        onClick={() => !showDisabledHint && choose(team.id)}
                        disabled={showDisabledHint}
                        className="flex min-w-0 flex-1 items-center gap-2 rounded-lg py-2 pr-2 text-left"
                      >
                        <span className={cn('flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-ink-500', isSelected ? 'border-primary/20 bg-primary/[0.08] text-primary' : 'border-border bg-card')}>
                          {team.isDefault ? <Shield className="h-3 w-3" strokeWidth={1.7} /> : <UsersRound className="h-3 w-3" strokeWidth={1.7} />}
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
                    </div>
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
