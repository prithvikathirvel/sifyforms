import { useState, useEffect } from 'react';
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
  Loader2,
  Building2,
  Mail,
  Check,
  X,
  ArrowRight,
  Plus,
} from 'lucide-react';

/**
 * Organization chooser.
 *
 * A user arriving here may have pending invitations, existing memberships, both,
 * or neither. All three are offered on one screen rather than forcing everyone
 * through organization creation.
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

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OrgFormData>({
    resolver: zodResolver(orgSchema),
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

  const [choseOrg, setChoseOrg] = useState(false);

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
    // Same reset the switcher does: teams, members and cached permissions all
    // belong to the organization being left.
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
          const joined = orgs.payload.find(
            (o: Organization) => o.id === (result.payload as any)?.org?.id
          );
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

  if (!hasLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted/50 px-4 py-8">
      <div className="w-full max-w-lg space-y-4">
        <div className="flex items-center justify-center space-x-2">
          <Logo size="lg" />
        </div>

        {displayError && (
          <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-md">
            {displayError}
          </div>
        )}

        {/* --- pending invitations --------------------------------------- */}
        {incomingInvites.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Mail className="h-5 w-5 text-primary" />
                Pending invitations
              </CardTitle>
              <CardDescription>
                You have been invited to join {incomingInvites.length}{' '}
                {incomingInvites.length === 1 ? 'organization' : 'organizations'}.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {incomingInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between gap-3 rounded-md border p-3"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{invite.org.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Invited as {roleLabel(invite.role)}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Button
                      size="sm"
                      onClick={() => onAccept(invite.id)}
                      disabled={busyInviteId === invite.id}
                    >
                      {busyInviteId === invite.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      <span className="ml-1">Accept</span>
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onDecline(invite.id)}
                      disabled={busyInviteId === invite.id}
                    >
                      <X className="h-4 w-4" />
                      <span className="ml-1">Decline</span>
                    </Button>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* --- organizations already joined -------------------------------- */}
        {organizations.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Building2 className="h-5 w-5 text-primary" />
                Your organizations
              </CardTitle>
              <CardDescription>Choose one to continue.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {organizations.map((org) => (
                <button
                  key={org.id}
                  type="button"
                  onClick={() => enterOrg(org)}
                  className="flex w-full items-center justify-between gap-3 rounded-md border p-3 text-left transition-colors hover:bg-accent"
                >
                  <div className="min-w-0">
                    <p className="font-medium truncate">{org.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {roleLabel(org.role)}
                      {org._count ? ` · ${org._count.forms} forms` : ''}
                    </p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                </button>
              ))}
            </CardContent>
          </Card>
        )}

        {/* --- create a new organization ----------------------------------- */}
        {!showCreate ? (
          <Button variant="outline" className="w-full" onClick={() => setShowCreate(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create a new organization
          </Button>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                {hasChoices ? 'Create a new organization' : `Welcome, ${user?.name || 'there'}!`}
              </CardTitle>
              <CardDescription>
                You will be its administrator and can invite others afterwards.
              </CardDescription>
            </CardHeader>
            <form onSubmit={handleSubmit(onSubmit)}>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Organization Name</Label>
                  <Input id="name" type="text" placeholder="Acme Inc." {...register('name')} />
                  {errors.name && (
                    <p className="text-sm text-destructive">{errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="slug">Organization URL</Label>
                  <div className="flex items-center">
                    <span className="text-sm text-muted-foreground mr-2">sifyforms.ai/</span>
                    <Input id="slug" type="text" placeholder="acme-inc" {...register('slug')} />
                  </div>
                  {errors.slug && (
                    <p className="text-sm text-destructive">{errors.slug.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="industry">Industry (Optional)</Label>
                  <Select
                    id="industry"
                    options={industries}
                    placeholder="Select an industry"
                    {...register('industry')}
                  />
                </div>
              </CardContent>
              <CardFooter className="gap-2">
                {hasChoices && (
                  <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>
                    Cancel
                  </Button>
                )}
                <Button type="submit" className="flex-1" disabled={isLoading || invitesLoading}>
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Organization'
                  )}
                </Button>
              </CardFooter>
            </form>
          </Card>
        )}
      </div>
    </div>
  );
}
