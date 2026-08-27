import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../hooks/useAppDispatch';
import {
  fetchRoles,
  createRole,
  updateRole,
  setRoleActive,
  clearRolesError,
  type Role,
} from '../store/rolesSlice';
import { usePermissions, ACTIONS } from '../hooks/usePermissions';
import Sidebar from '../components/layout/Sidebar';
import PageHeader from '../components/layout/PageHeader';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Checkbox as UICheckbox } from '../components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Loader2, Plus, Lock, Pencil, Archive, RotateCcw, ShieldCheck } from 'lucide-react';

/**
 * Role definitions.
 *
 * Built-in roles can have their permissions tuned but not renamed or retired -
 * the application names them and existing memberships store them. Custom roles
 * are fully editable.
 */

type ScopeTag = 'ORG' | 'TEAM';

interface Draft {
  id?: string;
  name: string;
  description: string;
  scopes: ScopeTag[];
  selected: Record<string, Set<string>>;
  isSystem: boolean;
}

const emptyDraft = (): Draft => ({
  name: '',
  description: '',
  scopes: ['ORG'],
  selected: {},
  isSystem: false,
});

function draftFromRole(role: Role): Draft {
  const selected: Record<string, Set<string>> = {};
  for (const entry of role.privilege) {
    selected[entry.feature] = new Set(entry.actions);
  }
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    scopes: role.scopes.length ? role.scopes : ['ORG'],
    selected,
    isSystem: role.isSystem,
  };
}

/** Organization-wide administration means nothing on a team-only role. */
const ORG_ONLY_ACTIONS = new Set([
  'MANAGE_ORG',
  'DELETE_ORG',
  'MANAGE_BILLING',
  'INVITE_USER',
  'REMOVE_USER',
  'ASSIGN_ORG_ROLE',
  'MANAGE_ROLES',
]);

function isInert(action: string, scopes: ScopeTag[]): boolean {
  return ORG_ONLY_ACTIONS.has(action) && !scopes.includes('ORG');
}

export default function RolesPage() {
  const dispatch = useAppDispatch();
  const currentOrg = useAppSelector((state) => state.org.currentOrg);
  const { roles, permissions, isLoading, error } = useAppSelector((state) => state.roles);
  const { can } = usePermissions();

  const [draft, setDraft] = useState<Draft | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const orgId = currentOrg?.id;
  const canManage = can(ACTIONS.MANAGE_ROLES);

  useEffect(() => {
    if (orgId) dispatch(fetchRoles(orgId));
  }, [dispatch, orgId]);

  const toggleAction = (feature: string, action: string) => {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d.selected };
      const set = new Set(next[feature] ?? []);
      if (set.has(action)) set.delete(action);
      else set.add(action);
      next[feature] = set;
      return { ...d, selected: next };
    });
  };

  const toggleFeature = (feature: string, actions: string[]) => {
    setDraft((d) => {
      if (!d) return d;
      const usable = actions.filter((a) => !isInert(a, d.scopes));
      const current = d.selected[feature] ?? new Set<string>();
      const allOn = usable.every((a) => current.has(a));
      const next = { ...d.selected };
      next[feature] = allOn ? new Set<string>() : new Set(usable);
      return { ...d, selected: next };
    });
  };

  const toggleScope = (scope: ScopeTag) => {
    setDraft((d) => {
      if (!d) return d;
      const has = d.scopes.includes(scope);
      const scopes = has ? d.scopes.filter((s) => s !== scope) : [...d.scopes, scope];
      // Dropping organization scope makes org-wide administration inert; clear
      // it rather than leaving ticks that will be stripped on save.
      const selected: Record<string, Set<string>> = {};
      for (const [feature, actions] of Object.entries(d.selected)) {
        selected[feature] = new Set([...actions].filter((a) => !isInert(a, scopes)));
      }
      return { ...d, scopes, selected };
    });
  };

  const onSave = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!orgId || !draft) return;

    const privilege = Object.entries(draft.selected)
      .map(([feature, actions]) => ({ feature, actions: [...actions] }))
      .filter((p) => p.actions.length > 0);

    const payload = {
      orgId,
      name: draft.name.trim(),
      description: draft.description.trim(),
      scopes: draft.scopes,
      privilege,
    };

    setSubmitting(true);
    const result = draft.id
      ? await dispatch(updateRole({ ...payload, roleId: draft.id }))
      : await dispatch(createRole(payload));
    setSubmitting(false);

    const ok = draft.id ? updateRole.fulfilled.match(result) : createRole.fulfilled.match(result);
    if (ok) setDraft(null);
  };

  const selectedCount = draft
    ? Object.values(draft.selected).reduce((sum, set) => sum + set.size, 0)
    : 0;

  return (
    <div className="app-shell flex min-h-screen bg-workspace">
      <Sidebar onCreateForm={() => {}} />
      <main className="min-w-0 flex-1 overflow-y-auto bg-workspace">
        <PageHeader
          title="Roles"
          description="Permission sets for organization and team responsibilities"
          actions={canManage ? (
            <Button onClick={() => setDraft(emptyDraft())} className="h-9 rounded-lg px-3.5">
              <Plus className="mr-2 h-4 w-4" strokeWidth={1.9} />
              <span className="hidden sm:inline">New role</span>
              <span className="sm:hidden">New</span>
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
            <button type="button" onClick={() => dispatch(clearRolesError())}>
              Dismiss
            </button>
          </div>
        )}

        {isLoading && roles.length === 0 ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {roles.map((role) => (
              <Card key={role.id} className={role.isActive ? '' : 'opacity-60'}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <span className="truncate">{role.name}</span>
                        {role.isSystem && (
                          <span
                            title="Built-in role"
                            className="inline-flex shrink-0 items-center gap-1 rounded bg-primary/10 px-1.5 py-0.5 text-xs text-primary"
                          >
                            <Lock className="h-3 w-3" />
                            Built-in
                          </span>
                        )}
                        {!role.isActive && (
                          <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                            Retired
                          </span>
                        )}
                      </CardTitle>
                      <CardDescription>{role.description || 'No description'}</CardDescription>
                    </div>
                    {canManage && (
                      <div className="flex shrink-0 gap-1">
                        <Button variant="ghost" size="sm" onClick={() => setDraft(draftFromRole(role))}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {!role.isSystem && (
                          <Button
                            variant="ghost"
                            size="sm"
                            title={role.isActive ? 'Retire role' : 'Restore role'}
                            onClick={() =>
                              orgId &&
                              dispatch(
                                setRoleActive({ orgId, roleId: role.id, active: !role.isActive })
                              )
                            }
                          >
                            {role.isActive ? (
                              <Archive className="h-4 w-4" />
                            ) : (
                              <RotateCcw className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="text-muted-foreground">
                    Given on the{' '}
                    <span className="font-medium text-foreground">
                      {role.scopes.map((s) => (s === 'ORG' ? 'Members' : 'Teams')).join(' and ')}
                    </span>{' '}
                    page
                  </p>
                  <p className="flex items-center gap-1.5 text-muted-foreground">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {role.actions.length} permission{role.actions.length === 1 ? '' : 's'} ·{' '}
                    {role.assignedCount} holder{role.assignedCount === 1 ? '' : 's'}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* --- editor ------------------------------------------------------ */}
        <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
          <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto" onClose={() => setDraft(null)}>
            <DialogHeader className="mb-4">
              <DialogTitle>{draft?.id ? `Edit ${draft.name}` : 'New role'}</DialogTitle>
              <DialogDescription>
                {draft?.isSystem
                  ? 'This is a built-in role. Its permissions can change; its name and scope cannot.'
                  : 'Choose where the role can be assigned and what it permits.'}
              </DialogDescription>
            </DialogHeader>

            {draft && (
              <form onSubmit={onSave} className="space-y-5">
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="role-name">Name</Label>
                    <Input
                      id="role-name"
                      required
                      disabled={draft.isSystem}
                      placeholder="Reviewer"
                      value={draft.name}
                      onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Where can this role be given?</Label>
                    <div className="space-y-2 pt-1">
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <UICheckbox
                          checked={draft.scopes.includes('ORG')}
                          disabled={draft.isSystem}
                          onCheckedChange={() => toggleScope('ORG')}
                        />
                        <span className="leading-tight">
                          On the Members page
                          <span className="block text-xs text-muted-foreground">
                            Applies across the whole organization
                          </span>
                        </span>
                      </label>
                      <label className="flex items-start gap-2 text-sm cursor-pointer">
                        <UICheckbox
                          checked={draft.scopes.includes('TEAM')}
                          disabled={draft.isSystem}
                          onCheckedChange={() => toggleScope('TEAM')}
                        />
                        <span className="leading-tight">
                          On the Teams page
                          <span className="block text-xs text-muted-foreground">
                            Applies to one team and everything under it
                          </span>
                        </span>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="role-description">Description</Label>
                  <Textarea
                    id="role-description"
                    rows={2}
                    placeholder="What this role is for"
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </div>

                <div className="space-y-3">
                  <Label>Permissions ({selectedCount} selected)</Label>
                  {permissions.map((group) => {
                    const keys = group.actions.map((a) => a.key);
                    const current = draft.selected[group.feature] ?? new Set<string>();
                    const allOn = keys.length > 0 && keys.every((k) => current.has(k));
                    return (
                      <div key={group.feature} className="rounded-md border">
                        <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2">
                          <span className="text-sm font-medium">{group.feature}</span>
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline"
                            onClick={() => toggleFeature(group.feature, keys)}
                          >
                            {allOn ? 'Clear all' : 'Select all'}
                          </button>
                        </div>
                        <div className="grid gap-2 p-3 sm:grid-cols-2">
                          {group.actions.map((action) => {
                            // Organization-wide administration cannot be granted
                            // by a team assignment, so offering the tick would
                            // promise something no check would honour.
                            const inert = !!action.orgOnly && !draft.scopes.includes('ORG');
                            return (
                              <label
                                key={action.key}
                                title={inert ? 'Only applies to roles given on the Members page' : undefined}
                                className={`flex items-start gap-2 text-sm ${
                                  inert ? 'opacity-45 cursor-not-allowed' : 'cursor-pointer'
                                }`}
                              >
                                <UICheckbox
                                  checked={!inert && current.has(action.key)}
                                  disabled={inert}
                                  onCheckedChange={() => toggleAction(group.feature, action.key)}
                                />
                                <span className="leading-tight">{action.value}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex justify-end gap-2">
                  <Button type="button" variant="outline" onClick={() => setDraft(null)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={submitting || !draft.name.trim() || selectedCount === 0}>
                    {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {draft.id ? 'Save changes' : 'Create role'}
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
        </div>
      </main>
    </div>
  );
}
