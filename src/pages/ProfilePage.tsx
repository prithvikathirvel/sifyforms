import { useNavigate } from 'react-router-dom';
import { useAppSelector } from '../hooks/useAppDispatch';
import { roleLabel } from '../hooks/usePermissions';
import Sidebar from '../components/layout/Sidebar';
import { Button } from '../components/ui/button';
import { Building2, Mail, Pencil, ShieldCheck, UserRound } from 'lucide-react';

/**
 * The profile page, as a person's card: who they are at the top, the account's
 * facts and its organizations below — quiet, readable, one screen.
 */

function initialsOf(firstName?: string | null, lastName?: string | null, fallback?: string | null): string {
  const first = (firstName ?? '').trim().charAt(0);
  const last = (lastName ?? '').trim().charAt(0);
  if (first || last) return `${first}${last}`.toUpperCase();
  return (fallback ?? 'U').charAt(0).toUpperCase();
}

/** One fact about the account, as a labelled row. */
function DetailRow({ icon: Icon, label, value }: {
  icon: React.ElementType;
  label: string;
  value?: string | null;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-border/60 py-3 last:border-b-0">
      <span className="flex h-8 w-8 flex-none items-center justify-center rounded-lg bg-muted/70 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[10.5px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className="mt-0.5 truncate text-[13.5px] font-medium text-foreground">{value || '—'}</p>
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
        {/* Hero — the person, at a glance */}
        <div className="border-b border-border/70 bg-card">
          <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-8 sm:flex-row sm:items-center sm:gap-6 sm:px-6 sm:py-10">
            <span className="flex h-16 w-16 flex-none items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-[hsl(var(--brand-to))] text-xl font-bold tracking-tight text-primary-foreground shadow-sm sm:h-20 sm:w-20 sm:text-2xl">
              {initialsOf(user?.firstName, user?.lastName, user?.username ?? user?.email)}
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {[user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.username || 'Your profile'}
              </h1>
              <p className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
                <span className="truncate">{user?.email}</span>
                {currentOrg && (
                  <>
                    <span aria-hidden="true" className="text-border">·</span>
                    <span className="inline-flex items-center gap-1">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" strokeWidth={1.8} />
                      {roleLabel(currentOrg.role)} of {currentOrg.name}
                    </span>
                  </>
                )}
              </p>
            </div>
            <Button
              onClick={() => navigate('/account/edit')}
              className="h-9 flex-none rounded-lg px-3.5"
              variant="outline"
            >
              <Pencil className="mr-2 h-4 w-4" strokeWidth={1.9} />
              <span className="hidden sm:inline">Edit profile</span>
              <span className="sm:hidden">Edit</span>
            </Button>
          </div>
        </div>

        <div className="mx-auto grid w-full max-w-5xl items-start gap-5 p-4 sm:p-6 lg:grid-cols-[1fr_1.1fr]">
          {/* Account facts */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
              <UserRound className="h-4 w-4 text-primary" strokeWidth={1.8} />
              Account
            </h2>
            <div className="mt-3">
              <DetailRow icon={UserRound} label="First name" value={user?.firstName} />
              <DetailRow icon={UserRound} label="Last name" value={user?.lastName} />
              <DetailRow icon={UserRound} label="Username" value={user?.username} />
              <DetailRow icon={Mail} label="Email address" value={user?.email} />
            </div>
          </section>

          {/* Organizations */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6">
            <h2 className="flex items-center gap-2 text-[13px] font-bold uppercase tracking-wider text-muted-foreground">
              <Building2 className="h-4 w-4 text-primary" strokeWidth={1.8} />
              Organizations
              <span className="ml-auto text-[11px] font-semibold normal-case tracking-normal text-muted-foreground/70">
                {organizations.length}
              </span>
            </h2>
            <div className="mt-3 space-y-2">
              {organizations.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs font-medium text-muted-foreground">
                  You are not a member of an organization yet.
                </div>
              ) : (
                organizations.map((org) => (
                  <div
                    key={org.id}
                    className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 ${
                      org.id === currentOrg?.id ? 'border-primary/40 bg-accent/60' : 'border-border/80'
                    }`}
                  >
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-muted/70 text-[13px] font-bold text-primary">
                      {org.name?.charAt(0).toUpperCase() ?? '?'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-[13.5px] font-semibold text-foreground">{org.name}</p>
                        {org.id === currentOrg?.id && (
                          <span className="shrink-0 rounded-full border border-primary/15 bg-primary/[0.06] px-2 py-0.5 text-[10px] font-semibold text-primary">
                            Current
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11.5px] font-medium text-muted-foreground">{roleLabel(org.role)}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
