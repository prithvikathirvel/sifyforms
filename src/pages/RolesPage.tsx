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
import { Checkbox as UICheckbox } from '../components/ui/checkbox';
import { Badge } from '../components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { toast } from '../components/ui/toast';
import {
  Archive,
  BarChart3,
  Building2,
  Check,
  FileText,
  Loader2,
  Lock,
  Network,
  Pencil,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Users,
} from 'lucide-react';

/**
 * Role definitions.
 *
 * Built-in roles can have their permissions tuned but not renamed or retired -
 * the application names them and existing memberships store them. Custom roles
 * are fully editable.
 */

interface Draft {
  id?: string;
  name: string;
  description: string;
  selected: Record<string, Set<string>>;
  isSystem: boolean;
}

const emptyDraft = (): Draft => ({
  name: '',
  description: '',
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
    selected,
    isSystem: role.isSystem,
  };
}

/** Feature metadata for the permission catalogue, keyed by feature name. */
const FEATURE_META: Record<string, { icon: typeof ShieldCheck; tint: string }> = {
  Organization: { icon: Building2, tint: 'bg-brand-50 text-brand-600 border-brand-200' },
  Team: { icon: Network, tint: 'bg-plum-50 text-plum-600 border-plum-200' },
  Form: { icon: FileText, tint: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
  Response: { icon: BarChart3, tint: 'bg-amber-50 text-amber-600 border-amber-200' },
};

function featureMeta(feature: string) {
  return FEATURE_META[feature] ?? { icon: ShieldCheck, tint: 'bg-muted text-ink-500 border-border' };
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
      const current = d.selected[feature] ?? new Set<string>();
      const allOn = actions.every((a) => current.has(a));
      const next = { ...d.selected };
      next[feature] = allOn ? new Set<string>() : new Set(actions);
      return { ...d, selected: next };
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
      privilege,
    };

    const isEdit = Boolean(draft.id);
    setSubmitting(true);
    const result = draft.id
      ? await dispatch(updateRole({ ...payload, roleId: draft.id }))
      : await dispatch(createRole(payload));
    setSubmitting(false);

    const ok = isEdit ? updateRole.fulfilled.match(result) : createRole.fulfilled.match(result);
    if (ok) {
      toast.success({
        title: isEdit ? 'Role updated' : 'Role created',
        description: `${draft.name.trim()} is ready to assign on the Members page.`,
      });
      setDraft(null);
    } else {
      const message = (result.payload as string) || 'Something went wrong';
      toast.error({ title: 'Could not save role', description: message });
    }
  };

  const onToggleActive = async (role: Role) => {
    if (!orgId) return;
    const result = await dispatch(
      setRoleActive({ orgId, roleId: role.id, active: !role.isActive })
    );
    if (setRoleActive.fulfilled.match(result)) {
      toast.success({
        title: role.isActive ? 'Role retired' : 'Role restored',
        description: `${role.name} ${role.isActive ? 'is no longer assignable' : 'is assignable again'}.`,
      });
    } else {
      toast.error({ title: 'Could not change role status', description: result.payload as string });
    }
  };

  const selectedCount = draft
    ? Object.values(draft.selected).reduce((sum, set) => sum + set.size, 0)
    : 0;

  return (
    <div className="app-shell flex h-screen bg-workspace">
      <Sidebar onCreateForm={() => {}} />
      <main className="min-w-0 flex-1 overflow-y-auto bg-workspace">
        <PageHeader
          title="Roles"
          description="Permission sets assigned to members across the organization"
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
              className="flex items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/[0.05] px-3.5 py-3 text-[13px] font-medium text-destructive"
              role="alert"
            >
              <span>{error}</span>
              <button type="button" onClick={() => dispatch(clearRolesError())} className="font-semibold">
                Dismiss
              </button>
            </div>
          )}

          {isLoading && roles.length === 0 ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : roles.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-muted/50 text-ink-400">
                <ShieldCheck className="h-5 w-5" strokeWidth={1.7} />
              </span>
              <p className="mt-4 text-sm font-semibold text-foreground">No roles yet</p>
              <p className="mt-1 max-w-xs text-xs font-medium leading-5 text-muted-foreground">
                Roles decide what members can see and change. Create one to get started.
              </p>
              {canManage && (
                <Button onClick={() => setDraft(emptyDraft())} className="mt-5 h-9 rounded-lg px-3.5">
                  <Plus className="mr-2 h-4 w-4" strokeWidth={1.9} />
                  New role
                </Button>
              )}
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {roles.map((role) => {
                const meta = role.isSystem
                  ? { icon: ShieldCheck, tint: 'bg-brand-50 text-brand-600 border-brand-200' }
                  : { icon: Sparkles, tint: 'bg-plum-50 text-plum-600 border-plum-200' };
                const Icon = meta.icon;

                return (
                  <div
                    key={role.id}
                    className={`group flex flex-col rounded-xl border bg-card shadow-none transition-colors ${
                      role.isActive ? 'border-border/80' : 'border-border/60 opacity-60'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3 px-4 pb-3 pt-4">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${meta.tint}`}>
                          <Icon className="h-4 w-4" strokeWidth={1.9} />
                        </span>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <h3 className="truncate font-display text-sm font-bold text-foreground">{role.name}</h3>
                            {role.isSystem && (
                              <Badge variant="secondary" className="shrink-0 gap-1 border-transparent bg-primary/[0.08] text-primary">
                                <Lock className="h-3 w-3" />
                                Built-in
                              </Badge>
                            )}
                          </div>
                          <p className="mt-1 line-clamp-2 text-xs font-medium leading-5 text-muted-foreground">
                            {role.description || 'No description'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="mt-auto flex items-center justify-between border-t border-border/70 px-4 py-3">
                      <div className="flex items-center gap-3 text-[11px] font-medium text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5">
                          <Check className="h-3.5 w-3.5 text-emerald-600" strokeWidth={2} />
                          {role.actions.length} permission{role.actions.length === 1 ? '' : 's'}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" strokeWidth={1.8} />
                          {role.assignedCount} holder{role.assignedCount === 1 ? '' : 's'}
                        </span>
                        {!role.isActive && (
                          <Badge variant="secondary" className="border-transparent bg-muted text-muted-foreground">
                            Retired
                          </Badge>
                        )}
                      </div>

                      {canManage && (
                        <div className="flex shrink-0 gap-0.5">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDraft(draftFromRole(role))}
                            className="h-8 w-8 p-0"
                            aria-label={`Edit ${role.name}`}
                            title="Edit permissions"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!role.isSystem && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onToggleActive(role)}
                              className="h-8 w-8 p-0"
                              aria-label={role.isActive ? `Retire ${role.name}` : `Restore ${role.name}`}
                              title={role.isActive ? 'Retire role' : 'Restore role'}
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
                  </div>
                );
              })}
            </div>
          )}

          {/* --- editor ------------------------------------------------------ */}
          <Dialog open={draft !== null} onOpenChange={(open) => !open && setDraft(null)}>
            <DialogContent className="max-h-[88vh] max-w-2xl overflow-hidden p-0" onClose={() => setDraft(null)}>
              <DialogHeader className="border-b border-border/70 px-6 py-4">
                <DialogTitle className="font-display text-base font-bold">
                  {draft?.id ? `Edit ${draft.name}` : 'New role'}
                </DialogTitle>
                <DialogDescription>
                  {draft?.isSystem
                    ? 'A built-in role. Its permissions can change; its name cannot.'
                    : 'Choose a name and the permissions this role grants.'}
                </DialogDescription>
              </DialogHeader>

              {draft && (
                <form onSubmit={onSave} className="flex max-h-[calc(88vh-4.5rem)] flex-col">
                  <div className="scrollbar-subtle min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                    <div className="grid gap-4 sm:grid-cols-2">
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
                        <Label htmlFor="role-description">Description</Label>
                        <Input
                          id="role-description"
                          placeholder="What this role is for"
                          value={draft.description}
                          onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <Label className="text-[13px]">Permissions</Label>
                        <span className="rounded-full border border-border bg-muted/50 px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
                          {selectedCount} selected
                        </span>
                      </div>

                      {permissions.map((group) => {
                        const keys = group.actions.map((a) => a.key);
                        const current = draft.selected[group.feature] ?? new Set<string>();
                        const allOn = keys.length > 0 && keys.every((k) => current.has(k));
                        const meta = featureMeta(group.feature);
                        const FeatureIcon = meta.icon;

                        return (
                          <div key={group.feature} className="overflow-hidden rounded-lg border border-border/80">
                            <div className="flex items-center justify-between border-b border-border/70 bg-muted/30 px-3.5 py-2.5">
                              <div className="flex items-center gap-2.5">
                                <span className={`flex h-6 w-6 items-center justify-center rounded-md border ${meta.tint}`}>
                                  <FeatureIcon className="h-3.5 w-3.5" strokeWidth={1.9} />
                                </span>
                                <span className="text-[13px] font-semibold text-foreground">{group.feature}</span>
                                <span className="text-[11px] font-medium text-muted-foreground">
                                  {current.size}/{keys.length}
                                </span>
                              </div>
                              <button
                                type="button"
                                className="text-xs font-semibold text-primary hover:underline"
                                onClick={() => toggleFeature(group.feature, keys)}
                              >
                                {allOn ? 'Clear all' : 'Select all'}
                              </button>
                            </div>
                            <div className="grid gap-1 p-2.5 sm:grid-cols-2">
                              {group.actions.map((action) => (
                                <label
                                  key={action.key}
                                  className="flex cursor-pointer items-start gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                                >
                                  <UICheckbox
                                    checked={current.has(action.key)}
                                    onCheckedChange={() => toggleAction(group.feature, action.key)}
                                  />
                                  <span className="text-[13px] font-medium leading-5 text-foreground">{action.value}</span>
                                </label>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 border-t border-border/70 bg-muted/20 px-6 py-4">
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
