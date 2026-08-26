import { useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from './useAppDispatch';
import { fetchPermissions } from '../store/teamsSlice';

/**
 * What the signed-in user may do in the current organization, optionally within
 * one team (which folds in roles inherited from that team's ancestors).
 *
 * This gates what the UI *shows*. The server re-checks every write, so hiding a
 * button is a convenience, never the access control itself.
 *
 *   const { can, isLoading } = usePermissions();
 *   {can('CREATE_TEAM') && <NewTeamButton />}
 */
export function usePermissions(teamId?: string) {
  const dispatch = useAppDispatch();
  const currentOrg = useAppSelector((state) => state.org.currentOrg);
  const permissions = useAppSelector((state) => state.teams.permissions);

  const orgId = currentOrg?.id;
  const key = `${orgId ?? ''}|${teamId ?? ''}`;
  const entry = permissions[key];

  useEffect(() => {
    if (orgId && !entry) {
      dispatch(fetchPermissions({ orgId, teamId }));
    }
  }, [orgId, teamId, entry, dispatch]);

  const actions = useMemo(() => new Set(entry?.actions ?? []), [entry]);

  return {
    /** True when the user holds `action` in this scope. */
    can: (action: string) => actions.has(action),
    /** True when the user holds every one of `required`. */
    canAll: (...required: string[]) => required.every((a) => actions.has(a)),
    /** True when the user holds at least one of `required`. */
    canAny: (...required: string[]) => required.some((a) => actions.has(a)),
    /** Role names contributing to this decision, most general first. */
    roles: entry?.roles ?? [],
    orgRole: entry?.orgRole ?? null,
    teamRole: entry?.teamRole ?? null,
    isLoading: !!orgId && !entry,
  };
}

/** Action names, kept in step with the backend's rbac.config.ts. */
export const ACTIONS = {
  VIEW_ORG: 'VIEW_ORG',
  MANAGE_ORG: 'MANAGE_ORG',
  DELETE_ORG: 'DELETE_ORG',
  MANAGE_BILLING: 'MANAGE_BILLING',
  INVITE_USER: 'INVITE_USER',
  REMOVE_USER: 'REMOVE_USER',
  ASSIGN_ORG_ROLE: 'ASSIGN_ORG_ROLE',
  MANAGE_ROLES: 'MANAGE_ROLES',
  VIEW_MEMBERS: 'VIEW_MEMBERS',

  VIEW_TEAM: 'VIEW_TEAM',
  CREATE_TEAM: 'CREATE_TEAM',
  EDIT_TEAM: 'EDIT_TEAM',
  DELETE_TEAM: 'DELETE_TEAM',
  ADD_TEAM_MEMBER: 'ADD_TEAM_MEMBER',
  REMOVE_TEAM_MEMBER: 'REMOVE_TEAM_MEMBER',
  ASSIGN_TEAM_ROLE: 'ASSIGN_TEAM_ROLE',

  VIEW_FORM: 'VIEW_FORM',
  CREATE_FORM: 'CREATE_FORM',
  EDIT_FORM: 'EDIT_FORM',
  DELETE_FORM: 'DELETE_FORM',
  PUBLISH_FORM: 'PUBLISH_FORM',
  MOVE_FORM: 'MOVE_FORM',
  SHARE_FORM: 'SHARE_FORM',

  VIEW_AGGREGATE: 'VIEW_AGGREGATE',
  VIEW_RESPONSES_REDACTED: 'VIEW_RESPONSES_REDACTED',
  VIEW_RESPONSES_FULL: 'VIEW_RESPONSES_FULL',
  EXPORT_RESPONSES: 'EXPORT_RESPONSES',
  DELETE_RESPONSES: 'DELETE_RESPONSES',
} as const;

interface RoleOption {
  value: string;
  label: string;
  hint: string;
}

/**
 * Presentation only. The authoritative list of roles - including any created in
 * the Roles screen - comes from the API via rolesSlice; this just gives the
 * built-ins friendlier labels than their raw names.
 */
const BUILTIN_LABELS: Record<string, RoleOption> = {
  OWNER: { value: 'OWNER', label: 'Owner', hint: 'Everything, including billing and deleting the organization' },
  ADMIN: { value: 'ADMIN', label: 'Admin', hint: 'Runs the organization; no billing, cannot delete it' },
  TEAM_LEAD: { value: 'TEAM_LEAD', label: 'Team Lead', hint: 'Runs this team, its members and its sub-teams' },
  CREATOR: { value: 'CREATOR', label: 'Creator', hint: 'Builds forms; sees results in aggregate, not individual responses' },
  ANALYST: { value: 'ANALYST', label: 'Analyst', hint: 'Reads and exports responses; cannot change the questions' },
  VIEWER: { value: 'VIEWER', label: 'Viewer', hint: 'Sees which forms exist, and nothing submitted to them' },
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return '—';
  return BUILTIN_LABELS[role]?.label ?? role;
}

export function roleHint(role: string | null | undefined): string {
  if (!role) return '';
  return BUILTIN_LABELS[role]?.hint ?? '';
}

/**
 * Role options for a picker, built from the live catalogue and filtered to the
 * scope being assigned. Falls back to the built-ins before the fetch lands.
 */
export function useRoleOptions(scope: 'ORG' | 'TEAM') {
  const roles = useAppSelector((state) => state.roles.roles);

  if (roles.length === 0) {
    const fallback = scope === 'ORG'
      ? ['ADMIN', 'CREATOR', 'ANALYST', 'VIEWER']
      : ['TEAM_LEAD', 'CREATOR', 'ANALYST', 'VIEWER'];
    return fallback.map((v) => ({ value: v, label: roleLabel(v) }));
  }

  return roles
    .filter((r) => r.isActive && r.scopes.includes(scope))
    // OWNER transfers with the organization rather than being granted.
    .filter((r) => r.name !== 'OWNER')
    .map((r) => ({ value: r.name, label: roleLabel(r.name) }));
}

// --- response access ----------------------------------------------------------

export const RESPONSE_LEVEL_LABEL: Record<string, string> = {
  NONE: 'No access',
  AGGREGATE: 'Aggregate only',
  REDACTED: 'Responses, identifying fields hidden',
  FULL: 'Full responses',
  EXPORT: 'Full responses and export',
};

export const RESPONSE_POLICY_OPTIONS = [
  {
    value: 'STANDARD',
    label: 'Standard',
    hint: 'Roles apply as normal.',
  },
  {
    value: 'ANONYMOUS',
    label: 'Anonymous',
    hint: 'Nobody can open an individual response — not even you. Aggregate results only.',
  },
  {
    value: 'BLIND_REVIEW',
    label: 'Blind review',
    hint: 'Responses are readable, but never attributed to a person.',
  },
  {
    value: 'RESTRICTED',
    label: 'Restricted',
    hint: 'Only people this form is explicitly shared with, whatever their role.',
  },
];

export function policyLabel(policy: string | null | undefined): string {
  if (!policy) return 'Standard';
  return RESPONSE_POLICY_OPTIONS.find(o => o.value === policy)?.label ?? policy;
}
