import { useEffect, useRef, useState } from 'react';
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
  /** Once someone edits the URL by hand, stop overwriting it from the name. */
  const [slugEdited, setSlugEdited] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitted },
  } = useForm<OrgFormData>({
    // `onTouched` validates a field once it has been blurred and then on every
    // keystroke. With the previous `onBlur` + `reValidateMode` pairing the
    // re-validation only started after the first submit, so a slug error stayed
    // on screen while the person was busy correcting it.
    mode: 'onTouched',
    resolver: zodResolver(orgSchema),
    defaultValues: { name: '', slug: '', industry: '' },
  });

  const name = watch('name');

  /**
   * Whether a programmatic slug change should re-run validation.
   *
   * Read through a ref so the effect below does not depend on `errors`, which
   * would make it re-run every time validation produced a new error object.
   * The rule: never surface an error the person has not yet earned, but always
   * clear one that is already showing the moment the value becomes valid.
   */
  const revalidateSlug = useRef(false);
  revalidateSlug.current = Boolean(errors.slug) || isSubmitted;

  useEffect(() => {
    if (slugEdited) return;
    const derived = (name ?? '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .substring(0, 50);
    setValue('slug', derived, { shouldValidate: revalidateSlug.current });
  }, [name, slugEdited, setValue]);

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

  /**
   * Registered once so the slug input can both keep react-hook-form's handler
   * and record that the value is now the person's own, not a derivation.
   */
  const slugField = register('slug');

  const displayError = error || membersError;
  const hasChoices = organizations.length > 0 || incomingInvites.length > 0;

  if (!hasLoaded) {
    return (
      <div className="public-shell flex min-h-[100dvh] items-center justify-center bg-muted/20">
        <div className="flex flex-col items-center gap-3 text-center">
          <Logo variant="icon" size="lg" />
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
          <p className="text-xs font-medium text-muted-foreground">Loading your workspaces…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="public-shell min-h-[100dvh] bg-muted/20 px-4 py-6 sm:py-8">
      <main className="mx-auto w-full max-w-xl space-y-4">
        <div className="flex flex-col items-center text-center">
          <Logo size="md" />
          <h1 className="mt-5 font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            Choose your workspace
          </h1>
          <p className="mt-1.5 max-w-md text-xs font-medium leading-5 text-muted-foreground sm:text-[13px]">
            Continue to an organization, review an invitation, or create a new workspace.
          </p>
        </div>

        {displayError && (
          <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-destructive/20 bg-destructive/[0.05] px-3.5 py-3 text-xs font-medium text-destructive">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{displayError}</span>
          </div>
        )}

        {incomingInvites.length > 0 && (
          <Card className="overflow-hidden rounded-xl border-border bg-card shadow-none">
            <CardHeader className="border-b border-border/70 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
                    <Mail className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <div>
                    <CardTitle className="font-display text-sm font-bold">Pending invitations</CardTitle>
                    <CardDescription className="mt-1 text-xs leading-5">
                      You have {incomingInvites.length} pending {incomingInvites.length === 1 ? 'invitation' : 'invitations'}.
                    </CardDescription>
                  </div>
                </div>
                <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {incomingInvites.length}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 px-4 py-4">
              {incomingInvites.map((invite) => (
                <div key={invite.id} className="flex flex-col gap-3 rounded-lg border border-border/80 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
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
          <Card className="overflow-hidden rounded-xl border-border bg-card shadow-none">
            <CardHeader className="border-b border-border/70 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/[0.07] text-primary">
                    <Building2 className="h-4 w-4" strokeWidth={1.9} />
                  </span>
                  <div>
                    <CardTitle className="font-display text-sm font-bold">Your organizations</CardTitle>
                    <CardDescription className="mt-1 text-xs">Choose one to continue.</CardDescription>
                  </div>
                </div>
                <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[10px] font-semibold text-muted-foreground">
                  {organizations.length}
                </span>
              </div>
            </CardHeader>
            <CardContent className="space-y-2 px-4 py-4">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => enterOrg(org)}
                  className="group flex w-full items-center gap-3 rounded-lg border border-border/80 px-3.5 py-3 text-left transition-colors hover:border-primary/20 hover:bg-primary/[0.025]"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted/60 text-primary">
                    <Building2 className="h-4 w-4" strokeWidth={1.9} />
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

        {!showCreate ? (
          <Button variant="outline" className="h-10 w-full rounded-lg bg-background" onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create a new organization
          </Button>
        ) : (
          <Card className="overflow-hidden rounded-xl border-border bg-card shadow-none">
            <CardHeader className="border-b border-border/70 px-5 py-4">
              <CardTitle className="font-display text-sm font-bold">
                {hasChoices ? 'Create a new organization' : `Welcome, ${user?.name || 'there'}!`}
              </CardTitle>
              <CardDescription className="text-xs leading-5">
                You will be its administrator and can invite teammates afterwards.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)} noValidate>
              <CardContent className="space-y-4 px-5 py-5">
                <div className="space-y-1.5">
                  <Label htmlFor="name">Organization name</Label>
                  <Input id="name" required type="text" autoComplete="organization" placeholder="Acme Inc." aria-invalid={Boolean(errors.name)} {...register('name')} />
                  {errors.name && <p role="alert" className="text-xs font-medium text-destructive">{errors.name.message}</p>}
                </div>
                <div className="space-y-1.5">
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
                      aria-describedby={errors.slug ? 'slug-error' : 'slug-hint'}
                      {...slugField}
                      onChange={(event) => {
                        setSlugEdited(true);
                        slugField.onChange(event);
                      }}
                    />
                  </div>
                  {errors.slug ? (
                    <p id="slug-error" role="alert" className="text-xs font-medium text-destructive">{errors.slug.message}</p>
                  ) : (
                    <p id="slug-hint" className="text-[11px] font-medium text-muted-foreground">Lowercase letters, numbers, and hyphens only.</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="industry">Industry <span className="font-normal text-muted-foreground">(optional)</span></Label>
                  <Select id="industry" options={industries} placeholder="Select an industry" {...register('industry')} />
                </div>
              </CardContent>
              <CardFooter className="justify-end gap-2 border-t border-border/70 bg-muted/20 px-5 py-4">
                {hasChoices && (
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
                )}
                <Button type="submit" disabled={isLoading || invitesLoading}>
                  {isLoading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating…</> : 'Create organization'}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}
      </main>
    </div>
  );
}
