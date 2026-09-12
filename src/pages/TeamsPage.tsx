import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import {
  fetchTeams,
  fetchTeam,
  createTeam,
  updateTeam,
  moveTeam,
  deleteTeam,
  addTeamMembersBulk,
  removeTeamMember,
  clearTeamsError,
} from '../store/teamsSlice';
import { fetchMembers } from '../store/membersSlice';
import { toast } from '../components/ui/toast';
import { usePermissions, ACTIONS } from '../hooks/usePermissions';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import type { Team, TeamMember } from '../types';
import {
  Loader2,
  Plus,
  Trash2,
  Users,
  UserPlus,
  Network,
  UserRound,
  ChevronRight,
  ChevronDown,
  Search,
  Layers,
  Move,
  Edit3,
  Shield,
  FileText,
  X,
  Check,
  MoreHorizontal,
  AlertTriangle,
  Info,
  Clock,
  Calendar,
} from 'lucide-react';
import TeamTreeSelect from '../components/forms/TeamTreeSelect';
import api from '../lib/api';

interface TreeNodeProps {
  team: Team;
  level: number;
  selectedId: string | null;
  expandedIds: Set<string>;
  onSelect: (id: string) => void;
  onToggle: (id: string) => void;
  onCreateSub: (parent: Team) => void;
  onMove: (team: Team) => void;
  onRequestDelete: (team: Team) => void;
  canCreate: boolean;
  canDelete: boolean;
  canEdit: boolean;
}

function TreeNode({
  team,
  level,
  selectedId,
  expandedIds,
  onSelect,
  onToggle,
  onCreateSub,
  onMove,
  onRequestDelete,
  canCreate,
  canDelete,
  canEdit,
}: TreeNodeProps) {
  const isSelected = selectedId === team.id;
  const isExpanded = expandedIds.has(team.id);
  const hasChildren = team.children && team.children.length > 0;
  // Cap indent at 4 levels to keep UI clean at depth 10. Deeper levels share same indent but show subtle depth line.
  const cappedLevel = Math.min(level, 4);
  const isDeep = level > 4;

  return (
    <div className="select-none">
      <div
        className={`group flex items-center gap-1 rounded-lg border pr-1 transition-all ${
          isSelected
            ? 'border-primary/20 bg-primary/[0.06] shadow-[0_0_0_1px_rgba(var(--primary),0.08)]'
            : 'border-transparent hover:border-border/60 hover:bg-muted/40'
        }`}
        style={{ marginLeft: cappedLevel > 0 ? `${cappedLevel * 12}px` : undefined }}
      >
        <button
          type="button"
          onClick={() => hasChildren && onToggle(team.id)}
          className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors ${
            hasChildren ? 'hover:bg-muted text-muted-foreground hover:text-foreground' : 'invisible'
          }`}
        >
          {hasChildren ? (
            isExpanded ? <ChevronDown className="h-3.5 w-3.5" strokeWidth={2} /> : <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
          ) : (
            <span className="h-3.5 w-3.5" />
          )}
        </button>

        <button type="button" onClick={() => onSelect(team.id)} className="flex min-w-0 flex-1 items-center gap-2.5 py-2 text-left">
          <span
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md border transition-colors ${
              isSelected
                ? 'border-primary/20 bg-primary/[0.09] text-primary'
                : team.isDefault
                ? 'border-amber-200 bg-amber-50 text-amber-600'
                : hasChildren
                ? 'border-border bg-muted/50 text-ink-600'
                : 'border-border bg-card text-ink-500 group-hover:border-ink-200'
            }`}
          >
            {team.isDefault ? <Shield className="h-3.5 w-3.5" strokeWidth={1.8} /> : hasChildren ? <Users className="h-3.5 w-3.5" strokeWidth={1.8} /> : <UserRound className="h-3.5 w-3.5" strokeWidth={1.8} />}
          </span>

          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-1.5">
              <span className={`truncate text-[13px] font-semibold leading-none ${isSelected ? 'text-foreground' : 'text-foreground/90'}`}>{team.name}</span>
              {team.isDefault && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">Default</span>}
              {isDeep && <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600">L{team.depth}</span>}
            </span>
            <span className="mt-1 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
              <span className="flex items-center gap-1"><Users className="h-3 w-3" />{team._count?.members ?? 0}</span>
              <span className="flex items-center gap-1"><FileText className="h-3 w-3" />{team._count?.forms ?? 0}</span>
              {isDeep && level > 5 && <span className="text-[10px] text-slate-400">· deep nested</span>}
            </span>
          </span>
        </button>

        <div className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
          {canCreate && !team.isDefault && team.depth < 10 && (
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground hover:bg-primary/[0.06] hover:text-primary" title={`Add sub-team under ${team.name}`} onClick={(e) => { e.stopPropagation(); onCreateSub(team); }}>
              <Plus className="h-3.5 w-3.5" />
            </Button>
          )}
          {canEdit && !team.isDefault && (
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground hover:bg-muted" title={`Move ${team.name}`} onClick={(e) => { e.stopPropagation(); onMove(team); }}>
              <Move className="h-3.5 w-3.5" />
            </Button>
          )}
          {canDelete && !team.isDefault && (
            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md text-muted-foreground hover:bg-destructive/[0.08] hover:text-destructive" title={`Delete ${team.name}`} onClick={(e) => { e.stopPropagation(); onRequestDelete(team); }}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {hasChildren && isExpanded && (
        <div className="mt-1 space-y-1 border-l border-dashed border-border/60 ml-3.5 pl-1">
          {team.children!.map((child) => (
            <TreeNode key={child.id} team={child} level={level + 1} selectedId={selectedId} expandedIds={expandedIds} onSelect={onSelect} onToggle={onToggle} onCreateSub={onCreateSub} onMove={onMove} onRequestDelete={onRequestDelete} canCreate={canCreate} canDelete={canDelete} canEdit={canEdit} />
          ))}
        </div>
      )}
    </div>
  );
}

function flattenTeams(teams: Team[]): Team[] {
  const out: Team[] = [];
  function walk(list: Team[]) {
    for (const t of list) {
      out.push(t);
      if (t.children) walk(t.children);
    }
  }
  walk(teams);
  return out;
}

function buildPathMap(teams: Team[]): Map<string, string> {
  const map = new Map<string, string>();
  function walk(list: Team[], parentPath: string[] = []) {
    for (const t of list) {
      const path = [...parentPath, t.name].join(' > ');
      map.set(t.id, path);
      if (t.children) walk(t.children, [...parentPath, t.name]);
    }
  }
  walk(teams);
  return map;
}

function BreadcrumbCollapsed({ breadcrumb, onSelect, selectedId }: { breadcrumb: { id: string; name: string }[]; onSelect: (id: string) => void; selectedId: string }) {
  const [showMiddle, setShowMiddle] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showMiddle) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setShowMiddle(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showMiddle]);

  if (breadcrumb.length <= 4) {
    return (
      <div className="mb-1.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
        {breadcrumb.map((b, idx) => (
          <span key={b.id} className="flex items-center gap-1">
            {idx > 0 && <ChevronRight className="h-3 w-3" />}
            <button onClick={() => onSelect(b.id)} className={`rounded px-1 py-0.5 hover:bg-muted ${b.id === selectedId ? 'font-semibold text-foreground' : ''}`}>{b.name}</button>
          </span>
        ))}
      </div>
    );
  }

  const first = breadcrumb[0];
  const middle = breadcrumb.slice(1, -2);
  const lastTwo = breadcrumb.slice(-2);

  return (
    <div className="mb-1.5 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground" ref={containerRef}>
      <button onClick={() => onSelect(first.id)} className="rounded px-1 py-0.5 hover:bg-muted">{first.name}</button>
      <ChevronRight className="h-3 w-3" />
      <div className="relative">
        <button onClick={() => setShowMiddle((v) => !v)} className="flex h-5 items-center gap-1 rounded-full border border-border bg-muted/40 px-2 text-[10px] font-medium hover:bg-muted">
          <MoreHorizontal className="h-3 w-3" /> {middle.length} more
        </button>
        {showMiddle && (
          <div className="absolute left-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border bg-popover p-1 shadow-lg">
            {middle.map((b) => (
              <button key={b.id} onClick={() => { onSelect(b.id); setShowMiddle(false); }} className="flex w-full items-center rounded-md px-2.5 py-1.5 text-left text-[12px] hover:bg-muted">
                {b.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <ChevronRight className="h-3 w-3" />
      {lastTwo.map((b) => (
        <span key={b.id} className="flex items-center gap-1">
          <button onClick={() => onSelect(b.id)} className={`rounded px-1 py-0.5 hover:bg-muted ${b.id === selectedId ? 'font-semibold text-foreground' : ''}`}>{b.name}</button>
          {b.id !== selectedId && <ChevronRight className="h-3 w-3 last:hidden" />}
        </span>
      ))}
    </div>
  );
}

export default function TeamsPage() {
  const dispatch = useAppDispatch();
  const currentOrg = useAppSelector((state) => state.org.currentOrg);
  const { teams, currentTeam, isLoading, error } = useAppSelector((state) => state.teams);
  const members = useAppSelector((state) => state.members.members);
  const { user } = useAppSelector((state) => state.auth);
  const { can } = usePermissions();
  const [searchParams, setSearchParams] = useSearchParams();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<'subteams' | 'members' | 'info'>('subteams');
  const [effectiveIds, setEffectiveIds] = useState<Set<string> | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createParent, setCreateParent] = useState<Team | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTeamData, setMoveTeamData] = useState<Team | null>(null);
  const [moveParentId, setMoveParentId] = useState<string | null>(null);

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberIds, setSelectedMemberIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTeamData, setDeleteTeamData] = useState<Team | null>(null);
  const [deleteMode, setDeleteMode] = useState<'reparent' | 'cascade'>('reparent');

  const orgId = currentOrg?.id;

  useEffect(() => {
    if (!orgId) return;
    dispatch(fetchTeams(orgId));
    dispatch(fetchMembers(orgId));
  }, [dispatch, orgId]);

  // Fetch effective teams for current user to enforce top-down visibility (Option B)
  // Owner sees all, members see only effective (direct + descendants)
  useEffect(() => {
    if (!orgId || !user?.id) return;
    if (currentOrg?.ownerId === user.id) {
      setEffectiveIds(null); // owner sees all
      return;
    }
    let active = true;
    api.get(`/orgs/${orgId}/me/teams/effective`).then((res) => {
      if (!active) return;
      const tree = res.data as any[];
      const ids = new Set<string>();
      function collect(nodes: any[]) {
        for (const n of nodes) {
          if (n.isEffectiveMember) ids.add(n.id);
          if (n.children) collect(n.children);
        }
      }
      collect(tree);
      // If user has no effective teams but is org member, they can still see structure? For strict top-down, show only effective.
      // If empty, we keep null to show all for now, but ideally show empty. We'll set empty set.
      setEffectiveIds(ids);
    }).catch(() => {
      if (active) setEffectiveIds(null);
    });
    return () => { active = false; };
  }, [orgId, user?.id, currentOrg?.ownerId]);

  // Handle deep link ?teamId=xxx from dashboard Activity by team
  useEffect(() => {
    const teamIdFromUrl = searchParams.get('teamId') || searchParams.get('selected');
    if (teamIdFromUrl) {
      setSelectedId(teamIdFromUrl);
    }
  }, [searchParams]);

  useEffect(() => {
    if (orgId && selectedId) dispatch(fetchTeam({ orgId, teamId: selectedId }));
  }, [dispatch, orgId, selectedId]);

  useEffect(() => {
    if (!selectedId || !currentTeam?.ancestors) return;
    setExpandedIds((prev) => {
      const next = new Set(prev);
      currentTeam.ancestors?.forEach((a) => next.add(a.id));
      if (selectedId) next.add(selectedId);
      return next;
    });
  }, [selectedId, currentTeam?.ancestors]);

  const flatTeams = useMemo(() => flattenTeams(teams), [teams]);
  const pathMap = useMemo(() => buildPathMap(teams), [teams]);

  // Effective filtering: if effectiveIds is set (non-owner), filter tree to only effective branches
  const visibleTeams = useMemo(() => {
    if (!effectiveIds || effectiveIds.size === 0) {
      // Owner or no effective restriction, or user has no teams yet - show all for owners, empty for members with no access
      if (effectiveIds && effectiveIds.size === 0 && currentOrg?.ownerId !== user?.id) {
        // Member with no effective teams - show empty tree (or show none)
        return [];
      }
      return teams;
    }
    function filterEffective(nodes: Team[]): Team[] {
      return nodes
        .map((node) => {
          const children = node.children ? filterEffective(node.children) : [];
          const isEffective = effectiveIds!.has(node.id);
          // Keep node if itself effective or has effective children (to preserve hierarchy for context)
          // But per strict Option B, we should NOT show parent if only child is effective.
          // So we keep only if itself effective. For breadcrumb context, we allow children to be shown as roots.
          if (isEffective) {
            return { ...node, children };
          }
          // If children have effective, we lift them up (don't show non-effective parent)
          if (children.length > 0) {
            return children as any; // will be flattened later, but handle differently
          }
          return null;
        })
        .flat()
        .filter(Boolean) as Team[];
    }
    // More precise: we want to show only effective nodes as roots, not their non-effective parents
    // So we flatten effective nodes from whole tree
    const effectiveRoots: Team[] = [];
    function collectEffective(nodes: Team[]) {
      for (const n of nodes) {
        if (effectiveIds!.has(n.id)) {
          // For this effective node, we need its children filtered to only effective descendants
          const filteredChildren = n.children ? filterEffective(n.children) : [];
          effectiveRoots.push({ ...n, children: filteredChildren });
        } else if (n.children) {
          collectEffective(n.children);
        }
      }
    }
    collectEffective(teams);
    return effectiveRoots;
  }, [teams, effectiveIds, currentOrg?.ownerId, user?.id]);

  const filteredTeams = useMemo(() => {
    const source = visibleTeams;
    if (!search.trim()) return source;
    const q = search.toLowerCase();
    function filterNodes(nodes: Team[]): Team[] {
      return nodes
        .map((node) => {
          const children = node.children ? filterNodes(node.children) : [];
          const match = node.name.toLowerCase().includes(q) || node.description?.toLowerCase().includes(q);
          if (match || children.length > 0) return { ...node, children };
          return null;
        })
        .filter(Boolean) as Team[];
    }
    return filterNodes(source);
  }, [visibleTeams, search]);

  const totalTeams = flatTeams.length;

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const expandAll = () => setExpandedIds(new Set(flatTeams.map((t) => t.id)));
  const collapseAll = () => setExpandedIds(new Set());

  const openCreate = (parent: Team | null = null) => {
    setCreateParent(parent);
    setParentId(parent?.id || null);
    setName('');
    setDescription('');
    setCreateOpen(true);
  };

  const onCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId) return;
    setSubmitting(true);
    const result = await dispatch(createTeam({ orgId, name: name.trim(), description: description.trim() || undefined, parentId: parentId || undefined }));
    setSubmitting(false);
    if (createTeam.fulfilled.match(result)) {
      setCreateOpen(false);
      if (parentId) setExpandedIds((prev) => new Set(prev).add(parentId));
      toast.success({ title: 'Team created', description: `${name.trim()} is ready.` });
    } else {
      toast.error({ title: 'Could not create team', description: result.payload as string });
    }
  };

  const openEdit = () => {
    if (!currentTeam) return;
    setEditName(currentTeam.name);
    setEditDesc(currentTeam.description || '');
    setEditOpen(true);
  };

  const onEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !currentTeam) return;
    setSubmitting(true);
    const result = await dispatch(updateTeam({ orgId, teamId: currentTeam.id, name: editName.trim(), description: editDesc.trim() || null }));
    setSubmitting(false);
    if (updateTeam.fulfilled.match(result)) {
      setEditOpen(false);
      toast.success({ title: 'Team updated' });
    } else {
      toast.error({ title: 'Could not update team', description: result.payload as string });
    }
  };

  const openMove = (team: Team) => {
    setMoveTeamData(team);
    setMoveParentId(team.parentId || null);
    setMoveOpen(true);
  };

  const onMove = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !moveTeamData) return;
    setSubmitting(true);
    const result = await dispatch(moveTeam({ orgId, teamId: moveTeamData.id, parentId: moveParentId }));
    setSubmitting(false);
    if (moveTeam.fulfilled.match(result)) {
      setMoveOpen(false);
      toast.success({ title: 'Team moved', description: `${moveTeamData.name} moved successfully` });
    } else {
      toast.error({ title: 'Could not move team', description: result.payload as string });
    }
  };

  const openDeleteDialog = (team: Team) => {
    setDeleteTeamData(team);
    // Default to reparent if has children, else reparent anyway (cascade only matters if children)
    setDeleteMode('reparent');
    setDeleteOpen(true);
  };

  const onDeleteConfirm = async () => {
    if (!orgId || !deleteTeamData) return;
    setSubmitting(true);
    const result = await dispatch(deleteTeam({ orgId, teamId: deleteTeamData.id, mode: deleteMode }));
    setSubmitting(false);
    if (deleteTeam.fulfilled.match(result)) {
      toast.success({ title: 'Team deleted', description: `${deleteTeamData.name} was removed.` });
      if (selectedId === deleteTeamData.id) setSelectedId(null);
      setDeleteOpen(false);
      setDeleteTeamData(null);
    } else {
      toast.error({ title: 'Could not delete team', description: result.payload as string });
    }
  };

  const onAddMembers = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!orgId || !selectedId || selectedMemberIds.size === 0) return;
    setSubmitting(true);
    const result = await dispatch(addTeamMembersBulk({ orgId, teamId: selectedId, userIds: Array.from(selectedMemberIds) }));
    setSubmitting(false);
    if (addTeamMembersBulk.fulfilled.match(result)) {
      setSelectedMemberIds(new Set());
      setMemberSearch('');
      setAddMemberOpen(false);
      toast.success({ title: `${selectedMemberIds.size} member(s) added`, description: 'They can now see this team and its sub-teams.' });
    } else {
      toast.error({ title: 'Could not add members', description: result.payload as string });
    }
  };

  // Assignable members: exclude already members, exclude org owner (owner already has access to all)
  const assignable = useMemo(() => {
    if (!currentTeam) return [];
    const already = new Set(currentTeam.members.map((m) => m.userId));
    return members.filter((m) => {
      if (already.has(m.id)) return false;
      // Owner has implicit access to all teams - don't show as addable, but explain separately
      if (currentOrg?.ownerId === m.id) return false;
      return true;
    });
  }, [members, currentTeam, currentOrg?.ownerId]);

  const filteredAssignable = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return assignable;
    return assignable.filter((m) => {
      const label = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email;
      return label.toLowerCase().includes(q) || m.email.toLowerCase().includes(q);
    });
  }, [assignable, memberSearch]);

  const toggleMemberSelect = (id: string) => {
    setSelectedMemberIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllFiltered = () => {
    setSelectedMemberIds(new Set(filteredAssignable.map((m) => m.id)));
  };

  const clearSelection = () => setSelectedMemberIds(new Set());

  // For deep nesting info
  const breadcrumb = useMemo(() => {
    const raw = currentTeam?.breadcrumb || [];
    if (!effectiveIds || effectiveIds.size === 0) return raw;
    // Filter to only effective ancestors + current (strict top-down)
    return raw.filter((b: any) => effectiveIds.has(b.id));
  }, [currentTeam?.breadcrumb, effectiveIds]);

  return (
    <div className="app-shell flex h-screen bg-workspace">
      <Sidebar />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
        <PageHeader
          title="Teams"
          description={currentOrg ? `${totalTeams} teams in ${currentOrg.name}` : 'Manage teams'}
          actions={
            can(ACTIONS.CREATE_TEAM) ? (
              <Button onClick={() => openCreate(null)} className="h-9 rounded-lg px-3.5 shadow-sm">
                <Plus className="mr-2 h-4 w-4" strokeWidth={2} />
                New team
              </Button>
            ) : undefined
          }
        />

        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-5 lg:p-6">
          {error && (
            <div className="flex shrink-0 items-center justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.05] px-4 py-3 text-xs font-medium text-destructive" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => dispatch(clearTeamsError())} className="font-semibold hover:underline">Dismiss</button>
            </div>
          )}

          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[380px_minmax(0,1fr)] xl:grid-cols-[420px_minmax(0,1fr)]">
            {/* Tree */}
            <Card className="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border-border/80 bg-card shadow-sm lg:min-h-0">
              <CardHeader className="shrink-0 space-y-3 border-b border-border/70 px-4 py-3.5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/50 text-ink-600">
                      <Network className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <div>
                      <CardTitle className="font-display text-[13px] font-bold tracking-tight">Teams</CardTitle>
                      <CardDescription className="mt-0.5 text-[11px]">Groups and sub-groups for your forms</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={expandAll}>Expand</Button>
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={collapseAll}>Collapse</Button>
                  </div>
                </div>

                <div className="relative">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input placeholder="Search teams..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 rounded-lg bg-muted/30 pl-8 pr-8 text-[12px]" />
                  {search && (
                    <button type="button" onClick={() => setSearch('')} className="absolute right-1 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </CardHeader>

              <CardContent className="min-h-0 flex-1 overflow-y-auto p-2">
                {isLoading && teams.length === 0 ? (
                  <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : filteredTeams.length === 0 ? (
                  <div className="px-4 py-12 text-center">
                    <Layers className="mx-auto h-6 w-6 text-ink-300" />
                    <p className="mt-2 text-xs font-medium text-muted-foreground">
                      {search ? `No teams matching "${search}"` : effectiveIds && effectiveIds.size === 0 ? 'No teams assigned to you yet.' : 'No teams yet.'}
                    </p>
                    {effectiveIds && effectiveIds.size === 0 && (
                      <p className="mt-1 text-[11px] text-muted-foreground">Ask your owner to add you to a team.</p>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {filteredTeams.map((team) => (
                      <TreeNode key={team.id} team={team} level={0} selectedId={selectedId} expandedIds={search ? new Set(flatTeams.map((t) => t.id)) : expandedIds} onSelect={(id) => { setSelectedId(id); setSearchParams((prev) => { prev.set('teamId', id); return prev; }, { replace: true }); }} onToggle={toggleExpand} onCreateSub={openCreate} onMove={openMove} onRequestDelete={openDeleteDialog} canCreate={can(ACTIONS.CREATE_TEAM)} canDelete={can(ACTIONS.DELETE_TEAM)} canEdit={can(ACTIONS.EDIT_TEAM)} />
                    ))}
                  </div>
                )}
              </CardContent>

              <div className="shrink-0 border-t border-border/60 bg-muted/20 px-3 py-2.5 text-[11px] font-medium text-muted-foreground">{totalTeams} teams total</div>
            </Card>

            {/* Detail */}
            <Card className="flex min-h-[28rem] flex-col overflow-hidden rounded-xl border-border/80 bg-card shadow-sm lg:min-h-0">
              {!currentTeam ? (
                <div className="flex h-full items-center justify-center py-12 text-center">
                  <p className="text-xs font-medium text-muted-foreground">Select a team to see details.</p>
                </div>
              ) : (
                <>
                  <CardHeader className="shrink-0 border-b border-border/70 px-4 py-3.5 sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        {breadcrumb.length > 1 && (
                          <BreadcrumbCollapsed breadcrumb={breadcrumb} onSelect={setSelectedId} selectedId={currentTeam.id} />
                        )}
                        <CardTitle className="font-display text-base font-bold truncate">{currentTeam.name}</CardTitle>
                        <CardDescription className="mt-0.5 text-[11px] line-clamp-2">{currentTeam.description || `${currentTeam.members.length} members · ${currentTeam._count?.forms ?? 0} forms`}</CardDescription>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {can(ACTIONS.EDIT_TEAM) && !currentTeam.isDefault && (
                          <>
                            <Button variant="outline" size="sm" className="h-8 rounded-md px-2.5 text-[11px]" onClick={openEdit}><Edit3 className="mr-1 h-3 w-3" />Edit</Button>
                            <Button variant="outline" size="sm" className="h-8 rounded-md px-2.5 text-[11px]" onClick={() => openMove(currentTeam)}><Move className="mr-1 h-3 w-3" />Move</Button>
                          </>
                        )}
                        {can(ACTIONS.CREATE_TEAM) && !currentTeam.isDefault && currentTeam.depth < 10 && (
                          <Button size="sm" className="h-8 rounded-md px-2.5 text-[11px]" onClick={() => openCreate(currentTeam)}><Plus className="mr-1 h-3 w-3" />Sub-team</Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>

                  {/* Tabs - clean minimal */}
                  <div className="shrink-0 border-b border-border/70 bg-card px-4">
                    <div className="flex gap-6">
                      <button
                        onClick={() => setActiveTab('subteams')}
                        className={`relative flex items-center gap-1.5 border-b-2 px-1 py-2.5 text-[11px] font-semibold transition-colors ${activeTab === 'subteams' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                      >
                        <Users className="h-3.5 w-3.5" />
                        Sub-teams
                        {currentTeam.children && currentTeam.children.length > 0 && (
                          <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === 'subteams' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{currentTeam.children.length}</span>
                        )}
                      </button>
                      <button
                        onClick={() => setActiveTab('members')}
                        className={`relative flex items-center gap-1.5 border-b-2 px-1 py-2.5 text-[11px] font-semibold transition-colors ${activeTab === 'members' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                      >
                        <UserRound className="h-3.5 w-3.5" />
                        Members
                        <span className={`ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${activeTab === 'members' ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{currentTeam.members.length}</span>
                      </button>
                      <button
                        onClick={() => setActiveTab('info')}
                        className={`relative flex items-center gap-1.5 border-b-2 px-1 py-2.5 text-[11px] font-semibold transition-colors ${activeTab === 'info' ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
                      >
                        <Info className="h-3.5 w-3.5" />
                        Info
                      </button>
                    </div>
                  </div>

                  <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                    {activeTab === 'subteams' ? (
                      <div>
                        {currentTeam.children && currentTeam.children.length > 0 ? (
                          <div className="grid gap-2.5 sm:grid-cols-2">
                            {currentTeam.children.map((child) => (
                              <button key={child.id} onClick={() => setSelectedId(child.id)} className="flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3.5 py-3 text-left transition-colors hover:border-border hover:bg-muted/30">
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-muted/40 text-ink-600"><Users className="h-4 w-4" strokeWidth={1.7} /></span>
                                <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-semibold">{child.name}</span><span className="mt-0.5 block text-[11px] text-muted-foreground">{child._count?.members ?? 0} members · {child._count?.forms ?? 0} forms</span></span>
                                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                              </button>
                            ))}
                          </div>
                        ) : (
                          <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-12 text-center">
                            <Users className="mx-auto h-6 w-6 text-ink-300" />
                            <p className="mt-2 text-[13px] font-medium text-foreground">No sub-teams yet</p>
                            <p className="mx-auto mt-1 max-w-[280px] text-[11px] leading-5 text-muted-foreground">Create a sub-team to organize work under {currentTeam.name}.</p>
                            {can(ACTIONS.CREATE_TEAM) && !currentTeam.isDefault && currentTeam.depth < 10 && (
                              <Button size="sm" className="mt-4 h-8 rounded-lg px-3 text-[11px]" onClick={() => openCreate(currentTeam)}><Plus className="mr-1 h-3 w-3" />Add sub-team</Button>
                            )}
                          </div>
                        )}
                      </div>
                    ) : activeTab === 'members' ? (
                      <div>
                        <div className="mb-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Members</h3>
                            {currentOrg?.ownerId && <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600">Owner has access to all teams</span>}
                          </div>
                          {can(ACTIONS.ADD_TEAM_MEMBER) && (
                            <Button size="sm" variant="outline" className="h-7 px-2.5 text-[11px]" onClick={() => { setSelectedMemberIds(new Set()); setMemberSearch(''); setAddMemberOpen(true); }}><UserPlus className="mr-1 h-3 w-3" />Add members</Button>
                          )}
                        </div>

                        {currentTeam.members.length === 0 ? (
                          <div className="rounded-xl border border-dashed bg-muted/20 px-6 py-10 text-center">
                            <UserRound className="mx-auto h-6 w-6 text-ink-300" />
                            <p className="mt-2 text-[13px] font-medium text-foreground">No members yet</p>
                            <p className="mt-1 text-[11px] text-muted-foreground">Add people to this team, or they will see it via parent teams.</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {currentTeam.members.map((member: TeamMember) => {
                              const label = [member.user.firstName, member.user.lastName].filter(Boolean).join(' ') || member.user.email;
                              const initial = label.charAt(0).toUpperCase();
                              const isOwner = currentOrg?.ownerId === member.userId;
                              return (
                                <div key={member.id} className="flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3 shadow-sm">
                                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-xs font-bold">{initial}</span>
                                  <div className="min-w-0 flex-1">
                                    <p className="flex items-center gap-1.5 truncate text-[13px] font-semibold">{label}{isOwner && <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold text-amber-700">Owner</span>}</p>
                                    <p className="truncate text-[11px] text-muted-foreground">{member.user.email}</p>
                                  </div>
                                  {can(ACTIONS.REMOVE_TEAM_MEMBER) && (
                                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/[0.06] hover:text-destructive" onClick={async () => {
                                      if (!orgId) return;
                                      if (!window.confirm(`Remove ${label} from ${currentTeam.name}?`)) return;
                                      const result = await dispatch(removeTeamMember({ orgId, teamId: currentTeam.id, userId: member.userId }));
                                      if (removeTeamMember.fulfilled.match(result)) toast.success({ title: 'Member removed' });
                                    }}><Trash2 className="h-4 w-4" /></Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-border/70 bg-card">
                          <div className="border-b border-border/60 px-4 py-3">
                            <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"><Info className="h-3.5 w-3.5" />Team details</h3>
                          </div>
                          <div className="divide-y divide-border/60">
                            <div className="flex items-start gap-3 px-4 py-3.5">
                              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-bold">C</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-medium text-muted-foreground">Created</p>
                                <p className="mt-1 text-[12px] font-semibold text-foreground">
                                  {currentTeam.createdByUser ? ([currentTeam.createdByUser.firstName, currentTeam.createdByUser.lastName].filter(Boolean).join(' ') || currentTeam.createdByUser.email) : 'Unknown'}
                                </p>
                                {currentTeam.createdByUser && (
                                  <p className="text-[11px] text-muted-foreground">{currentTeam.createdByUser.email}</p>
                                )}
                                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                  <Calendar className="h-3 w-3" />
                                  {new Date(currentTeam.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                  <span className="mx-1">·</span>
                                  <Clock className="h-3 w-3" />
                                  {new Date(currentTeam.createdAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-start gap-3 px-4 py-3.5">
                              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-[11px] font-bold text-primary">U</span>
                              <div className="min-w-0 flex-1">
                                <p className="text-[11px] font-medium text-muted-foreground">Last updated</p>
                                {currentTeam.updatedByUser || (currentTeam as any).updatedBy ? (
                                  <>
                                    <p className="mt-1 text-[12px] font-semibold text-foreground">
                                      {currentTeam.updatedByUser ? ([currentTeam.updatedByUser.firstName, currentTeam.updatedByUser.lastName].filter(Boolean).join(' ') || currentTeam.updatedByUser.email) : (currentTeam as any).updatedBy}
                                    </p>
                                    {currentTeam.updatedByUser && (
                                      <p className="text-[11px] text-muted-foreground">{currentTeam.updatedByUser.email}</p>
                                    )}
                                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                      <Calendar className="h-3 w-3" />
                                      {new Date(currentTeam.updatedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                                      <span className="mx-1">·</span>
                                      <Clock className="h-3 w-3" />
                                      {new Date(currentTeam.updatedAt).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
                                    </p>
                                  </>
                                ) : (
                                  <>
                                    <p className="mt-1 text-[12px] text-muted-foreground">No changes yet</p>
                                    <p className="mt-1 text-[11px] text-muted-foreground">This team hasn't been updated since creation.</p>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="rounded-xl border border-border/60 bg-muted/20 px-4 py-3">
                          <div className="flex items-start gap-2.5">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border bg-card text-ink-500"><Users className="h-3.5 w-3.5" /></span>
                            <div className="min-w-0 flex-1">
                              <p className="text-[11px] font-semibold text-foreground">About this team</p>
                              <div className="mt-1.5 space-y-1 text-[11px] leading-5 text-muted-foreground">
                                <p><span className="font-medium text-foreground">{currentTeam.name}</span> {currentTeam.description ? `— ${currentTeam.description}` : ''}</p>
                                <p>{currentTeam._count?.members ?? currentTeam.members.length} members · {currentTeam._count?.forms ?? 0} forms · Level {currentTeam.depth}</p>
                                {currentTeam.path && <p className="truncate">Path: {currentTeam.path}</p>}
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </>
              )}
            </Card>
          </div>

          {/* Create */}
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogContent onClose={() => setCreateOpen(false)} className="sm:max-w-[480px]">
              <DialogHeader className="mb-2">
                <DialogTitle>{createParent ? `Add sub-team to ${createParent.name}` : 'Create a team'}</DialogTitle>
                <DialogDescription className="text-[12px]">Teams help organize your forms. You can create sub-teams inside other teams.</DialogDescription>
              </DialogHeader>
              <form onSubmit={onCreate} className="space-y-4">
                <div className="space-y-2"><Label className="text-[12px]">Team name</Label><Input required placeholder="e.g. Marketing" value={name} onChange={(e) => setName(e.target.value)} className="h-10 rounded-lg" /></div>
                <div className="space-y-2">
                  <Label className="text-[12px]">Parent team</Label>
                  <TeamTreeSelect teams={flatTeams} value={parentId} onChange={setParentId} isLoading={isLoading} placeholder="No parent (top level)" maxDepth={10} />
                  <p className="text-[11px] text-muted-foreground">{parentId ? `Will be inside "${pathMap.get(parentId) || parentId}"` : 'Will be a top level team'}</p>
                </div>
                <div className="space-y-2"><Label className="text-[12px]">Description (optional)</Label><Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this team for?" /></div>
                <div className="flex justify-end gap-2 pt-2"><Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="h-9 rounded-lg">Cancel</Button><Button type="submit" disabled={submitting || !name.trim()} className="h-9 rounded-lg px-5">{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Create team</Button></div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Edit */}
          <Dialog open={editOpen} onOpenChange={setEditOpen}>
            <DialogContent onClose={() => setEditOpen(false)} className="sm:max-w-[440px]">
              <DialogHeader><DialogTitle>Edit team</DialogTitle><DialogDescription className="text-[12px]">Update team details.</DialogDescription></DialogHeader>
              <form onSubmit={onEdit} className="space-y-4">
                <div className="space-y-2"><Label className="text-[12px]">Name</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} required className="h-10 rounded-lg" /></div>
                <div className="space-y-2"><Label className="text-[12px]">Description</Label><Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} /></div>
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="h-9 rounded-lg">Cancel</Button><Button type="submit" disabled={submitting || !editName.trim()} className="h-9 rounded-lg">{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Save</Button></div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Move */}
          <Dialog open={moveOpen} onOpenChange={setMoveOpen}>
            <DialogContent onClose={() => setMoveOpen(false)} className="sm:max-w-[480px] overflow-visible">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><Move className="h-4 w-4" />Move {moveTeamData?.name}</DialogTitle>
                <DialogDescription className="text-[12px]">Choose a new parent. This will also move its sub-teams.</DialogDescription>
              </DialogHeader>
              <form onSubmit={onMove} className="space-y-4">
                <div className="space-y-2">
                  <Label className="text-[12px]">Move to</Label>
                  <TeamTreeSelect teams={flatTeams} value={moveParentId} onChange={setMoveParentId} placeholder="Top level (no parent)" excludeId={moveTeamData?.id} maxDepth={10} />
                  <p className="text-[11px] text-muted-foreground">All sub-teams will move together.</p>
                </div>
                <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setMoveOpen(false)} className="h-9 rounded-lg">Cancel</Button><Button type="submit" disabled={submitting} className="h-9 rounded-lg">{submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}Move team</Button></div>
              </form>
            </DialogContent>
          </Dialog>

          {/* Delete with options */}
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogContent onClose={() => setDeleteOpen(false)} className="sm:max-w-[480px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-amber-600" />Delete "{deleteTeamData?.name}"?</DialogTitle>
                <DialogDescription className="text-[12px]">Choose what should happen to its sub-teams.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {deleteTeamData?.children && deleteTeamData.children.length > 0 ? (
                  <div className="space-y-3">
                    <div className="rounded-lg border bg-amber-50/60 px-3.5 py-3 text-[12px] text-amber-900">
                      This team has <span className="font-bold">{deleteTeamData.children.length} sub-team(s)</span>. What would you like to do?
                    </div>
                    <div className="space-y-2">
                      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${deleteMode === 'reparent' ? 'border-primary/30 bg-primary/[0.04] ring-1 ring-primary/10' : 'border-border hover:bg-muted/30'}`}>
                        <input type="radio" name="deleteMode" checked={deleteMode === 'reparent'} onChange={() => setDeleteMode('reparent')} className="mt-0.5" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold">Keep sub-teams, move them up</span>
                          <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">Sub-teams will move to {deleteTeamData?.parentId ? 'the parent team' : 'top level'}. Forms move to General.</span>
                        </span>
                      </label>
                      <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-colors ${deleteMode === 'cascade' ? 'border-destructive/30 bg-destructive/[0.04] ring-1 ring-destructive/10' : 'border-border hover:bg-muted/30'}`}>
                        <input type="radio" name="deleteMode" checked={deleteMode === 'cascade'} onChange={() => setDeleteMode('cascade')} className="mt-0.5" />
                        <span className="min-w-0 flex-1">
                          <span className="block text-[13px] font-semibold">Delete team and all sub-teams</span>
                          <span className="mt-1 block text-[11px] leading-5 text-muted-foreground">All {deleteTeamData.children.length} sub-team(s) and their sub-teams will be permanently removed. Forms move to General.</span>
                        </span>
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-lg border bg-muted/30 px-3.5 py-3 text-[12px] text-muted-foreground">
                    This will permanently delete "{deleteTeamData?.name}". Forms in this team will move to General.
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setDeleteOpen(false)} className="h-9 rounded-lg">Cancel</Button>
                <Button type="button" variant="destructive" disabled={submitting} onClick={onDeleteConfirm} className="h-9 rounded-lg px-5">
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {deleteMode === 'cascade' ? 'Delete all' : 'Delete team'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* Add members - multi select */}
          <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
            <DialogContent onClose={() => setAddMemberOpen(false)} className="sm:max-w-[520px] max-h-[85vh] flex flex-col">
              <DialogHeader className="shrink-0">
                <DialogTitle>Add members to {currentTeam?.name}</DialogTitle>
                <DialogDescription className="text-[12px]">Select one or more people from your organization. Owner already has access to all teams.</DialogDescription>
              </DialogHeader>

              <form onSubmit={onAddMembers} className="flex min-h-0 flex-1 flex-col gap-4">
                <div className="shrink-0 space-y-3">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input placeholder="Search by name or email..." value={memberSearch} onChange={(e) => setMemberSearch(e.target.value)} className="h-9 rounded-lg pl-9 pr-9 text-[13px]" />
                    {memberSearch && (
                      <button type="button" onClick={() => setMemberSearch('')} className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground hover:bg-muted">
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-muted-foreground">{filteredAssignable.length} available · {selectedMemberIds.size} selected</span>
                      {selectedMemberIds.size > 0 && (
                        <button type="button" onClick={clearSelection} className="text-[11px] font-semibold text-primary hover:underline">Clear</button>
                      )}
                    </div>
                    <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={selectAllFiltered} disabled={filteredAssignable.length === 0}>
                      <Check className="mr-1 h-3 w-3" />Select all
                    </Button>
                  </div>

                  {selectedMemberIds.size > 0 && (
                    <div className="flex flex-wrap gap-1.5 rounded-lg border bg-muted/20 p-2">
                      {Array.from(selectedMemberIds).slice(0, 8).map((id) => {
                        const m = members.find((x) => x.id === id);
                        if (!m) return null;
                        const label = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email;
                        return (
                          <span key={id} className="inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-[11px] font-medium shadow-sm">
                            {label}
                            <button type="button" onClick={() => toggleMemberSelect(id)} className="rounded-full p-0.5 hover:bg-muted"><X className="h-3 w-3" /></button>
                          </span>
                        );
                      })}
                      {selectedMemberIds.size > 8 && <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-1 text-[11px] font-medium">+{selectedMemberIds.size - 8} more</span>}
                    </div>
                  )}
                </div>

                <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border">
                  {filteredAssignable.length === 0 ? (
                    <div className="px-4 py-12 text-center">
                      <Users className="mx-auto h-6 w-6 text-ink-300" />
                      <p className="mt-2 text-[13px] font-medium text-foreground">{memberSearch ? 'No matching members' : 'No members to add'}</p>
                      <p className="mt-1 text-[11px] text-muted-foreground">{memberSearch ? 'Try a different name or email.' : 'All members are already in this team.'}</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-border/60">
                      {filteredAssignable.map((m) => {
                        const label = [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email;
                        const isSelected = selectedMemberIds.has(m.id);
                        return (
                          <label key={m.id} className={`flex cursor-pointer items-center gap-3 px-3.5 py-3 transition-colors hover:bg-muted/40 ${isSelected ? 'bg-primary/[0.04]' : ''}`}>
                            <input type="checkbox" checked={isSelected} onChange={() => toggleMemberSelect(m.id)} className="h-4 w-4 rounded border-border" />
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold">{label.charAt(0).toUpperCase()}</span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium">{label}</span>
                              <span className="block truncate text-[11px] text-muted-foreground">{m.email}</span>
                            </span>
                            {isSelected && <Check className="h-4 w-4 text-primary" />}
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="flex shrink-0 justify-end gap-2 border-t border-border/60 pt-3">
                  <Button type="button" variant="outline" onClick={() => setAddMemberOpen(false)} className="h-9 rounded-lg">Cancel</Button>
                  <Button type="submit" disabled={submitting || selectedMemberIds.size === 0} className="h-9 rounded-lg px-5">
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Add {selectedMemberIds.size > 0 ? `${selectedMemberIds.size} member(s)` : 'members'}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </main>
    </div>
  );
}
