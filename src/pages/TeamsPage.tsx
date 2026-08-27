import { useEffect, useMemo, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import {
  fetchTeams,
  fetchTeam,
  createTeam,
  deleteTeam,
  addTeamMember,
  updateTeamMemberRole,
  removeTeamMember,
  clearTeamsError,
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import type { TeamNode } from '../types';
import {
  Loader2,
  Plus,
  Trash2,
  Users,
  ChevronRight,
  ChevronDown,
  UserPlus,
  CornerDownRight,
  FolderTree,
  Network,
  ChevronsDown,
  ChevronsUp,
  UserRound,
} from 'lucide-react';

function collectTeamIds(nodes: TeamNode[]): string[] {
  return nodes.flatMap((node) => [node.id, ...collectTeamIds(node.children)]);
}

function findTeamPath(nodes: TeamNode[], targetId: string, parents: TeamNode[] = []): TeamNode[] {
  for (const node of nodes) {
    const path = [...parents, node];
    if (node.id === targetId) return path;
    const childPath = findTeamPath(node.children, targetId, path);
    if (childPath.length > 0) return childPath;
  }
  return [];
}

/**
 * Teams, shown as the nested tree they are.
 *
 * A team's permissions inherit downward, so a lead of a parent team can manage
 * sub-teams without being listed on them. The action buttons on each node are
 * gated by the viewer's effective permissions *for that team*.
 */
export default function TeamsPage() {
  const dispatch = useAppDispatch();
  const currentOrg = useAppSelector((state) => state.org.currentOrg);
  const { tree, currentTeam, isLoading, error } = useAppSelector((state) => state.teams);
  const members = useAppSelector((state) => state.members.members);
  const { can } = usePermissions();
  const teamRoleOptions = useRoleOptions('TEAM');

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [createParentId, setCreateParentId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');
  const [newMemberRole, setNewMemberRole] = useState('TEAM_MEMBER');

  const orgId = currentOrg?.id;
  const allTeamIds = useMemo(() => collectTeamIds(tree), [tree]);
  const selectedPath = useMemo(
    () => (selectedId ? findTeamPath(tree, selectedId) : []),
    [tree, selectedId]
  );
  const createParent = useMemo(() => {
    if (!createParentId) return undefined;
    const path = findTeamPath(tree, createParentId);
    return path[path.length - 1];
  }, [tree, createParentId]);

  useEffect(() => {
    if (!orgId) return;
    dispatch(fetchTeams(orgId));
    dispatch(fetchMembers(orgId));
    dispatch(fetchRoles(orgId));
  }, [dispatch, orgId]);

  useEffect(() => {
    if (orgId && selectedId) dispatch(fetchTeam({ orgId, teamId: selectedId }));
  }, [dispatch, orgId, selectedId]);

  const openCreate = (parentId: string | null) => {
    setCreateParentId(parentId);
    setName('');
    setDescription('');
    setCreateOpen(true);
  };

  const onCreate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!orgId) return;
    setSubmitting(true);
    const result = await dispatch(
      createTeam({
        orgId,
        name: name.trim(),
        description: description.trim() || undefined,
        parentId: createParentId,
      })
    );
    setSubmitting(false);
    if (createTeam.fulfilled.match(result)) {
      if (createParentId) setExpanded((prev) => ({ ...prev, [createParentId]: true }));
      setCreateOpen(false);
    }
  };

  const onDelete = (team: TeamNode) => {
    if (!orgId) return;
    const hasChildren = team.children.length > 0;
    const message = hasChildren
      ? `"${team.name}" has ${team.children.length} sub-team(s). Delete it and everything beneath it?`
      : `Delete the team "${team.name}"?`;
    if (!window.confirm(message)) return;
    dispatch(deleteTeam({ orgId, teamId: team.id, cascade: hasChildren }));
    if (selectedId === team.id) setSelectedId(null);
  };

  const onAddMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!orgId || !selectedId || !newMemberId) return;
    setSubmitting(true);
    const result = await dispatch(
      addTeamMember({ orgId, teamId: selectedId, userId: newMemberId, role: newMemberRole })
    );
    setSubmitting(false);
    if (addTeamMember.fulfilled.match(result)) {
      setNewMemberId('');
      setNewMemberRole('TEAM_MEMBER');
      setAddMemberOpen(false);
    }
  };

  const renderNode = (team: TeamNode, level = 0) => {
    const isOpen = expanded[team.id] ?? level === 0;
    const isSelected = selectedId === team.id;
    const hasChildren = team.children.length > 0;

    return (
      <div key={team.id}>
        <div
          className="group/node flex min-w-max items-center py-0.5 pr-2"
          style={{ paddingLeft: `${level * 18}px` }}
        >
          {level > 0 && (
            <CornerDownRight className="mr-1 h-3.5 w-3.5 shrink-0 text-ink-300" strokeWidth={1.6} />
          )}
          <button
            type="button"
            className="mr-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted disabled:opacity-25"
            disabled={!hasChildren}
            onClick={() => setExpanded((prev) => ({ ...prev, [team.id]: !isOpen }))}
            aria-label={isOpen ? `Collapse ${team.name}` : `Expand ${team.name}`}
          >
            {hasChildren ? (
              isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
            ) : (
              <span className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setSelectedId(team.id)}
            className={`flex h-10 min-w-[15rem] flex-1 items-center gap-2.5 rounded-lg border px-2.5 text-left transition-colors ${
              isSelected
                ? 'border-primary/20 bg-primary/[0.045]'
                : 'border-transparent hover:border-border hover:bg-muted/35'
            }`}
          >
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${isSelected ? 'bg-primary/[0.09] text-primary' : 'bg-muted text-ink-500'}`}>
              <FolderTree className="h-3.5 w-3.5" strokeWidth={1.8} />
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">{team.name}</span>
            <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
              {team._count?.members ?? 0} member{(team._count?.members ?? 0) === 1 ? '' : 's'}
            </span>
          </button>

          <TeamNodeActions team={team} onCreateSub={openCreate} onDelete={onDelete} />
        </div>

        {isOpen && team.children.map((child) => renderNode(child, level + 1))}
      </div>
    );
  };

  // Only org members who are not already on the selected team can be added.
  const assignable = members.filter(
    (m) => !currentTeam?.members.some((tm) => tm.userId === m.id)
  );

  return (
    <div className="app-shell flex h-screen bg-workspace">
      <Sidebar onCreateForm={() => {}} />
      <main className="flex min-w-0 flex-1 flex-col overflow-y-auto lg:overflow-hidden">
        <PageHeader
          title="Teams"
          description={`Build and manage the team hierarchy for ${currentOrg?.name ?? 'this organization'}`}
          actions={can(ACTIONS.CREATE_TEAM) ? (
            <Button onClick={() => openCreate(null)} className="h-9 rounded-lg px-3.5">
              <Plus className="mr-2 h-4 w-4" strokeWidth={1.9} />
              <span className="hidden sm:inline">New root team</span>
              <span className="sm:hidden">New team</span>
            </Button>
          ) : undefined}
        />

        <div className="flex min-h-0 flex-1 flex-col gap-4 p-4 sm:p-5 lg:p-6">
          {error && (
            <div className="flex shrink-0 items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/[0.05] px-3 py-2.5 text-xs font-medium text-destructive" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => dispatch(clearTeamsError())} className="font-semibold">Dismiss</button>
            </div>
          )}

          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(20rem,0.9fr)_minmax(24rem,1.1fr)]">
            <Card className="flex min-h-[24rem] flex-col overflow-hidden rounded-xl border-border/80 bg-card shadow-none lg:min-h-0">
              <CardHeader className="shrink-0 border-b border-border/70 px-4 py-3.5 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/45 text-ink-600">
                      <Network className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <div>
                      <CardTitle className="font-display text-sm font-bold">Team structure</CardTitle>
                      <CardDescription className="mt-0.5 text-[11px]">{allTeamIds.length} team{allTeamIds.length === 1 ? '' : 's'} in this workspace</CardDescription>
                    </div>
                  </div>
                  {tree.length > 0 && (
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-md text-muted-foreground"
                        title="Expand all teams"
                        onClick={() => setExpanded(Object.fromEntries(allTeamIds.map((id) => [id, true])))}
                      >
                        <ChevronsDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 rounded-md text-muted-foreground"
                        title="Collapse all teams"
                        onClick={() => setExpanded({})}
                      >
                        <ChevronsUp className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-auto p-3">
                {isLoading && tree.length === 0 ? (
                  <div className="flex h-full min-h-40 items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  </div>
                ) : tree.length === 0 ? (
                  <div className="flex h-full min-h-48 flex-col items-center justify-center rounded-lg border border-dashed border-border px-5 text-center">
                    <FolderTree className="h-7 w-7 text-ink-300" strokeWidth={1.6} />
                    <p className="mt-3 text-[13px] font-semibold text-foreground">No teams yet</p>
                    <p className="mt-1 text-xs font-medium text-muted-foreground">Create a root team to begin your structure.</p>
                    {can(ACTIONS.CREATE_TEAM) && (
                      <Button size="sm" className="mt-4" onClick={() => openCreate(null)}>
                        <Plus className="mr-1.5 h-4 w-4" /> Create team
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="min-w-max pb-2">{tree.map((team) => renderNode(team))}</div>
                )}
              </CardContent>
            </Card>

            <Card className="flex min-h-[24rem] flex-col overflow-hidden rounded-xl border-border/80 bg-card shadow-none lg:min-h-0">
              <CardHeader className="shrink-0 border-b border-border/70 px-4 py-3.5 sm:px-5">
                {!currentTeam ? (
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/45 text-ink-600">
                      <Users className="h-4 w-4" strokeWidth={1.8} />
                    </span>
                    <div>
                      <CardTitle className="font-display text-sm font-bold">Team details</CardTitle>
                      <CardDescription className="mt-0.5 text-[11px]">Select a team from the hierarchy.</CardDescription>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      {selectedPath.length > 1 && (
                        <div className="mb-1.5 flex min-w-0 items-center gap-1 overflow-hidden text-[10px] font-medium text-muted-foreground">
                          {selectedPath.map((team, index) => (
                            <span key={team.id} className="flex min-w-0 items-center gap-1">
                              {index > 0 && <ChevronRight className="h-3 w-3 shrink-0" />}
                              <span className="max-w-24 truncate">{team.name}</span>
                            </span>
                          ))}
                        </div>
                      )}
                      <CardTitle className="truncate font-display text-base font-bold">{currentTeam.name}</CardTitle>
                      <CardDescription className="mt-1 line-clamp-2 text-xs">
                        {currentTeam.description || 'Members and inherited responsibilities for this team.'}
                      </CardDescription>
                    </div>
                    <TeamMemberAddButton teamId={currentTeam.id} onClick={() => setAddMemberOpen(true)} />
                  </div>
                )}
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                {!currentTeam ? (
                  <div className="flex h-full min-h-48 flex-col items-center justify-center text-center">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted/35 text-ink-400">
                      <FolderTree className="h-5 w-5" strokeWidth={1.7} />
                    </span>
                    <p className="mt-3 text-[13px] font-semibold text-foreground">Choose a team</p>
                    <p className="mt-1 max-w-xs text-xs font-medium leading-5 text-muted-foreground">Select any level in the tree to review its members and add people.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                        <p className="font-display text-lg font-bold tabular-nums">{currentTeam.members.length}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Members</p>
                      </div>
                      <div className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2.5">
                        <p className="font-display text-lg font-bold tabular-nums">{currentTeam.children.length}</p>
                        <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Direct sub-teams</p>
                      </div>
                    </div>
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="font-display text-xs font-bold text-foreground">Team members</h3>
                        <span className="text-[10px] font-medium text-muted-foreground">One role per person</span>
                      </div>
                      <TeamMemberList
                        teamId={currentTeam.id}
                        members={currentTeam.members}
                        onRoleChange={(userId, role) =>
                          orgId && dispatch(updateTeamMemberRole({ orgId, teamId: currentTeam.id, userId, role }))
                        }
                        onRemove={(userId, label) => {
                          if (!orgId) return;
                          if (!window.confirm(`Remove ${label} from ${currentTeam.name}?`)) return;
                          dispatch(removeTeamMember({ orgId, teamId: currentTeam.id, userId }));
                        }}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        {/* --- create team ------------------------------------------------ */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent onClose={() => setCreateOpen(false)}>
            <DialogHeader className="mb-4">
              <DialogTitle>{createParent ? `Add a sub-team to ${createParent.name}` : 'Create a root team'}</DialogTitle>
              <DialogDescription>
                {createParent
                  ? `The new team will sit directly under ${createParent.name} and inherit its parent roles.`
                  : 'This team will start a new top-level branch in the organization.'}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="team-name">Team name</Label>
                <Input
                  id="team-name"
                  required
                  placeholder="Engineering"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="team-description">Description (optional)</Label>
                <Textarea
                  id="team-description"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !name.trim()}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Create team
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* --- add member -------------------------------------------------- */}
        <Dialog open={addMemberOpen} onOpenChange={setAddMemberOpen}>
          <DialogContent onClose={() => setAddMemberOpen(false)}>
            <DialogHeader className="mb-4">
              <DialogTitle>Add member to {currentTeam?.name}</DialogTitle>
              <DialogDescription>
                Only people already in the organization can join a team.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onAddMember} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="member-user">Person</Label>
                <Select
                  id="member-user"
                  value={newMemberId}
                  placeholder="Select a member"
                  options={assignable.map((m) => ({
                    value: m.id,
                    label: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
                  }))}
                  onChange={(e) => setNewMemberId(e.target.value)}
                />
                {assignable.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Everyone in this organization is already on this team.
                  </p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="member-role">Role</Label>
                <Select
                  id="member-role"
                  value={newMemberRole}
                  options={teamRoleOptions}
                  onChange={(e) => setNewMemberRole(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setAddMemberOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !newMemberId}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Add member
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

/**
 * Per-team action buttons.
 *
 * A separate component because each team needs its *own* permission lookup:
 * rights on a sub-team can come from a role held on an ancestor.
 */
function TeamNodeActions({
  team,
  onCreateSub,
  onDelete,
}: {
  team: TeamNode;
  onCreateSub: (parentId: string) => void;
  onDelete: (team: TeamNode) => void;
}) {
  const { can } = usePermissions(team.id);
  return (
    <div className="ml-1 flex shrink-0 items-center gap-0.5">
      {can(ACTIONS.CREATE_TEAM) && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
          title={`Add sub-team under ${team.name}`}
          aria-label={`Add sub-team under ${team.name}`}
          onClick={() => onCreateSub(team.id)}
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={1.9} />
        </Button>
      )}
      {can(ACTIONS.DELETE_TEAM) && (
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 rounded-md text-muted-foreground hover:bg-destructive/[0.06] hover:text-destructive"
          title={`Delete ${team.name}`}
          aria-label={`Delete ${team.name}`}
          onClick={() => onDelete(team)}
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

function TeamMemberAddButton({ teamId, onClick }: { teamId: string; onClick: () => void }) {
  const { can } = usePermissions(teamId);
  if (!can(ACTIONS.ADD_TEAM_MEMBER)) return null;
  return (
    <Button size="sm" onClick={onClick} className="h-8 shrink-0 rounded-md px-2.5">
      <UserPlus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
      <span className="hidden sm:inline">Add member</span>
      <span className="sm:hidden">Add</span>
    </Button>
  );
}

function TeamMemberList({
  teamId,
  members,
  onRoleChange,
  onRemove,
}: {
  teamId: string;
  members: import('../types').TeamMember[];
  onRoleChange: (userId: string, role: string) => void;
  onRemove: (userId: string, label: string) => void;
}) {
  const { can } = usePermissions(teamId);
  const teamRoleOptions = useRoleOptions('TEAM');
  const canAssign = can(ACTIONS.ASSIGN_TEAM_ROLE);
  const canRemove = can(ACTIONS.REMOVE_TEAM_MEMBER);

  if (members.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-7 text-center">
        <UserRound className="mx-auto h-5 w-5 text-ink-300" strokeWidth={1.7} />
        <p className="mt-2 text-xs font-medium text-muted-foreground">No members have been added to this team.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {members.map((member) => {
        const label =
          [member.user.firstName, member.user.lastName].filter(Boolean).join(' ') ||
          member.user.email;
        const initial = label.charAt(0).toUpperCase();
        return (
          <div key={member.id} className="flex flex-col gap-3 rounded-lg border border-border/80 px-3 py-2.5 sm:flex-row sm:items-center">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-ink-600">{initial}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-foreground">{label}</p>
              <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">{member.user.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-1.5">
              {canAssign ? (
                <Select
                  value={member.role}
                  options={teamRoleOptions}
                  onChange={(e) => onRoleChange(member.userId, e.target.value)}
                  className="h-8 min-w-32 text-xs"
                />
              ) : (
                <span className="rounded-md bg-muted/60 px-2 py-1 text-[11px] font-medium text-muted-foreground">{roleLabel(member.role)}</span>
              )}
              {canRemove && (
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-md" onClick={() => onRemove(member.userId, label)} aria-label={`Remove ${label}`}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
