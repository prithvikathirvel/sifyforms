import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import { updateOrganization, deleteOrganization, setCurrentOrg } from '../store/orgSlice';
import { usePermissions, ACTIONS } from '../hooks/usePermissions';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Building2, Loader2, Link2, TriangleAlert, Check } from 'lucide-react';

/**
 * Organization settings.
 *
 * Strictly the organization's own details. Personal settings live under
 * /account, because they belong to the person rather than the organization and
 * every member needs them - this page is behind MANAGE_ORG.
 *
 * Members, Teams and Roles are deliberately absent: they are top-level
 * destinations of their own, and mirroring them here would split the mental
 * model of where to find them.
 */

const INDUSTRIES = [
  { label: 'Technology', value: 'technology' },
  { label: 'Healthcare', value: 'healthcare' },
  { label: 'Finance', value: 'finance' },
  { label: 'Education', value: 'education' },
  { label: 'Retail', value: 'retail' },
  { label: 'Manufacturing', value: 'manufacturing' },
  { label: 'Non-profit', value: 'nonprofit' },
  { label: 'Other', value: 'other' },
];

export default function OrgSettingsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { currentOrg, isLoading, error } = useAppSelector((state) => state.org);
  const { can } = usePermissions();

  const [name, setName] = useState('');
  const [industry, setIndustry] = useState('');
  const [logo, setLogo] = useState('');
  const [saved, setSaved] = useState(false);

  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!currentOrg) return;
    // Reset the editor when the active organization changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setName(currentOrg.name ?? '');
    setIndustry(currentOrg.industry ?? '');
    setLogo(currentOrg.logo ?? '');
  }, [currentOrg]);

  if (!currentOrg) return null;

  const dirty =
    name.trim() !== (currentOrg.name ?? '') ||
    industry !== (currentOrg.industry ?? '') ||
    logo.trim() !== (currentOrg.logo ?? '');

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    const result = await dispatch(
      updateOrganization({
        orgId: currentOrg.id,
        data: { name: name.trim(), industry, logo: logo.trim() },
      })
    );
    if (updateOrganization.fulfilled.match(result)) {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    }
  };

  const onDelete = async () => {
    setDeleting(true);
    const result = await dispatch(deleteOrganization(currentOrg.id));
    setDeleting(false);
    if (deleteOrganization.fulfilled.match(result)) {
      // Nothing left to show; send them back to choose another organization.
      dispatch(setCurrentOrg(null));
      navigate('/org/setup');
    }
  };

  const publicUrl = `${window.location.origin}/${currentOrg.slug}`;

  return (
    <div className="flex min-h-screen bg-muted/30">
      <Sidebar onCreateForm={() => {}} />

      <main className="min-w-0 flex-1 overflow-y-auto bg-muted/20">
        <PageHeader
          title="Organization settings"
          description={`Identity, public address, and controls for ${currentOrg.name}`}
        />
        <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6 lg:p-8">
          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
          )}

          {/* --- general ---------------------------------------------------- */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Building2 className="h-4 w-4 text-primary" />
                General
              </CardTitle>
              <CardDescription>How this organization appears across the app.</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={onSave} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="org-name">Name</Label>
                  <Input
                    id="org-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    minLength={3}
                    maxLength={100}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-industry">Industry</Label>
                  <Select
                    id="org-industry"
                    value={industry}
                    placeholder="Select an industry"
                    options={INDUSTRIES}
                    onChange={(e) => setIndustry(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="org-logo">Logo URL</Label>
                  <Input
                    id="org-logo"
                    type="url"
                    placeholder="https://example.com/logo.png"
                    value={logo}
                    onChange={(e) => setLogo(e.target.value)}
                  />
                  <p className="text-xs text-muted-foreground">
                    A link for now — uploading images is not supported yet.
                  </p>
                  {logo.trim() && (
                    <img
                      src={logo}
                      alt=""
                      className="mt-1 h-10 w-auto rounded border bg-white object-contain p-1"
                      onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                    />
                  )}
                </div>

                <div className="flex items-center gap-3">
                  <Button type="submit" disabled={!dirty || isLoading}>
                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Save changes
                  </Button>
                  {saved && (
                    <span className="flex items-center gap-1 text-sm text-primary">
                      <Check className="h-4 w-4" />
                      Saved
                    </span>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          {/* --- public address --------------------------------------------- */}
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="flex items-center gap-2 text-base">
                <Link2 className="h-4 w-4 text-primary" />
                Public address
              </CardTitle>
              <CardDescription>Where your published forms are served from.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              <code className="block overflow-x-auto rounded-md border bg-muted px-3 py-2 text-sm">
                {publicUrl}/<span className="text-muted-foreground">form-name</span>
              </code>
              <p className="text-xs text-muted-foreground">
                Fixed once the organization is created. Every published form lives under this
                address, so changing it would break links that are already out in the world.
              </p>
            </CardContent>
          </Card>

          {/* --- danger zone -------------------------------------------------- */}
          {can(ACTIONS.DELETE_ORG) && (
            <Card className="border-destructive/40">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-base text-destructive">
                  <TriangleAlert className="h-4 w-4" />
                  Delete this organization
                </CardTitle>
                <CardDescription>
                  Removes every form, response, team and invitation belonging to{' '}
                  {currentOrg.name}. This cannot be undone.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="confirm-name">
                    Type <span className="font-semibold">{currentOrg.name}</span> to confirm
                  </Label>
                  <Input
                    id="confirm-name"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    placeholder={currentOrg.name}
                    autoComplete="off"
                  />
                </div>
                <Button
                  variant="destructive"
                  disabled={confirmName !== currentOrg.name || deleting}
                  onClick={onDelete}
                >
                  {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Delete organization
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
