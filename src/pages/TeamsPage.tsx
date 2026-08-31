import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import {
  fetchTeams,
  fetchTeam,
  createTeam,
  deleteTeam,
  addTeamMember,
  removeTeamMember,
  clearTeamsError,
} from '../store/teamsSlice';
import { fetchMembers } from '../store/membersSlice';
import { usePermissions, ACTIONS } from '../hooks/usePermissions';
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
import type { Team, TeamMember } from '../types';
import {
  Loader2,
  Plus,
  Trash2,
  Users,
  UserPlus,
  Network,
  UserRound,
} from 'lucide-react';

/**
 * Teams, shown as the flat list they are.
 *
 * Teams are organizational buckets: they group forms and act as targets for
 * per-form sharing. They carry no permissions — a member's access comes from
 * their organization role alone.
 */
export default function TeamsPage() {
  const dispatch = useAppDispatch();
  const currentOrg = useAppSelector((state) => state.org.currentOrg);
  const { teams, currentTeam, isLoading, error } = useAppSelector((state) => state.teams);
  const members = useAppSelector((state) => state.members.members);
  const { can } = usePermissions();

  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const [addMemberOpen, setAddMemberOpen] = useState(false);
  const [newMemberId, setNewMemberId] = useState('');

  const orgId = currentOrg?.id;

  useEffect(() => {
    if (!orgId) return;
    dispatch(fetchTeams(orgId));
    dispatch(fetchMembers(orgId));
  }, [dispatch, orgId]);

  useEffect(() => {
    if (orgId && selectedId) dispatch(fetchTeam({ orgId, teamId: selectedId }));
  }, [dispatch, orgId, selectedId]);

  const openCreate = () => {
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
      })
    );
    setSubmitting(false);
    if (createTeam.fulfilled.match(result)) setCreateOpen(false);
  };

  const onDelete = (team: Team) => {
    if (!orgId) return;
    if (!window.confirm(`Delete the team "${team.name}"? Its forms will move to General.`)) return;
    dispatch(deleteTeam({ orgId, teamId: team.id }));
    if (selectedId === team.id) setSelectedId(null);
  };

  const onAddMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!orgId || !selectedId || !newMemberId) return;
    setSubmitting(true);
    const result = await dispatch(
      addTeamMember({ orgId, teamId: selectedId, userId: newMemberId })
    );
    setSubmitting(false);
    if (addTeamMember.fulfilled.match(result)) {
      setNewMemberId('');
      setAddMemberOpen(false);
    }
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
          description={`Manage the teams in ${currentOrg?.name ?? 'this organization'}`}
          actions={can(ACTIONS.CREATE_TEAM) ? (
            <Button onClick={openCreate} className="h-9 rounded-lg px-3.5">
              <Plus className="mr-2 h-4 w-4" strokeWidth={1.9} />
              <span className="hidden sm:inline">New team</span>
              <span className="sm:hidden">New</span>
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
            {/* --- team list ------------------------------------------------- */}
            <Card className="flex min-h-[24rem] flex-col overflow-hidden rounded-xl border-border/80 bg-card shadow-none lg:min-h-0">
              <CardHeader className="shrink-0 border-b border-border/70 px-4 py-3.5 sm:px-5">
                <div className="flex items-center gap-2.5">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-muted/45 text-ink-600">
                    <Network className="h-4 w-4" strokeWidth={1.8} />
                  </span>
                  <div>
                    <CardTitle className="font-display text-sm font-bold">Teams</CardTitle>
                    <CardDescription className="mt-0.5 text-[11px]">Buckets that group your forms.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto p-2">
                {isLoading && teams.length === 0 ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
                ) : teams.length === 0 ? (
                  <div className="px-4 py-10 text-center text-xs font-medium text-muted-foreground">No teams yet.</div>
                ) : (
                  <div className="space-y-1">
                    {teams.map((team) => {
                      const isSelected = selectedId === team.id;
                      return (
                        <div key={team.id} className="group/node flex items-center gap-1 pr-1">
                          <button
                            type="button"
                            onClick={() => setSelectedId(team.id)}
                            className={`flex h-10 flex-1 items-center gap-2.5 rounded-lg border px-2.5 text-left transition-colors ${
                              isSelected
                                ? 'border-primary/20 bg-primary/[0.045]'
                                : 'border-transparent hover:border-border hover:bg-muted/35'
                            }`}
                          >
                            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md ${isSelected ? 'bg-primary/[0.09] text-primary' : 'bg-muted text-ink-500'}`}>
                              <Users className="h-3.5 w-3.5" strokeWidth={1.8} />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-foreground">
                              {team.name}
                              {team.isDefault && <span className="ml-1.5 text-[10px] font-medium text-muted-foreground">· default</span>}
                            </span>
                            <span className="shrink-0 text-[10px] font-medium text-muted-foreground">
                              {team._count?.members ?? 0} member{(team._count?.members ?? 0) === 1 ? '' : 's'}
                            </span>
                          </button>
                          {can(ACTIONS.DELETE_TEAM) && !team.isDefault && (
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
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* --- team detail ---------------------------------------------- */}
            <Card className="flex min-h-[24rem] flex-col overflow-hidden rounded-xl border-border/80 bg-card shadow-none lg:min-h-0">
              <CardHeader className="shrink-0 border-b border-border/70 px-4 py-3.5 sm:px-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <CardTitle className="font-display text-base font-bold">{currentTeam?.name ?? 'Select a team'}</CardTitle>
                    <CardDescription className="mt-0.5 text-[11px]">
                      {currentTeam?.description || 'Pick a team to see its members.'}
                    </CardDescription>
                  </div>
                  {currentTeam && can(ACTIONS.ADD_TEAM_MEMBER) && (
                    <Button size="sm" onClick={() => setAddMemberOpen(true)} className="h-8 shrink-0 rounded-md px-2.5">
                      <UserPlus className="mr-1.5 h-3.5 w-3.5" strokeWidth={1.9} />
                      <span className="hidden sm:inline">Add member</span>
                      <span className="sm:hidden">Add</span>
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
                {!currentTeam ? (
                  <div className="flex h-full items-center justify-center py-12 text-center">
                    <p className="text-xs font-medium text-muted-foreground">Select a team to manage its members.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="mb-2 flex items-center justify-between">
                      <h3 className="font-display text-xs font-bold text-foreground">Team members</h3>
                      <span className="text-[10px] font-medium text-muted-foreground">{currentTeam.members.length} in this team</span>
                    </div>
                    {currentTeam.members.length === 0 ? (
                      <div className="rounded-lg border border-dashed border-border px-4 py-7 text-center">
                        <UserRound className="mx-auto h-5 w-5 text-ink-300" strokeWidth={1.7} />
                        <p className="mt-2 text-xs font-medium text-muted-foreground">No members have been added to this team.</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {currentTeam.members.map((member: TeamMember) => {
                          const label =
                            [member.user.firstName, member.user.lastName].filter(Boolean).join(' ') ||
                            member.user.email;
                          const initial = label.charAt(0).toUpperCase();
                          return (
                            <div key={member.id} className="flex items-center gap-3 rounded-lg border border-border/80 px-3 py-2.5">
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-xs font-bold text-ink-600">{initial}</span>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[13px] font-semibold text-foreground">{label}</p>
                                <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">{member.user.email}</p>
                              </div>
                              {can(ACTIONS.REMOVE_TEAM_MEMBER) && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 rounded-md"
                                  onClick={() => {
                                    if (!orgId) return;
                                    if (!window.confirm(`Remove ${label} from ${currentTeam.name}?`)) return;
                                    dispatch(removeTeamMember({ orgId, teamId: currentTeam.id, userId: member.userId }));
                                  }}
                                  aria-label={`Remove ${label}`}
                                >
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

        {/* --- create team -------------------------------------------------- */}
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogContent onClose={() => setCreateOpen(false)}>
            <DialogHeader className="mb-4">
              <DialogTitle>Create a team</DialogTitle>
              <DialogDescription>
                Teams group your forms. A member's access comes from their organization role.
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

        {/* --- add member --------------------------------------------------- */}
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
