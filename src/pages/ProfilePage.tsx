import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppDispatch';
import { roleLabel } from '../hooks/usePermissions';
import Sidebar from '../components/layout/Sidebar';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Pencil, User, Building2 } from 'lucide-react';

/**
 * Your account.
 *
 * Deliberately not behind a permission: these are the person's own details, and
 * every member needs them. Organization settings are separate and gated - the
 * two used to share one page, which left non-admins unable to reach their own
 * profile at all.
 */

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <p className="mb-1 text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value || '—'}</p>
    </div>
  );
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const { user } = useAppSelector((state) => state.auth);
  const { currentOrg, organizations } = useAppSelector((state) => state.org);

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar onCreateForm={() => {}} />

      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-2xl space-y-6 p-6 lg:p-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-xl font-semibold text-primary-foreground">
                {user?.name?.charAt(0).toUpperCase() ?? 'U'}
              </span>
              <div className="min-w-0">
                <h1 className="truncate text-2xl font-bold">{user?.name || 'Your profile'}</h1>
                <p className="truncate text-muted-foreground">{user?.email}</p>
              </div>
            </div>
            <Button onClick={() => navigate('/account/edit')}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit profile
            </Button>
          </div>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <User className="h-4 w-4 text-primary" />
                Details
              </CardTitle>
              <CardDescription>Change these with Edit profile.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Field label="First name" value={user?.firstName} />
              <Field label="Last name" value={user?.lastName} />
              <Field label="Username" value={user?.username} />
              <Field label="Email" value={user?.email} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-primary" />
                Organizations
              </CardTitle>
              <CardDescription>
                Where you belong, and the role you hold in each.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {organizations.length === 0 ? (
                <p className="text-sm text-muted-foreground">Not a member of any organization.</p>
              ) : (
                organizations.map((org) => (
                  <div
                    key={org.id}
                    className="flex items-center justify-between gap-3 rounded-md border p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {org.name}
                        {org.id === currentOrg?.id && (
                          <span className="ml-2 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary">
                            Current
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">{roleLabel(org.role)}</p>
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
