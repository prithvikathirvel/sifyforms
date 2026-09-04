import { useCallback, useEffect, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from './useAppDispatch';
import { fetchPermissions } from '../store/teamsSlice';

/**
 * What the signed-in user may do in the current organization, from their
 * organization role alone.
 *
 * This gates what the UI *shows*. The server re-checks every write, so hiding a
 * button is a convenience, never the access control itself.
 *
 *   const { can, isLoading } = usePermissions();
 *   {can('CREATE_TEAM') && <NewTeamButton />}
 *
 * Loading is driven by an explicit per-organization status rather than by "no
 * answer yet". Inferring it from the absence of an answer cannot tell a request
 * that is still running from one that failed or was cancelled, so a single
 * aborted lookup — which happens routinely when someone switches organizations
 * quickly — used to leave every gated page spinning with no way back.
 */
export function usePermissions() {
  const dispatch = useAppDispatch();
  const currentOrg = useAppSelector((state) => state.org.currentOrg);
  const permissions = useAppSelector((state) => state.teams.permissions);
  const permissionStatus = useAppSelector((state) => state.teams.permissionStatus);
  const permissionError = useAppSelector((state) => state.teams.permissionError);

  const orgId = currentOrg?.id;
  const key = orgId ?? '';
  const entry = permissions[key];
  const status = permissionStatus[key];
  const error = permissionError[key] ?? null;

  useEffect(() => {
    // Only an untouched organization starts a request. 'loading' is already in
    // flight, 'ready' is answered, and 'error' waits for an explicit retry so a
    // failing endpoint cannot turn into a request loop.
    if (orgId && status === undefined) {
      dispatch(fetchPermissions({ orgId }));
    }
  }, [orgId, status, dispatch]);

  const retry = useCallback(() => {
    if (orgId) dispatch(fetchPermissions({ orgId }));
  }, [orgId, dispatch]);

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
    isLoading: !!orgId && !entry && status !== 'error',
    /** Set when the lookup failed outright; pair it with `retry`. */
    error: entry ? null : error,
    retry,
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
 * Role options for a picker, built from the live catalogue. Falls back to the
 * built-ins before the fetch lands.
 */
export function useRoleOptions() {
  const roles = useAppSelector((state) => state.roles.roles);

  if (roles.length === 0) {
    const fallback = ['ADMIN', 'CREATOR', 'ANALYST', 'VIEWER'];
    return fallback.map((v) => ({ value: v, label: roleLabel(v) }));
  }

  return roles
    .filter((r) => r.isActive)
    // OWNER transfers with the organization rather than being granted.
    .filter((r) => r.name !== 'OWNER')
    .map((r) => ({ value: r.name, label: roleLabel(r.name) }));
}

// --- response access ----------------------------------------------------------

/*
 * How much of a form's responses somebody is allowed to see.
 *
 * These are descriptions of a state, and they are shown next to real buttons,
 * so they have to be unmistakably not-buttons. "Full responses and export" was
 * being read as an instruction and clicked: it is a noun phrase naming a
 * feature, which is exactly what a button label is. Every entry now starts with
 * a verb of capability — "Can view…", "Cannot…" — which no button label ever
 * does, so the grammar itself says this is a fact about you rather than
 * something to press.
 */
export const RESPONSE_LEVEL_LABEL: Record<string, string> = {
  NONE: 'Cannot see responses',
  AGGREGATE: 'Can see totals only',
  REDACTED: 'Can view, identifying answers hidden',
  FULL: 'Can view responses',
  EXPORT: 'Can view and download',
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
