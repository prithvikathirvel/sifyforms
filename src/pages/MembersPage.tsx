import { useEffect, useState, type ReactNode } from 'react';
import { Loader2, Mail, ShieldCheck, Trash2, UserPlus, Users } from 'lucide-react';
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
import type { OrgInvite, OrgMember } from '../types';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { DataTable, type DataTableColumn } from '../components/ui/data-table';
import { DropdownSelect } from '../components/ui/dropdown-select';
import { Pagination } from '../components/ui/pagination';
import { Tooltip } from '../components/ui/tooltip';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';

const PAGE_SIZE = 10;

function displayName(member: { firstName: string | null; lastName: string | null; email: string }) {
  return [member.firstName, member.lastName].filter(Boolean).join(' ') || member.email;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function SectionHeader({ id, icon, title, description, count }: { id: string; icon: ReactNode; title: string; description: string; count: number }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-2.5">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-card text-ink-600">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 id={id} className="font-display text-sm font-bold text-foreground">{title}</h2>
          <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{description}</p>
        </div>
      </div>
      <span className="shrink-0 rounded-full border border-border bg-card px-2.5 py-1 text-[10px] font-semibold tabular-nums text-ink-600">
        {count}
      </span>
    </div>
  );
}

/** Organization members and invitations, presented as separate paginated tables. */
export default function MembersPage() {
  const dispatch = useAppDispatch();
  const currentOrg = useAppSelector((state) => state.org.currentOrg);
  const { members, invites, isLoading, error } = useAppSelector((state) => state.members);
  const { user } = useAppSelector((state) => state.auth);
  const { can } = usePermissions();
  const orgRoleOptions = useRoleOptions();

  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('CREATOR');
  const [submitting, setSubmitting] = useState(false);
  const [membersPage, setMembersPage] = useState(1);
  const [invitesPage, setInvitesPage] = useState(1);

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

  const pendingInvites = invites.filter((invite) => invite.inviteStatus === 'PENDING');
  const memberTotalPages = Math.max(1, Math.ceil(members.length / PAGE_SIZE));
  const safeMembersPage = Math.min(membersPage, memberTotalPages);
  const visibleMembers = members.slice((safeMembersPage - 1) * PAGE_SIZE, safeMembersPage * PAGE_SIZE);
  const inviteTotalPages = Math.max(1, Math.ceil(pendingInvites.length / PAGE_SIZE));
  const safeInvitesPage = Math.min(invitesPage, inviteTotalPages);
  const visibleInvites = pendingInvites.slice((safeInvitesPage - 1) * PAGE_SIZE, safeInvitesPage * PAGE_SIZE);

  const onInvite = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!orgId) return;
    setSubmitting(true);
    const result = await dispatch(inviteMember({ orgId, email: email.trim(), role }));
    setSubmitting(false);
    if (inviteMember.fulfilled.match(result)) {
      setEmail('');
      setRole('CREATOR');
      setInvitesPage(1);
      setInviteOpen(false);
    }
  };

  const onRoleChange = (userId: string, nextRole: string) => {
    if (orgId) dispatch(updateMemberRole({ orgId, userId, role: nextRole }));
  };

  const onRemove = (userId: string, label: string) => {
    if (!orgId || !window.confirm(`Remove ${label} from this organization?`)) return;
    dispatch(removeMember({ orgId, userId }));
  };

  const memberColumns: DataTableColumn<OrgMember>[] = [
    {
      id: 'person',
      header: 'Member',
      headerClassName: 'min-w-44 sm:min-w-52',
      cellClassName: 'min-w-44 sm:min-w-52',
      cell: (member) => {
        const name = displayName(member);
        const initial = name.charAt(0).toUpperCase();
        return (
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.07] text-[11px] font-bold text-primary">{initial}</span>
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="max-w-52 truncate text-[12px] font-semibold text-foreground">{name}</span>
                {member.isOwner && (
                  <span className="inline-flex items-center gap-1 rounded-full border border-primary/10 bg-primary/[0.05] px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-primary">
                    <ShieldCheck className="h-2.5 w-2.5" /> Owner
                  </span>
                )}
                {member.id === user?.id && !member.isOwner && (
                  <span className="rounded-full border border-border bg-ink-50 px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-wider text-muted-foreground">You</span>
                )}
              </div>
              <span className="mt-0.5 block max-w-56 truncate text-[9px] font-medium text-muted-foreground md:hidden">{member.email}</span>
            </div>
          </div>
        );
      },
    },
    {
      id: 'email',
      header: 'Email',
      headerClassName: 'hidden md:table-cell',
      cellClassName: 'hidden md:table-cell',
      cell: (member) => <span className="text-[11px] font-medium text-muted-foreground">{member.email}</span>,
    },
    {
      id: 'role',
      header: 'Organization role',
      headerClassName: 'min-w-28 sm:min-w-36',
      cellClassName: 'min-w-28 sm:min-w-36',
      cell: (member) => {
        const locked = member.isOwner || member.id === user?.id;
        const availableRoles = orgRoleOptions.some((option) => option.value === member.role)
          ? orgRoleOptions
          : [{ value: member.role, label: `${roleLabel(member.role)} (current)` }, ...orgRoleOptions];
        return canAssignRole && !locked ? (
          <DropdownSelect
            value={member.role}
            options={availableRoles}
            onValueChange={(nextRole) => onRoleChange(member.id, nextRole)}
            ariaLabel={`Role for ${displayName(member)}`}
            className="w-28 sm:w-36"
          />
        ) : (
          <span className="inline-flex rounded-md border border-border bg-ink-50 px-2 py-1 text-[10px] font-semibold text-ink-600">{roleLabel(member.role)}</span>
        );
      },
    },
    {
      id: 'joined',
      header: 'Joined',
      headerClassName: 'hidden lg:table-cell',
      cellClassName: 'hidden whitespace-nowrap lg:table-cell',
      cell: (member) => <span className="text-[11px] font-medium text-muted-foreground">{formatDate(member.joinedAt)}</span>,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      headerClassName: 'w-16 text-right',
      cellClassName: 'w-16 text-right',
      cell: (member) => {
        const locked = member.isOwner || member.id === user?.id;
        return canRemove && !locked ? (
          <Tooltip content="Remove member" side="left" tone="dark">
            <Button type="button" variant="ghost" size="icon" onClick={() => onRemove(member.id, displayName(member))} aria-label={`Remove ${displayName(member)}`} className="h-8 w-8 rounded-md text-muted-foreground hover:bg-destructive/[0.06] hover:text-destructive">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </Tooltip>
        ) : <span className="text-muted-foreground">—</span>;
      },
    },
  ];

  const inviteColumns: DataTableColumn<OrgInvite>[] = [
    {
      id: 'email',
      header: 'Invitee',
      headerClassName: 'min-w-48 sm:min-w-60',
      cellClassName: 'min-w-48 sm:min-w-60',
      cell: (invite) => (
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-ink-50 text-ink-500"><Mail className="h-3.5 w-3.5" /></span>
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-semibold text-foreground">{invite.email}</span>
            <span className="mt-0.5 block text-[9px] font-medium text-muted-foreground sm:hidden">{roleLabel(invite.role)}</span>
          </span>
        </div>
      ),
    },
    {
      id: 'role',
      header: 'Role after acceptance',
      headerClassName: 'hidden sm:table-cell',
      cellClassName: 'hidden sm:table-cell',
      cell: (invite) => <span className="inline-flex rounded-md border border-border bg-ink-50 px-2 py-1 text-[10px] font-semibold text-ink-600">{roleLabel(invite.role)}</span>,
    },
    {
      id: 'sent',
      header: 'Sent',
      headerClassName: 'hidden sm:table-cell',
      cellClassName: 'hidden whitespace-nowrap sm:table-cell',
      cell: (invite) => <span className="text-[11px] font-medium text-muted-foreground">{formatDate(invite.createdAt)}</span>,
    },
    {
      id: 'actions',
      header: <span className="sr-only">Actions</span>,
      headerClassName: 'w-20 text-right',
      cellClassName: 'w-20 text-right',
      cell: (invite) => (
        <Button type="button" variant="ghost" size="sm" onClick={() => orgId && dispatch(revokeInvite({ orgId, inviteId: invite.id }))} className="h-8 rounded-md px-2.5 text-[10px] text-destructive hover:bg-destructive/[0.06] hover:text-destructive">
          Revoke
        </Button>
      ),
    },
  ];

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

        <div className="space-y-7 p-4 sm:p-5 lg:p-6">
          {error && (
            <div className="flex items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/[0.05] px-3.5 py-3 text-xs font-medium text-destructive" role="alert">
              <span>{error}</span>
              <button type="button" onClick={() => dispatch(clearMembersError())} className="font-semibold hover:underline">Dismiss</button>
            </div>
          )}

          <section className="space-y-3" aria-labelledby="members-table-title">
            <SectionHeader id="members-table-title" icon={<Users className="h-4 w-4" strokeWidth={1.8} />} title="Organization members" description="People who currently have access to this workspace." count={members.length} />
            {isLoading && members.length === 0 ? (
              <div className="flex min-h-36 items-center justify-center rounded-xl border border-border bg-card"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            ) : (
              <DataTable data={visibleMembers} columns={memberColumns} getRowId={(member) => member.id} ariaLabel="Organization members" emptyState="No members yet." />
            )}
            <Pagination page={safeMembersPage} totalPages={memberTotalPages} totalItems={members.length} itemLabel="members" onPageChange={setMembersPage} />
          </section>

          {canInvite && (
            <section className="space-y-3" aria-labelledby="pending-invitations-title">
              <SectionHeader id="pending-invitations-title" icon={<Mail className="h-4 w-4" strokeWidth={1.8} />} title="Pending invitations" description="Invitations waiting for the recipient to respond." count={pendingInvites.length} />
              <DataTable data={visibleInvites} columns={inviteColumns} getRowId={(invite) => invite.id} ariaLabel="Pending invitations" emptyState="No pending invitations." />
              <Pagination page={safeInvitesPage} totalPages={inviteTotalPages} totalItems={pendingInvites.length} itemLabel="invitations" onPageChange={setInvitesPage} />
            </section>
          )}
        </div>
      </main>

      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent onClose={() => setInviteOpen(false)}>
          <DialogHeader className="mb-4">
            <DialogTitle>Invite a member</DialogTitle>
            <DialogDescription>They will see the invitation the next time they sign in.</DialogDescription>
          </DialogHeader>
          <form onSubmit={onInvite} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="invite-email">Email address</Label>
              <Input id="invite-email" type="email" required placeholder="colleague@example.com" value={email} onChange={(event) => setEmail(event.target.value)} />
              <p className="text-xs text-muted-foreground">They do not need an account yet — the invitation waits for their first sign-in.</p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <DropdownSelect value={role} options={orgRoleOptions} onValueChange={setRole} ariaLabel="Organization role for invited member" size="default" />
            </div>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={submitting || !email.trim()}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send invitation
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
