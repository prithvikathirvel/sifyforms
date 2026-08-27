import { useEffect, useState } from 'react';
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
} from 'lucide-react';

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
    return (
      <div key={team.id}>
        <div
          className={`flex items-center gap-1 rounded-md px-2 py-2 transition-colors hover:bg-accent ${
            isSelected ? 'bg-accent' : ''
          }`}
          style={{ paddingLeft: `${level * 20 + 8}px` }}
        >
          <button
            type="button"
            className="shrink-0 text-muted-foreground disabled:opacity-30"
            disabled={team.children.length === 0}
            onClick={() => setExpanded((prev) => ({ ...prev, [team.id]: !isOpen }))}
            aria-label={isOpen ? 'Collapse' : 'Expand'}
          >
            {team.children.length > 0 ? (
              isOpen ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )
            ) : (
              <span className="inline-block h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={() => setSelectedId(team.id)}
            className="flex min-w-0 flex-1 items-center gap-2 text-left"
          >
            <Users className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate font-medium">{team.name}</span>
            <span className="shrink-0 text-xs text-muted-foreground">
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
    <div className="flex min-h-screen">
      <Sidebar onCreateForm={() => {}} />
      <main className="min-w-0 flex-1 overflow-y-auto bg-muted/20">
        <PageHeader
          title="Teams"
          description={`Team structure and inherited roles in ${currentOrg?.name ?? 'this organization'}`}
          actions={can(ACTIONS.CREATE_TEAM) ? (
            <Button onClick={() => openCreate(null)} className="h-9 rounded-lg px-3.5">
              <Plus className="mr-2 h-4 w-4" strokeWidth={1.9} />
              <span className="hidden sm:inline">New team</span>
              <span className="sm:hidden">New</span>
            </Button>
          ) : undefined}
        />
        <div className="space-y-6 p-4 sm:p-6 lg:p-8">
        {error && (
          <div
            className="flex items-center justify-between gap-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            <span>{error}</span>
            <button type="button" onClick={() => dispatch(clearTeamsError())}>
              Dismiss
            </button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Team structure</CardTitle>
              <CardDescription>Select a team to manage its members.</CardDescription>
            </CardHeader>
            <CardContent>
              {isLoading && tree.length === 0 ? (
                <div className="flex justify-center p-6">
                  <Loader2 className="h-6 w-6 animate-spin text-primary" />
                </div>
              ) : tree.length === 0 ? (
                <p className="py-6 text-center text-muted-foreground">
                  No teams yet. Create one to get started.
                </p>
              ) : (
                <div className="space-y-1">{tree.map((team) => renderNode(team))}</div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
              <div>
                <CardTitle className="text-lg">
                  {currentTeam ? currentTeam.name : 'Team members'}
                </CardTitle>
                <CardDescription>
                  {currentTeam
                    ? currentTeam.description || 'One role per person per team.'
                    : 'Select a team on the left.'}
                </CardDescription>
              </div>
              {currentTeam && (
                <TeamMemberAddButton
                  teamId={currentTeam.id}
                  onClick={() => setAddMemberOpen(true)}
                />
              )}
            </CardHeader>
            <CardContent>
              {!currentTeam ? (
                <p className="py-6 text-center text-muted-foreground">No team selected.</p>
              ) : (
                <TeamMemberList
                  teamId={currentTeam.id}
                  members={currentTeam.members}
                  onRoleChange={(userId, role) =>
                    orgId &&
                    dispatch(updateTeamMemberRole({ orgId, teamId: currentTeam.id, userId, role }))
                  }
                  onRemove={(userId, label) => {
                    if (!orgId) return;
                    if (!window.confirm(`Remove ${label} from ${currentTeam.name}?`)) return;
                    dispatch(removeTeamMember({ orgId, teamId: currentTeam.id, userId }));
                  }}
                />
              )}
            </CardContent>
          </Card>
        </div>

        {/* --- create team ------------------------------------------------ */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent onClose={() => setCreateOpen(false)}>
            <DialogHeader className="mb-4">
              <DialogTitle>{createParentId ? 'New sub-team' : 'New team'}</DialogTitle>
              <DialogDescription>
                You become its Team Lead. {createParentId && 'It inherits the parent team’s roles.'}
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
    <div className="flex shrink-0 items-center gap-1">
      {can(ACTIONS.CREATE_TEAM) && (
        <Button
          variant="ghost"
          size="sm"
          title="Add sub-team"
          onClick={() => onCreateSub(team.id)}
        >
          <CornerDownRight className="h-4 w-4" />
        </Button>
      )}
      {can(ACTIONS.DELETE_TEAM) && (
        <Button variant="ghost" size="sm" title="Delete team" onClick={() => onDelete(team)}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      )}
    </div>
  );
}

function TeamMemberAddButton({ teamId, onClick }: { teamId: string; onClick: () => void }) {
  const { can } = usePermissions(teamId);
  if (!can(ACTIONS.ADD_TEAM_MEMBER)) return null;
  return (
    <Button size="sm" onClick={onClick}>
      <UserPlus className="mr-2 h-4 w-4" />
      Add member
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
    return <p className="py-6 text-center text-muted-foreground">This team has no members yet.</p>;
  }

  return (
    <div className="space-y-2">
      {members.map((member) => {
        const label =
          [member.user.firstName, member.user.lastName].filter(Boolean).join(' ') ||
          member.user.email;
        return (
          <div
            key={member.id}
            className="flex items-center justify-between gap-3 rounded-md border p-3"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{label}</p>
              <p className="truncate text-sm text-muted-foreground">{member.user.email}</p>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {canAssign ? (
                <Select
                  value={member.role}
                  options={teamRoleOptions}
                  onChange={(e) => onRoleChange(member.userId, e.target.value)}
                />
              ) : (
                <span className="text-sm text-muted-foreground">{roleLabel(member.role)}</span>
              )}
              {canRemove && (
                <Button variant="ghost" size="sm" onClick={() => onRemove(member.userId, label)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
