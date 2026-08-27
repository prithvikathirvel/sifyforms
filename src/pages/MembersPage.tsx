import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import {
  fetchMembers,
  fetchInvites,
  inviteMember,
  revokeInvite,
  updateMemberRole,
  removeMember,
  clearMembersError,
} from '../store/membersSlice';
import { usePermissions, ACTIONS, useRoleOptions, roleLabel } from '../hooks/usePermissions';
import { fetchRoles } from '../store/rolesSlice';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Loader2, UserPlus, Trash2, Mail, ShieldCheck } from 'lucide-react';

/**
 * Organization members and invitations.
 *
 * Actions are hidden when the viewer lacks the permission, but the server
 * enforces the same checks - hiding is only to keep the UI honest.
 */
export default function MembersPage() {
  const dispatch = useAppDispatch();
  const currentOrg = useAppSelector((state) => state.org.currentOrg);
  const { members, invites, isLoading, error } = useAppSelector((state) => state.members);
  const { user } = useAppSelector((state) => state.auth);
  const { can } = usePermissions();
  const orgRoleOptions = useRoleOptions('ORG');

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('ORG_MEMBER');
  const [submitting, setSubmitting] = useState(false);

  const orgId = currentOrg?.id;
  const canInvite = can(ACTIONS.INVITE_USER);
  const canAssignRole = can(ACTIONS.ASSIGN_ORG_ROLE);
  const canRemove = can(ACTIONS.REMOVE_USER);

  useEffect(() => {
    if (!orgId) return;
    dispatch(fetchMembers(orgId));
    dispatch(fetchRoles(orgId));
    if (canInvite) dispatch(fetchInvites(orgId));
  }, [dispatch, orgId, canInvite]);

  const pendingInvites = invites.filter((i) => i.inviteStatus === 'PENDING');

  const onInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!orgId) return;
    setSubmitting(true);
    const result = await dispatch(inviteMember({ orgId, email: email.trim(), role }));
    setSubmitting(false);
    if (inviteMember.fulfilled.match(result)) {
      setEmail('');
      setRole('ORG_MEMBER');
      setInviteOpen(false);
    }
  };

  const onRoleChange = (userId: string, nextRole: string) => {
    if (!orgId) return;
    dispatch(updateMemberRole({ orgId, userId, role: nextRole }));
  };

  const onRemove = (userId: string, label: string) => {
    if (!orgId) return;
    if (!window.confirm(`Remove ${label} from this organization?`)) return;
    dispatch(removeMember({ orgId, userId }));
  };

  const displayName = (m: { firstName: string | null; lastName: string | null; email: string }) =>
    [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email;

  return (
    <div className="app-shell flex min-h-screen bg-workspace">
      <Sidebar onCreateForm={() => {}} />
      <main className="min-w-0 flex-1 overflow-y-auto bg-workspace">
        <PageHeader
          title="Members"
          description={`People and invitations in ${currentOrg?.name ?? 'this organization'}`}
          actions={canInvite ? (
            <Button onClick={() => setInviteOpen(true)} className="h-9 rounded-lg px-3.5">
              <UserPlus className="mr-2 h-4 w-4" strokeWidth={1.9} />
              <span className="hidden sm:inline">Invite member</span>
              <span className="sm:hidden">Invite</span>
            </Button>
          ) : undefined}
        />
        <div className="space-y-5 p-4 sm:p-5 lg:p-6">
        {error && (
          <div
            className="flex items-center justify-between gap-3 rounded-md bg-destructive/10 p-3 text-sm text-destructive"
            role="alert"
          >
            <span>{error}</span>
            <button type="button" onClick={() => dispatch(clearMembersError())}>
              Dismiss
            </button>
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Members ({members.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading && members.length === 0 ? (
              <div className="flex justify-center p-6">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((member) => {
                    // The owner must stay an admin, and nobody edits themselves here.
                    const locked = member.isOwner || member.id === user?.id;
                    return (
                      <TableRow key={member.id}>
                        <TableCell className="font-medium">
                          <span className="flex items-center gap-2">
                            {displayName(member)}
                            {member.isOwner && (
                              <span
                                title="Organization owner"
                                className="inline-flex items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
                              >
                                <ShieldCheck className="h-3 w-3" />
                                Owner
                              </span>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className="text-muted-foreground">{member.email}</TableCell>
                        <TableCell>
                          {canAssignRole && !locked ? (
                            <Select
                              value={member.role}
                              options={orgRoleOptions}
                              onChange={(e) => onRoleChange(member.id, e.target.value)}
                            />
                          ) : (
                            roleLabel(member.role)
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {canRemove && !locked && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onRemove(member.id, displayName(member))}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {members.length === 0 && !isLoading && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No members yet.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {canInvite && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5" />
                Pending invitations ({pendingInvites.length})
              </CardTitle>
              <CardDescription>
                Invitations appear in the invitee's account when they sign in.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Sent</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingInvites.map((invite) => (
                    <TableRow key={invite.id}>
                      <TableCell className="font-medium">{invite.email}</TableCell>
                      <TableCell>{roleLabel(invite.role)}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(invite.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            orgId && dispatch(revokeInvite({ orgId, inviteId: invite.id }))
                          }
                        >
                          Revoke
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {pendingInvites.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground">
                        No pending invitations.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}

        <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
          <DialogContent onClose={() => setInviteOpen(false)}>
            <DialogHeader className="mb-4">
              <DialogTitle>Invite a member</DialogTitle>
              <DialogDescription>
                They will see the invitation the next time they sign in.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={onInvite} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="invite-email">Email address</Label>
                <Input
                  id="invite-email"
                  type="email"
                  required
                  placeholder="colleague@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  They do not need an account yet — the invitation waits for their first sign-in.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="invite-role">Role</Label>
                <Select
                  id="invite-role"
                  value={role}
                  options={orgRoleOptions}
                  onChange={(e) => setRole(e.target.value)}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting || !email.trim()}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Send invitation
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
