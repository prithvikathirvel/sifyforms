import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { createOrganization, fetchOrganizations, setCurrentOrg } from '../store/orgSlice';
import { fetchMyInvites, acceptInvite, rejectInvite, resetMembers } from '../store/membersSlice';
import { resetTeams } from '../store/teamsSlice';
import { Button } from '../components/ui/button';
import { Logo } from '../components/ui/Logo';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '../components/ui/card';
import { roleLabel } from '../hooks/usePermissions';
import type { Organization } from '../types';
import { cn } from '../lib/utils';
import {
  ArrowRight,
  Building2,
  Check,
  CircleAlert,
  Loader2,
  Mail,
  Plus,
  X,
} from 'lucide-react';

/**
 * Organization chooser.
 *
 * A user arriving here may have pending invitations, existing memberships, both,
 * or neither. All three are offered without changing the underlying org flow.
 */
const orgSchema = z.object({
  name: z.string().min(3, 'Name must be at least 3 characters').max(100),
  slug: z
    .string()
    .min(3, 'Slug must be at least 3 characters')
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  industry: z.string().optional(),
});

type OrgFormData = z.infer<typeof orgSchema>;

const industries = [
  { label: 'Technology', value: 'technology' },
  { label: 'Healthcare', value: 'healthcare' },
  { label: 'Finance', value: 'finance' },
  { label: 'Education', value: 'education' },
  { label: 'Retail', value: 'retail' },
  { label: 'Manufacturing', value: 'manufacturing' },
  { label: 'Non-profit', value: 'nonprofit' },
  { label: 'Other', value: 'other' },
];

export default function OrgSetupPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isLoading, error, currentOrg, organizations } = useAppSelector((state) => state.org);
  const { incomingInvites, isLoading: invitesLoading, error: membersError } = useAppSelector(
    (state) => state.members
  );
  const { user } = useAppSelector((state) => state.auth);

  const [searchParams] = useSearchParams();
  const [showCreate, setShowCreate] = useState(searchParams.get('create') === '1');
  const [busyInviteId, setBusyInviteId] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [choseOrg, setChoseOrg] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OrgFormData>({
    resolver: zodResolver(orgSchema),
    mode: 'onBlur',
    reValidateMode: 'onChange',
    defaultValues: { name: '', slug: '', industry: '' },
  });

  const name = watch('name');

  useEffect(() => {
    if (name) {
      setValue(
        'slug',
        name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '')
          .substring(0, 50)
      );
    }
  }, [name, setValue]);

  useEffect(() => {
    Promise.all([dispatch(fetchMyInvites()), dispatch(fetchOrganizations())]).finally(() =>
      setHasLoaded(true)
    );
  }, [dispatch]);

  useEffect(() => {
    if (currentOrg && choseOrg) navigate('/dashboard');
  }, [currentOrg, choseOrg, navigate]);

  // Nothing to choose between and nothing pending: go straight to creation.
  useEffect(() => {
    if (hasLoaded && organizations.length === 0 && incomingInvites.length === 0) {
      setShowCreate(true);
    }
  }, [hasLoaded, organizations.length, incomingInvites.length]);

  const enterOrg = (org: Organization) => {
    setChoseOrg(true);
    dispatch(resetTeams());
    dispatch(resetMembers());
    dispatch(setCurrentOrg(org));
    navigate('/dashboard');
  };

  const onAccept = async (inviteId: string) => {
    setBusyInviteId(inviteId);
    try {
      const result = await dispatch(acceptInvite(inviteId));
      if (acceptInvite.fulfilled.match(result)) {
        const orgs = await dispatch(fetchOrganizations());
        if (fetchOrganizations.fulfilled.match(orgs)) {
          const payload = result.payload as { org?: { id?: string } };
          const joined = orgs.payload.find((org: Organization) => org.id === payload.org?.id);
          if (joined) enterOrg(joined);
        }
      }
    } finally {
      setBusyInviteId(null);
    }
  };

  const onDecline = async (inviteId: string) => {
    setBusyInviteId(inviteId);
    try {
      await dispatch(rejectInvite(inviteId));
    } finally {
      setBusyInviteId(null);
    }
  };

  const onSubmit = (data: OrgFormData) => {
    setChoseOrg(true);
    dispatch(createOrganization(data));
  };

  const displayError = error || membersError;
  const hasChoices = organizations.length > 0 || incomingInvites.length > 0;
  const hasBothChoiceTypes = organizations.length > 0 && incomingInvites.length > 0;

  if (!hasLoaded) {
    return (
      <div className="public-shell flex min-h-[100dvh] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo variant="icon" size="lg" />
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-xs font-medium text-muted-foreground">Loading your workspaces…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-shell flex min-h-[100dvh] flex-col bg-muted/20 lg:h-[100dvh] lg:overflow-hidden">
      <header className="shrink-0 border-b border-border/70 bg-background">
        <div className="flex h-14 w-full items-center justify-between px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
          <Logo size="sm" />
          <div className="flex min-w-0 items-center gap-2.5 border-l border-border pl-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/[0.08] text-xs font-bold text-primary">
              {(user?.name || user?.email || 'U').charAt(0).toUpperCase()}
            </span>
            <div className="hidden min-w-0 text-left sm:block">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Signed in as</p>
              <p className="mt-0.5 max-w-52 truncate text-xs font-semibold text-foreground">
                {user?.name || user?.email || 'Your account'}
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="flex min-h-0 w-full flex-1 flex-col px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12">
        <div className="flex shrink-0 flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between lg:py-5">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/[0.055] text-primary">
              {showCreate ? <Plus className="h-[18px] w-[18px]" /> : <Building2 className="h-[18px] w-[18px]" />}
            </span>
            <div className="min-w-0 space-y-1.5">
              <h1 className="font-display text-xl font-bold leading-tight tracking-tight text-foreground sm:text-2xl">
                {showCreate ? 'Create your organization' : 'Choose your workspace'}
              </h1>
              <p className="text-xs font-medium leading-5 text-muted-foreground sm:text-[13px]">
                {showCreate
                  ? 'Set up the workspace where your team will create and manage forms.'
                  : 'Continue to an organization or respond to a pending invitation.'}
              </p>
            </div>
          </div>

          {!showCreate && (
            <Button className="h-9 shrink-0 rounded-lg px-4" onClick={() => setShowCreate(true)}>
              <Plus className="mr-2 h-4 w-4" />
              New organization
            </Button>
          )}
        </div>

        {displayError && (
          <div role="alert" className="mb-3 flex shrink-0 items-start gap-2.5 rounded-lg border border-destructive/20 bg-destructive/[0.05] px-3.5 py-3 text-xs font-medium text-destructive">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{displayError}</span>
          </div>
        )}

        <div className="min-h-0 flex-1 pb-4 lg:pb-5">
          {showCreate ? (
            <div className="flex h-full items-start justify-center lg:items-center">
              <Card className="w-full max-w-2xl rounded-2xl border-border bg-card shadow-xl shadow-foreground/[0.045]">
                <CardHeader className="border-b border-border/70 px-5 py-4 sm:px-6">
                  <CardTitle className="font-display text-base font-bold">Organization details</CardTitle>
                  <CardDescription className="text-xs leading-5">
                    You will be the administrator and can invite teammates after setup.
                  </CardDescription>
                </CardHeader>

                <form onSubmit={handleSubmit(onSubmit)} noValidate>
                  <CardContent className="grid gap-4 px-5 py-5 sm:grid-cols-2 sm:px-6">
                    <div className="space-y-1.5">
                      <Label htmlFor="name">Organization name</Label>
                      <Input
                        id="name"
                        required
                        type="text"
                        autoComplete="organization"
                        placeholder="Acme Inc."
                        aria-invalid={Boolean(errors.name)}
                        aria-describedby={errors.name ? 'org-name-error' : undefined}
                        {...register('name')}
                      />
                      {errors.name && <p id="org-name-error" role="alert" className="text-xs font-medium text-destructive">{errors.name.message}</p>}
                    </div>

                    <div className="space-y-1.5">
                      <Label htmlFor="industry">Industry <span className="font-normal text-muted-foreground">(optional)</span></Label>
                      <Select
                        id="industry"
                        options={industries}
                        placeholder="Select an industry"
                        {...register('industry')}
                      />
                    </div>

                    <div className="space-y-1.5 sm:col-span-2">
                      <Label htmlFor="slug">Organization URL</Label>
                      <div className="flex min-w-0 items-center overflow-hidden rounded-lg border border-input bg-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2">
                        <span className="shrink-0 border-r border-border bg-muted/40 px-3 text-xs font-medium text-muted-foreground">sifyforms.ai/</span>
                        <Input
                          id="slug"
                          required
                          type="text"
                          autoComplete="off"
                          placeholder="acme-inc"
                          className="min-w-0 rounded-none border-0 focus-visible:ring-0 focus-visible:ring-offset-0"
                          aria-invalid={Boolean(errors.slug)}
                          aria-describedby={errors.slug ? 'org-slug-error' : 'org-slug-hint'}
                          {...register('slug')}
                        />
                      </div>
                      {errors.slug ? (
                        <p id="org-slug-error" role="alert" className="text-xs font-medium text-destructive">{errors.slug.message}</p>
                      ) : (
                        <p id="org-slug-hint" className="text-[11px] font-medium text-muted-foreground">Lowercase letters, numbers, and hyphens only.</p>
                      )}
                    </div>
                  </CardContent>

                  <CardFooter className="justify-end gap-2 border-t border-border/70 bg-muted/20 px-5 py-4 sm:px-6">
                    {hasChoices && (
                      <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                        Cancel
                      </Button>
                    )}
                    <Button type="submit" className="min-w-40" disabled={isLoading || invitesLoading}>
                      {isLoading ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating…
                        </>
                      ) : (
                        <>
                          Create organization
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </form>
              </Card>
            </div>
          ) : (
            <div className={cn('grid h-full min-h-0 content-start gap-4', hasBothChoiceTypes && 'lg:grid-cols-2')}>
              {incomingInvites.length > 0 && (
                <Card className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-2xl border-border shadow-sm">
                  <CardHeader className="shrink-0 border-b border-border/70 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/[0.06] text-primary">
                          <Mail className="h-4 w-4" />
                        </span>
                        <div>
                          <CardTitle className="font-display text-sm font-bold">Pending invitations</CardTitle>
                          <CardDescription className="mt-0.5 text-xs">Review organizations waiting for you.</CardDescription>
                        </div>
                      </div>
                      <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {incomingInvites.length}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3 sm:px-4">
                    {incomingInvites.map((invite) => (
                      <div key={invite.id} className="flex flex-col gap-3 rounded-xl border border-border p-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-foreground">{invite.org.name}</p>
                          <p className="mt-0.5 text-xs font-medium text-muted-foreground">Invited as {roleLabel(invite.role)}</p>
                        </div>
                        <div className="flex shrink-0 gap-2">
                          <Button size="sm" onClick={() => onAccept(invite.id)} disabled={busyInviteId === invite.id}>
                            {busyInviteId === invite.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                            <span className="ml-1.5">Accept</span>
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => onDecline(invite.id)} disabled={busyInviteId === invite.id}>
                            <X className="h-4 w-4" />
                            <span className="ml-1.5">Decline</span>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              {organizations.length > 0 && (
                <Card className="flex max-h-full min-h-0 flex-col overflow-hidden rounded-2xl border-border shadow-sm">
                  <CardHeader className="shrink-0 border-b border-border/70 px-5 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/[0.06] text-primary">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <div>
                          <CardTitle className="font-display text-sm font-bold">Your organizations</CardTitle>
                          <CardDescription className="mt-0.5 text-xs">Select a workspace to continue.</CardDescription>
                        </div>
                      </div>
                      <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                        {organizations.length}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3 sm:px-4">
                    {organizations.map((org) => (
                      <button
                        key={org.id}
                        type="button"
                        onClick={() => enterOrg(org)}
                        className="group flex w-full items-center gap-3 rounded-xl border border-border p-3 text-left transition-all hover:border-primary/25 hover:bg-primary/[0.025] focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40 text-primary">
                          <Building2 className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-semibold text-foreground">{org.name}</span>
                          <span className="mt-0.5 block text-xs font-medium text-muted-foreground">
                            {roleLabel(org.role)}{org._count ? ` · ${org._count.forms} forms` : ''}
                          </span>
                        </span>
                        <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                      </button>
                    ))}
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
