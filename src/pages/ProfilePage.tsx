import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppDispatch';
import { roleLabel } from '../hooks/usePermissions';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Building2, Pencil, UserRound } from 'lucide-react';
import { Label } from '../components/ui/label';

/**
 * Personal account details, in the same shape as every other settings page:
 * compact header, one column of quiet cards. Read-only by design — changes
 * happen on the Edit page, so nothing here can half-save.
 */
function DetailField({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-semibold text-muted-foreground">{label}</Label>
      <div className="h-10 truncate rounded-lg border border-input bg-muted/30 px-3 py-2.5 text-[13px] font-medium text-foreground">
        {value || '—'}
      </div>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { currentOrg, organizations } = useAppSelector((state) => state.org);

  return (
    <div className="app-shell flex h-screen bg-workspace">
      <Sidebar />

      <main className="min-w-0 flex-1 overflow-y-auto bg-workspace">
        <PageHeader
          title="Profile"
          description={user?.email || 'Your personal account information'}
          actions={(
            <Button onClick={() => navigate('/account/edit')} className="h-9 rounded-lg px-3.5">
              <Pencil className="mr-2 h-4 w-4" strokeWidth={1.9} />
              <span className="hidden sm:inline">Edit profile</span>
              <span className="sm:hidden">Edit</span>
            </Button>
          )}
        />
        <div className="mx-auto max-w-3xl space-y-5 p-4 sm:p-5 lg:p-6">
          {/* --- personal ---------------------------------------------------- */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <UserRound className="h-4 w-4 text-primary" />
                Personal details
              </CardTitle>
              <CardDescription>The profile information associated with your account.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-2">
                <DetailField label="First name" value={user?.firstName} />
                <DetailField label="Last name" value={user?.lastName} />
                <DetailField label="Username" value={user?.username} />
                <DetailField label="Email address" value={user?.email} />
              </div>
            </CardContent>
          </Card>

          {/* --- organizations ----------------------------------------------- */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-primary" />
                Organizations
              </CardTitle>
              <CardDescription>Your workspaces and role in each one.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {organizations.length === 0 ? (
                <div className="rounded-md border border-dashed border-border p-5 text-center text-xs font-medium text-muted-foreground">
                  You are not a member of an organization yet.
                </div>
              ) : (
                organizations.map((org) => (
                  <div
                    key={org.id}
                    className={`flex items-center gap-3 rounded-lg border px-3.5 py-3 ${
                      org.id === currentOrg?.id ? 'border-primary/30 bg-accent/50' : 'border-border/80'
                    }`}
                  >
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-[13px] font-bold text-primary">
                      {org.name?.charAt(0).toUpperCase() ?? '?'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-[13px] font-semibold text-foreground">{org.name}</p>
                        {org.id === currentOrg?.id && (
                          <span className="shrink-0 rounded-full border border-primary/15 bg-primary/[0.06] px-2 py-0.5 text-[10px] font-semibold text-primary">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] font-medium text-muted-foreground">{roleLabel(org.role)}</p>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
