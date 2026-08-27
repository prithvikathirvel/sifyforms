import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppDispatch';
import { roleLabel } from '../hooks/usePermissions';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Building2, Pencil, User } from 'lucide-react';

/** Personal account details, intentionally separate from organization settings. */
function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-xl border border-border/70 bg-muted/25 px-4 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1.5 truncate text-[13px] font-semibold text-foreground">{value || '—'}</p>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { currentOrg, organizations } = useAppSelector((state) => state.org);

  return (
    <div className="app-shell flex h-screen bg-workspace">
      <Sidebar onCreateForm={() => {}} />

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
        <div className="mx-auto w-full max-w-6xl p-4 sm:p-5 lg:p-6">
          <div className="grid items-start gap-5 lg:grid-cols-[1.08fr_0.92fr]">
            <Card className="rounded-2xl border-border shadow-sm">
              <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
                    <User className="h-4 w-4" />
                  </span>
                  <div>
                    <CardTitle className="font-display text-sm font-bold">Personal details</CardTitle>
                    <CardDescription className="mt-1 text-xs">The profile information associated with your account.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="grid grid-cols-1 gap-3 px-5 py-5 sm:grid-cols-2 sm:px-6">
                <Field label="First name" value={user?.firstName} />
                <Field label="Last name" value={user?.lastName} />
                <Field label="Username" value={user?.username} />
                <Field label="Email address" value={user?.email} />
              </CardContent>
            </Card>

            <Card className="rounded-2xl border-border shadow-sm">
              <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
                    <Building2 className="h-4 w-4" />
                  </span>
                  <div>
                    <CardTitle className="font-display text-sm font-bold">Organizations</CardTitle>
                    <CardDescription className="mt-1 text-xs">Your workspaces and role in each one.</CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 px-5 py-5 sm:px-6">
                {organizations.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-border p-5 text-center text-xs font-medium text-muted-foreground">
                    You are not a member of an organization yet.
                  </div>
                ) : (
                  organizations.map((org) => (
                    <div key={org.id} className="flex items-center gap-3 rounded-xl border border-border/80 px-3.5 py-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-primary">
                        <Building2 className="h-4 w-4" />
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
        </div>
      </main>
    </div>
  );
}
