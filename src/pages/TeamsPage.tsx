import { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import {
  addTeamMember,
  clearCurrentTeam,
  clearTeamsError,
  createTeam,
  deleteTeam,
  fetchTeam,
  fetchTeams,
  removeTeamMember,
  resetTeams,
  updateTeam,
  updateTeamMemberRole,
} from '../store/teamsSlice';
import { fetchMembers } from '../store/membersSlice';
import { usePermissions, ACTIONS, useRoleOptions, roleLabel } from '../hooks/usePermissions';
import { fetchRoles } from '../store/rolesSlice';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Textarea } from '../components/ui/textarea';
import { Badge } from '../components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import type { TeamDetail, TeamMember, TeamNode } from '../types';
import {
  ChevronDown,
  ChevronRight,
  ChevronsDown,
  ChevronsUp,
  Edit3,
  FolderTree,
  Layers3,
  Loader2,
  Network,
  Plus,
  ShieldCheck,
  Trash2,
  UserPlus,
  Users,
  X,
} from 'lucide-react';

const DEFAULT_MEMBER_ROLE = 'CREATOR';

type CreateDialogParent = { id: string; name: string } | null;

function collectTeams(nodes: TeamNode[], result: TeamNode[] = []) {
  nodes.forEach((node) => {
    result.push(node);
    collectTeams(node.children, result);
  });
  return result;
}

function findTeamTrail(nodes: TeamNode[], teamId: string, trail: string[] = []): string[] | null {
  for (const node of nodes) {
    const nextTrail = [...trail, node.name];
    if (node.id === teamId) return nextTrail;
    const nestedTrail = findTeamTrail(node.children, teamId, nextTrail);
    if (nestedTrail) return nestedTrail;
  }
  return null;
}

function countDescendants(node: TeamNode): number {
  return node.children.reduce((total, child) => total + 1 + countDescendants(child), 0);
}

function getInitials(firstName: string | null | undefined, lastName: string | null | undefined, fallback: string) {
  const initials = `${firstName?.[0] || ''}${lastName?.[0] || ''}`.trim();
  return initials || fallback.slice(0, 2).toUpperCase();
}

/**
 * The teams page treats hierarchy as the primary object, rather than a flat
 * list. Rows are nested with a visible rail, and every node exposes the action
 * needed to add the next child without leaving the map.
 */
export default function TeamsPage() {
  const dispatch = useAppDispatch();
  const currentOrg = useAppSelector((state) => state.org.currentOrg);
  const { tree, currentTeam, isLoading, error } = useAppSelector((state) => state.teams);
  const members = useAppSelector((state) => state.members.members);
  const { can } = usePermissions();
  const teamRoleOptions = useRoleOptions('TEAM');
  const orgId = currentOrg?.id;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createParent, setCreateParent] = useState<CreateDialogParent>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editTeamId, setEditTeamId] = useState<string | null>(null);
  const [editTargetLabel, setEditTargetLabel] = useState('');
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState(DEFAULT_MEMBER_ROLE);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!orgId) return;
    // Clear the previous organization's selection and cached permissions before
    // loading the next tree. The selection below is derived from the new roots,
    // so the first team is ready without a second click.
    dispatch(resetTeams());
    dispatch(fetchTeams(orgId));
    dispatch(fetchMembers(orgId));
    dispatch(fetchRoles(orgId));
  }, [dispatch, orgId]);

  const allTeams = useMemo(() => collectTeams(tree), [tree]);
  const selectedTeamId = selectedId && allTeams.some((team) => team.id === selectedId)
    ? selectedId
    : tree[0]?.id ?? null;
  const selectedNode = useMemo(
    () => allTeams.find((team) => team.id === selectedTeamId) ?? null,
    [allTeams, selectedTeamId]
  );
  const selectedTrail = useMemo(
    () => (selectedTeamId ? findTeamTrail(tree, selectedTeamId) ?? [] : []),
    [selectedTeamId, tree]
  );
  const maxDepth = allTeams.length > 0 ? Math.max(...allTeams.map((team) => team.depth)) + 1 : 0;
  const detailLoading = Boolean(selectedTeamId && currentTeam?.id !== selectedTeamId);

  useEffect(() => {
    if (orgId && selectedTeamId) dispatch(fetchTeam({ orgId, teamId: selectedTeamId }));
  }, [dispatch, orgId, selectedTeamId]);
  const memberRoleDefault = teamRoleOptions.some((option) => option.value === DEFAULT_MEMBER_ROLE)
    ? DEFAULT_MEMBER_ROLE
    : teamRoleOptions[0]?.value || DEFAULT_MEMBER_ROLE;

  const openCreate = (parentId: string | null, parentName?: string) => {
    setCreateParent(parentId && parentName ? { id: parentId, name: parentName } : null);
    setName('');
    setDescription('');
    setCreateOpen(true);
  };

  const openEdit = (team: TeamNode | TeamDetail) => {
    setEditTeamId(team.id);
    setEditTargetLabel(team.name);
    setEditName(team.name);
    setEditDescription(team.description || '');
    setEditOpen(true);
  };

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!orgId || !name.trim()) return;
    setSubmitting(true);
    const result = await dispatch(
      createTeam({
        orgId,
        name: name.trim(),
        description: description.trim() || undefined,
        parentId: createParent?.id ?? null,
      })
    );
    setSubmitting(false);

    if (createTeam.fulfilled.match(result)) {
      if (createParent?.id) setExpanded((previous) => ({ ...previous, [createParent.id]: true }));
      setCreateOpen(false);
      const created = result.payload as { id?: string };
      if (created.id) setSelectedId(created.id);
    }
  };

  const onEdit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!orgId || !editTeamId || !editName.trim()) return;
    setSubmitting(true);
    const result = await dispatch(updateTeam({
      orgId,
      teamId: editTeamId,
      name: editName.trim(),
      description: editDescription.trim() || null,
    }));
    setSubmitting(false);

    if (updateTeam.fulfilled.match(result)) {
      setEditOpen(false);
      if (selectedTeamId === editTeamId) dispatch(fetchTeam({ orgId, teamId: editTeamId }));
    }
  };

  const onDelete = (team: TeamNode) => {
    if (!orgId || team.isDefault) return;
    const descendantCount = countDescendants(team);
    const message = descendantCount > 0
      ? `"${team.name}" contains ${descendantCount} sub-team${descendantCount === 1 ? '' : 's'}. Delete the entire branch?`
      : `Delete the team "${team.name}"?`;
    if (!window.confirm(message)) return;

    dispatch(deleteTeam({ orgId, teamId: team.id, cascade: descendantCount > 0 }));
    const selectedIsInsideBranch = Boolean(
      selectedNode && (selectedNode.id === team.id || selectedNode.path.startsWith(`${team.path}/`))
    );
    if (selectedIsInsideBranch) {
      setSelectedId(null);
      dispatch(clearCurrentTeam());
    }
  };

  const onAddMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!orgId || !selectedTeamId || !newMemberId) return;
    setSubmitting(true);
    const result = await dispatch(addTeamMember({
      orgId,
      teamId: selectedTeamId,
      userId: newMemberId,
      role: newMemberRole,
    }));
    setSubmitting(false);

    if (addTeamMember.fulfilled.match(result)) {
      setNewMemberId('');
      setNewMemberRole(memberRoleDefault);
      setAddMemberOpen(false);
    }
  };

  const expandAll = () => {
    setExpanded(Object.fromEntries(allTeams.map((team) => [team.id, true])));
  };

  const collapseAll = () => {
    setExpanded(Object.fromEntries(allTeams.map((team) => [team.id, false])));
  };

  const openAddMember = () => {
    setNewMemberId('');
    setNewMemberRole(memberRoleDefault);
    setAddMemberOpen(true);
  };

  const assignable = members.filter(
    (member) => !currentTeam?.members.some((teamMember) => teamMember.userId === member.id)
  );

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar onCreateForm={() => {}} />
      <main className="min-w-0 flex-1 overflow-y-auto bg-muted/20">
        <PageHeader
          title="Teams"
          description={`A clear view of the people and work inside ${currentOrg?.name ?? 'this organization'}`}
          actions={can(ACTIONS.CREATE_TEAM) ? (
            <Button onClick={() => openCreate(null)} className="h-9 rounded-lg px-3.5">
              <Plus className="mr-2 h-4 w-4" strokeWidth={1.9} />
              <span className="hidden sm:inline">New root team</span>
              <span className="sm:hidden">New team</span>
            </Button>
          ) : undefined}
        />

        <div className="mx-auto w-full max-w-[1600px] p-4 sm:p-6 lg:p-8">
          <section className="relative mb-6 overflow-hidden rounded-2xl border border-primary/10 bg-gradient-to-br from-primary/[0.1] via-card to-card p-5 shadow-[0_8px_28px_hsl(var(--foreground)/0.03)] sm:p-6">
            <div className="pointer-events-none absolute -right-14 -top-20 h-52 w-52 rounded-full bg-primary/[0.08] blur-3xl" />
            <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm">
                  <FolderTree className="h-[18px] w-[18px]" strokeWidth={1.8} />
                </span>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary">Organization map</p>
                  <h2 className="mt-1 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                    Structure that scales with your teams
                  </h2>
                  <p className="mt-1 max-w-2xl text-xs font-medium leading-5 text-muted-foreground sm:text-[13px]">
                    Explore every layer, add a child exactly where it belongs, and manage each team without losing the bigger picture.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center">
                <SummaryPill icon={<Layers3 className="h-3.5 w-3.5" />} value={allTeams.length} label="Teams" />
                <SummaryPill icon={<Users className="h-3.5 w-3.5" />} value={members.length} label="People" />
                <SummaryPill icon={<Network className="h-3.5 w-3.5" />} value={maxDepth} label="Levels" />
              </div>
            </div>
          </section>

          {error && (
            <div className="mb-5 flex items-start justify-between gap-3 rounded-xl border border-destructive/20 bg-destructive/[0.06] px-4 py-3 text-sm text-destructive" role="alert">
              <span className="font-medium">{error}</span>
              <button type="button" onClick={() => dispatch(clearTeamsError())} className="shrink-0 rounded-md p-1 font-semibold hover:bg-destructive/10" aria-label="Dismiss error">
                <X className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(24rem,0.8fr)]">
            <Card className="overflow-visible rounded-2xl border-border/80 bg-card shadow-[0_8px_28px_hsl(var(--foreground)/0.035)]">
              <CardHeader className="border-b border-border/70 px-5 py-5 sm:px-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
                        <Network className="h-4 w-4" strokeWidth={1.8} />
                      </span>
                      <CardTitle className="font-display text-base font-bold tracking-tight sm:text-lg">Team structure</CardTitle>
                    </div>
                    <CardDescription className="mt-2 max-w-lg text-xs font-medium leading-5">
                      Select a team to see its members. Use the plus action on any row to add a sub-team at that level.
                    </CardDescription>
                  </div>
                  {tree.length > 0 && (
                    <div className="flex shrink-0 items-center gap-1 rounded-lg border border-border bg-muted/25 p-1">
                      <Button variant="ghost" size="sm" onClick={expandAll} className="h-8 rounded-md px-2 text-[11px] font-semibold text-muted-foreground hover:bg-card hover:text-foreground" title="Expand every team">
                        <ChevronsDown className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                        Expand
                      </Button>
                      <Button variant="ghost" size="sm" onClick={collapseAll} className="h-8 rounded-md px-2 text-[11px] font-semibold text-muted-foreground hover:bg-card hover:text-foreground" title="Collapse every team">
                        <ChevronsUp className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.8} />
                        Collapse
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="px-4 py-4 sm:px-5 sm:py-5">
                {isLoading && tree.length === 0 ? (
                  <div className="flex min-h-60 items-center justify-center">
                    <div className="text-center">
                      <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
                      <p className="text-sm font-medium text-muted-foreground">Loading team structure…</p>
                    </div>
                  </div>
                ) : tree.length === 0 ? (
                  <div className="flex min-h-60 flex-col items-center justify-center rounded-xl border border-dashed border-border bg-muted/15 px-5 text-center">
                    <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/[0.07] text-primary">
                      <FolderTree className="h-6 w-6" strokeWidth={1.8} />
                    </div>
                    <p className="font-display text-base font-bold text-foreground">No teams yet</p>
                    <p className="mb-5 mt-1 max-w-sm text-xs font-medium leading-5 text-muted-foreground">
                      Start with a root team, then grow the structure by adding children directly from the map.
                    </p>
                    {can(ACTIONS.CREATE_TEAM) && (
                      <Button size="sm" onClick={() => openCreate(null)} className="rounded-lg">
                        <Plus className="mr-1.5 h-4 w-4" strokeWidth={1.9} />
                        Create root team
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-1">
                    {tree.map((team) => (
                      <TeamTreeItem
                        key={team.id}
                        team={team}
                        expanded={expanded}
                        selectedId={selectedTeamId}
                        onToggle={(teamId, open) => setExpanded((previous) => ({ ...previous, [teamId]: open }))}
                        onSelect={setSelectedId}
                        onCreateSub={(teamId, teamName) => openCreate(teamId, teamName)}
                        onEdit={openEdit}
                        onDelete={onDelete}
                      />
                    ))}
                  </div>
                )}
              </CardContent>
              {tree.length > 0 && (
                <div className="flex items-center gap-2 border-t border-border/70 px-5 py-3 text-[11px] font-medium text-muted-foreground sm:px-6">
                  <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-primary" strokeWidth={1.8} />
                  Roles inherit down the hierarchy. Actions shown on each team reflect your access there.
                </div>
              )}
            </Card>

            <TeamDetailPanel
              team={detailLoading ? null : currentTeam}
              trail={selectedTrail}
              loading={detailLoading}
              onAddSub={() => {
                if (selectedNode) openCreate(selectedNode.id, selectedNode.name);
              }}
              onAddMember={openAddMember}
              onEdit={() => {
                if (currentTeam) openEdit(currentTeam);
              }}
              onDelete={() => {
                if (selectedNode) onDelete(selectedNode);
              }}
              onRoleChange={(userId, role) => {
                if (orgId && selectedTeamId) dispatch(updateTeamMemberRole({ orgId, teamId: selectedTeamId, userId, role }));
              }}
              onRemove={(userId, label) => {
                if (!orgId || !selectedTeamId || !currentTeam) return;
                if (!window.confirm(`Remove ${label} from ${currentTeam.name}?`)) return;
                dispatch(removeTeamMember({ orgId, teamId: selectedTeamId, userId }));
              }}
            />
          </div>
        </div>
      </main>

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent onClose={() => setCreateOpen(false)} className="max-w-md overflow-hidden rounded-2xl p-0">
          <div className="bg-gradient-to-br from-primary/[0.1] via-card to-card px-6 pb-5 pt-6">
            <DialogHeader className="pr-7 text-left">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white">
                {createParent ? <Plus className="h-5 w-5" strokeWidth={1.9} /> : <FolderTree className="h-5 w-5" strokeWidth={1.8} />}
              </div>
              <DialogTitle className="font-display text-xl">{createParent ? 'Add a sub-team' : 'Create a root team'}</DialogTitle>
              <DialogDescription className="mt-2 text-xs font-medium leading-5">
                {createParent
                  ? `This team will sit directly under ${createParent.name} and inherit its structure. You become its Team Lead.`
                  : 'Root teams are the first layer of your organization. You become the Team Lead automatically.'}
              </DialogDescription>
            </DialogHeader>
          </div>
          <form onSubmit={onCreate} className="space-y-4 px-6 py-5">
            {createParent && (
              <div className="flex items-center gap-2 rounded-xl border border-primary/15 bg-primary/[0.055] px-3 py-2.5 text-xs font-semibold text-primary">
                <Network className="h-3.5 w-3.5 shrink-0" strokeWidth={1.8} />
                <span className="truncate">Parent team: {createParent.name}</span>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="team-name">Team name</Label>
              <Input id="team-name" required minLength={2} maxLength={100} placeholder="Engineering" value={name} onChange={(event) => setName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="team-description">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea id="team-description" rows={3} maxLength={500} placeholder="What does this team own?" value={description} onChange={(event) => setDescription(event.target.value)} />
            </div>
            <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)} className="rounded-lg">Cancel</Button>
              <Button type="submit" disabled={submitting || !name.trim()} className="rounded-lg">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create team
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent onClose={() => setEditOpen(false)} className="max-w-md rounded-2xl">
          <DialogHeader className="mb-5 pr-7 text-left">
            <DialogTitle className="font-display text-xl">Edit {editTargetLabel || 'team'}</DialogTitle>
            <DialogDescription className="mt-2 text-xs font-medium">Rename the team or keep its purpose clear. Its place in the hierarchy will stay the same.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onEdit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="edit-team-name">Team name</Label>
              <Input id="edit-team-name" required minLength={2} maxLength={100} value={editName} onChange={(event) => setEditName(event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="edit-team-description">Description <span className="font-normal text-muted-foreground">(optional)</span></Label>
              <Textarea id="edit-team-description" rows={3} maxLength={500} value={editDescription} onChange={(event) => setEditDescription(event.target.value)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setEditOpen(false)} className="rounded-lg">Cancel</Button>
              <Button type="submit" disabled={submitting || !editName.trim()} className="rounded-lg">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save changes
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
        <DialogContent onClose={() => setAddMemberOpen(false)} className="max-w-md rounded-2xl">
          <DialogHeader className="mb-5 pr-7 text-left">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-primary/[0.08] text-primary">
              <UserPlus className="h-5 w-5" strokeWidth={1.8} />
            </div>
            <DialogTitle className="font-display text-xl">Add someone to {currentTeam?.name}</DialogTitle>
            <DialogDescription className="mt-2 text-xs font-medium">Choose an existing organization member and the role they should hold on this team.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onAddMember} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="member-user">Person</Label>
              <Select
                id="member-user"
                value={newMemberId}
                placeholder="Select a member"
                options={assignable.map((member) => ({
                  value: member.id,
                  label: [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email,
                }))}
                onChange={(event) => setNewMemberId(event.target.value)}
              />
              {assignable.length === 0 && <p className="text-xs font-medium text-muted-foreground">Everyone in this organization is already on this team.</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="member-role">Team role</Label>
              <Select id="member-role" value={newMemberRole} options={teamRoleOptions} onChange={(event) => setNewMemberRole(event.target.value)} />
            </div>
            <div className="flex justify-end gap-2 border-t border-border/70 pt-4">
              <Button type="button" variant="outline" onClick={() => setAddMemberOpen(false)} className="rounded-lg">Cancel</Button>
              <Button type="submit" disabled={submitting || !newMemberId} className="rounded-lg">
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add member
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryPill({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="flex min-w-0 items-center gap-2 rounded-xl border border-border/80 bg-card/80 px-3 py-2.5 shadow-sm backdrop-blur-sm">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-ink-500">{icon}</span>
      <span className="min-w-0">
        <span className="block font-display text-base font-bold leading-none tabular-nums text-foreground">{value}</span>
        <span className="mt-1 block text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</span>
      </span>
    </div>
  );
}

function TeamTreeItem({
  team,
  expanded,
  selectedId,
  onToggle,
  onSelect,
  onCreateSub,
  onEdit,
  onDelete,
}: {
  team: TeamNode;
  expanded: Record<string, boolean>;
  selectedId: string | null;
  onToggle: (teamId: string, open: boolean) => void;
  onSelect: (teamId: string) => void;
  onCreateSub: (teamId: string, teamName: string) => void;
  onEdit: (team: TeamNode) => void;
  onDelete: (team: TeamNode) => void;
}) {
  const { can } = usePermissions(team.id);
  const isOpen = expanded[team.id] ?? team.depth === 0;
  const isSelected = selectedId === team.id;
  const memberCount = team._count?.members ?? 0;
  const childCount = team._count?.children ?? team.children.length;

  return (
    <div>
      <div className={`group relative flex min-w-0 items-center gap-1.5 rounded-xl border px-2 py-2 transition-all duration-200 sm:gap-2 sm:px-2.5 ${isSelected ? 'border-primary/25 bg-primary/[0.055] shadow-sm' : 'border-transparent hover:border-border/80 hover:bg-muted/35'}`}>
        {isSelected && <span className="absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-primary" aria-hidden="true" />}
        <button
          type="button"
          disabled={childCount === 0}
          onClick={() => onToggle(team.id, !isOpen)}
          aria-label={isOpen ? `Collapse ${team.name}` : `Expand ${team.name}`}
          aria-expanded={childCount > 0 ? isOpen : undefined}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-card hover:text-foreground disabled:cursor-default disabled:opacity-30"
        >
          {childCount > 0 ? (isOpen ? <ChevronDown className="h-4 w-4" strokeWidth={1.9} /> : <ChevronRight className="h-4 w-4" strokeWidth={1.9} />) : <span className="h-1.5 w-1.5 rounded-full bg-border" />}
        </button>

        <button type="button" onClick={() => onSelect(team.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left sm:gap-3">
          <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border ${isSelected ? 'border-primary/15 bg-primary/[0.1] text-primary' : 'border-border bg-muted/60 text-ink-500'}`}>
            <Network className="h-4 w-4" strokeWidth={1.8} />
          </span>
          <span className="min-w-0 flex-1">
            <span className={`block truncate text-[13px] font-bold transition-colors ${isSelected ? 'text-primary' : 'text-foreground group-hover:text-primary'}`}>{team.name}</span>
            <span className="mt-1 block truncate text-[10px] font-semibold text-muted-foreground">
              {memberCount} member{memberCount === 1 ? '' : 's'}{childCount > 0 ? ` · ${childCount} sub-team${childCount === 1 ? '' : 's'}` : ''}
            </span>
          </span>
        </button>

        <div className={`flex shrink-0 items-center gap-0.5 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 ${isSelected ? 'sm:opacity-100' : ''}`}>
          {can(ACTIONS.CREATE_TEAM) && (
            <Button variant="ghost" size="icon" onClick={() => onCreateSub(team.id, team.name)} className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-card hover:text-primary" title={`Add a sub-team under ${team.name}`} aria-label={`Add a sub-team under ${team.name}`}>
              <Plus className="h-4 w-4" strokeWidth={1.9} />
            </Button>
          )}
          {can(ACTIONS.EDIT_TEAM) && (
            <Button variant="ghost" size="icon" onClick={() => onEdit(team)} className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-card hover:text-foreground" title={`Edit ${team.name}`} aria-label={`Edit ${team.name}`}>
              <Edit3 className="h-3.5 w-3.5" strokeWidth={1.9} />
            </Button>
          )}
          {can(ACTIONS.DELETE_TEAM) && !team.isDefault && (
            <Button variant="ghost" size="icon" onClick={() => onDelete(team)} className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/[0.07] hover:text-destructive" title={`Delete ${team.name}`} aria-label={`Delete ${team.name}`}>
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
            </Button>
          )}
        </div>
      </div>

      {isOpen && team.children.length > 0 && (
        <div className="ml-5 space-y-1 border-l border-border/80 pl-3 pt-1 sm:ml-6 sm:pl-3">
          {team.children.map((child) => (
            <TeamTreeItem
              key={child.id}
              team={child}
              expanded={expanded}
              selectedId={selectedId}
              onToggle={onToggle}
              onSelect={onSelect}
              onCreateSub={onCreateSub}
              onEdit={onEdit}
              onDelete={onDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function TeamDetailPanel({
  team,
  trail,
  loading,
  onAddSub,
  onAddMember,
  onEdit,
  onDelete,
  onRoleChange,
  onRemove,
}: {
  team: TeamDetail | null;
  trail: string[];
  loading: boolean;
  onAddSub: () => void;
  onAddMember: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRoleChange: (userId: string, role: string) => void;
  onRemove: (userId: string, label: string) => void;
}) {
  const { can } = usePermissions(team?.id);
  const memberCount = team?.members.length ?? 0;
  const childCount = team?.children.length ?? 0;

  return (
    <Card className="overflow-visible rounded-2xl border-border/80 bg-card shadow-[0_8px_28px_hsl(var(--foreground)/0.035)]">
      {loading ? (
        <div className="flex min-h-[30rem] items-center justify-center px-5 py-10">
          <div className="text-center">
            <Loader2 className="mx-auto mb-3 h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-muted-foreground">Loading team details…</p>
          </div>
        </div>
      ) : !team ? (
        <div className="flex min-h-[30rem] flex-col items-center justify-center px-6 py-10 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
            <Users className="h-6 w-6" strokeWidth={1.8} />
          </div>
          <CardTitle className="font-display text-lg">Select a team</CardTitle>
          <CardDescription className="mt-2 max-w-xs text-xs font-medium leading-5">
            Choose any node in the structure to see members, roles, and team actions here.
          </CardDescription>
        </div>
      ) : (
        <>
          <CardHeader className="border-b border-border/70 px-5 py-5 sm:px-6">
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-sm">
                  <Network className="h-5 w-5" strokeWidth={1.8} />
                </span>
                <div className="min-w-0">
                  <p className="mb-1 truncate text-[10px] font-bold uppercase tracking-[0.13em] text-primary" title={trail.join(' / ')}>
                    {trail.length > 1 ? trail.slice(0, -1).join(' / ') : 'Root team'}
                  </p>
                  <CardTitle className="truncate font-display text-xl font-bold tracking-tight">{team.name}</CardTitle>
                  <CardDescription className="mt-1 line-clamp-2 text-xs font-medium leading-5">
                    {team.description || 'No description added yet.'}
                  </CardDescription>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-0.5">
                {can(ACTIONS.EDIT_TEAM) && (
                  <Button variant="ghost" size="icon" onClick={onEdit} className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground" title="Edit team" aria-label="Edit team">
                    <Edit3 className="h-3.5 w-3.5" strokeWidth={1.9} />
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 px-5 py-5 sm:px-6">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              <DetailStat icon={<Users className="h-4 w-4" />} value={memberCount} label="Members" />
              <DetailStat icon={<Network className="h-4 w-4" />} value={childCount} label="Sub-teams" />
              <DetailStat icon={<Layers3 className="h-4 w-4" />} value={team.depth + 1} label="Level" className="col-span-2 sm:col-span-1" />
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              {can(ACTIONS.ADD_TEAM_MEMBER) && (
                <Button onClick={onAddMember} className="h-9 flex-1 rounded-lg text-xs">
                  <UserPlus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
                  Add member
                </Button>
              )}
              {can(ACTIONS.CREATE_TEAM) && (
                <Button variant="outline" onClick={onAddSub} className="h-9 flex-1 rounded-lg text-xs">
                  <Plus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
                  Add sub-team
                </Button>
              )}
              {can(ACTIONS.DELETE_TEAM) && !team.isDefault && (
                <Button variant="ghost" onClick={onDelete} className="h-9 rounded-lg px-2.5 text-xs text-destructive hover:bg-destructive/[0.06] hover:text-destructive" title="Delete team">
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                  <span className="sr-only sm:not-sr-only sm:ml-1.5">Delete</span>
                </Button>
              )}
            </div>

            <div>
              <div className="mb-3 flex items-end justify-between gap-3">
                <div>
                  <h3 className="font-display text-sm font-bold text-foreground">People on this team</h3>
                  <p className="mt-1 text-[11px] font-medium text-muted-foreground">One role per person. Roles can inherit to child teams.</p>
                </div>
                <Badge variant="outline" className="shrink-0 border-border bg-muted/40 text-muted-foreground">{memberCount}</Badge>
              </div>
              <TeamMemberList
                teamId={team.id}
                members={team.members}
                onRoleChange={onRoleChange}
                onRemove={onRemove}
              />
            </div>
          </CardContent>
        </>
      )}
    </Card>
  );
}

function DetailStat({ icon, value, label, className = '' }: { icon: React.ReactNode; value: number; label: string; className?: string }) {
  return (
    <div className={`rounded-xl border border-border/75 bg-muted/25 px-3 py-3 ${className}`}>
      <div className="flex items-center gap-2 text-ink-500">{icon}<span className="font-display text-lg font-bold leading-none tabular-nums text-foreground">{value}</span></div>
      <p className="mt-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">{label}</p>
    </div>
  );
}

function TeamMemberList({
  teamId,
  members,
  onRoleChange,
  onRemove,
}: {
  teamId: string;
  members: TeamMember[];
  onRoleChange: (userId: string, role: string) => void;
  onRemove: (userId: string, label: string) => void;
}) {
  const { can } = usePermissions(teamId);
  const teamRoleOptions = useRoleOptions('TEAM');
  const canAssign = can(ACTIONS.ASSIGN_TEAM_ROLE);
  const canRemove = can(ACTIONS.REMOVE_TEAM_MEMBER);

  if (members.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border bg-muted/15 px-4 py-8 text-center">
        <UserPlus className="mx-auto mb-2 h-5 w-5 text-muted-foreground" strokeWidth={1.8} />
        <p className="text-xs font-semibold text-foreground">No members yet</p>
        <p className="mt-1 text-[11px] font-medium text-muted-foreground">Add people when this team is ready to collaborate.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) => {
        const label = [member.user.firstName, member.user.lastName].filter(Boolean).join(' ') || member.user.email;
        const initials = getInitials(member.user.firstName, member.user.lastName, member.user.email);
        return (
          <div key={member.id} className="flex items-center gap-3 rounded-xl border border-border/75 bg-card px-3 py-3 transition-colors hover:border-primary/15 hover:bg-primary/[0.02]">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/[0.09] text-[11px] font-bold text-primary">{initials}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-bold text-foreground">{label}</p>
              <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">{member.user.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {canAssign ? (
                <Select
                  value={member.role}
                  options={teamRoleOptions}
                  onChange={(event) => onRoleChange(member.userId, event.target.value)}
                  className="h-8 min-w-[6.5rem] rounded-lg px-2 text-xs"
                  aria-label={`Role for ${label}`}
                />
              ) : (
                <Badge variant="outline" className="border-border bg-muted/40 text-[10px] text-muted-foreground">{roleLabel(member.role)}</Badge>
              )}
              {canRemove && (
                <Button variant="ghost" size="icon" onClick={() => onRemove(member.userId, label)} className="h-8 w-8 rounded-lg text-muted-foreground hover:bg-destructive/[0.06] hover:text-destructive" title={`Remove ${label}`} aria-label={`Remove ${label}`}>
                  <Trash2 className="h-3.5 w-3.5" strokeWidth={1.9} />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
