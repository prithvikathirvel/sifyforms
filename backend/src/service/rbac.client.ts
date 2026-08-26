import axios from 'axios';

// The repo carries a legacy @types/axios that shadows axios v1's bundled
// typings, so `AxiosInstance` is not importable here. Derive it instead.
type AxiosInstance = ReturnType<typeof axios.create>;

import { RBAC_APP_ID, RBAC_BASE_URL, RBAC_TIMEOUT_MS, RoleName } from '../config/rbac.config';
import { createError } from '../utils/errors';
import logger from '../utils/logger';
import { getCallerToken } from '../utils/requestContext';

/**
 * Read-only client for the user-management (RBAC) service.
 *
 * This backend reads role *definitions* from that service - what ORG_ADMIN or
 * TEAM_LEAD is permitted to do - and nothing else. Who holds which role, and in
 * which organization or team, is owned here (`OrgUser.role`, `TeamMember.role`),
 * so a membership change stays a single local write with nothing to keep in
 * step across a service boundary.
 *
 * That split is what lets the RBAC service stay unmodified: only its existing
 * `GET /role/:appId` endpoint is used.
 */

export interface RbacRole {
  id: string;
  name: string;
  appId: string;
  description?: string;
  permission?: unknown;
  isActive?: boolean;
  /** Free-form column this app uses to record where a role may be assigned. */
  template?: string | null;
}

/** `{ feature, actions[] }` entries, however the service happened to store them. */
interface Privilege {
  feature: string;
  actions: string[];
}

let client: AxiosInstance | null = null;

function http(): AxiosInstance {
  if (!client) {
    client = axios.create({
      baseURL: `${RBAC_BASE_URL}/api`,
      timeout: RBAC_TIMEOUT_MS,
      headers: {
        'Content-Type': 'application/json',
        'x-app-id': RBAC_APP_ID,
      },
    });
  }
  return client;
}

/**
 * Credentials for a call to the RBAC service.
 *
 * That service verifies a Keycloak JWT against JWKS and requires the token's
 * email to belong to this application - it has no service-account bypass. So
 * when a request is in flight the right credential is the caller's own token,
 * already verified by this backend's auth middleware.
 *
 * `RBAC_SERVICE_TOKEN` covers the cases with no caller: the seed script and any
 * background job.
 */
function serviceHeaders(): Record<string, string> {
  const token = getCallerToken() ?? process.env.RBAC_SERVICE_TOKEN;
  return token ? { authorization: `Bearer ${token}`, idtoken: token } : {};
}

function unwrap<T>(payload: any): T {
  // Handlers return either `{ code, data }` or the bare value.
  return (payload?.data !== undefined ? payload.data : payload) as T;
}

function fail(operation: string, error: any): never {
  const status = error?.response?.status;
  const message = error?.response?.data?.message ?? error?.message ?? 'Unknown error';
  logger.error(`RbacClient --> ${operation} --> Error`, { status, message });
  throw createError(
    status && status < 500 ? status : 502,
    `RBAC service error during ${operation}: ${message}`
  );
}

// ---------------------------------------------------------------------------
// Role definitions
// ---------------------------------------------------------------------------

let roleCache: { at: number; roles: RbacRole[] } | null = null;
const ROLE_CACHE_TTL_MS = 60_000;

/** All roles defined for this application. Cached briefly; definitions rarely change. */
export async function listRoles(forceRefresh = false): Promise<RbacRole[]> {
  if (!forceRefresh && roleCache && Date.now() - roleCache.at < ROLE_CACHE_TTL_MS) {
    return roleCache.roles;
  }
  try {
    const res = await http().get(`/role/${encodeURIComponent(RBAC_APP_ID)}`, {
      headers: serviceHeaders(),
    });
    const body = res.data as any;
    const roles: RbacRole[] = body?.roles ?? unwrap<RbacRole[]>(body) ?? [];
    roleCache = { at: Date.now(), roles };
    return roles;
  } catch (error) {
    return fail('listRoles', error);
  }
}

export function invalidateRoleCache(): void {
  roleCache = null;
}

/** Resolve a role name (ORG_ADMIN, TEAM_LEAD, ...) to its id in the RBAC service. */
export async function resolveRoleId(roleName: RoleName | string): Promise<string> {
  let roles = await listRoles();
  let match = roles.find(r => r.name === roleName);
  if (!match) {
    // A role seeded after this process warmed its cache would otherwise fail.
    roles = await listRoles(true);
    match = roles.find(r => r.name === roleName);
  }
  if (!match) {
    throw createError(
      500,
      `Role "${roleName}" is not defined for application "${RBAC_APP_ID}". Run "npm run rbac:seed".`
    );
  }
  return match.id;
}

export async function getRoleById(roleId: string): Promise<RbacRole | null> {
  const roles = await listRoles();
  return roles.find(r => r.id === roleId) ?? null;
}

// ---------------------------------------------------------------------------
// Role definitions - writes
// ---------------------------------------------------------------------------

export interface RolePrivilege {
  feature: string;
  actions: string[];
}

export interface RoleDefinitionInput {
  roleName: string;
  description: string;
  /** Scope tags, stored in the service's free-form `template` column. */
  template: string;
  privilege: RolePrivilege[];
}

function rolePayload(input: RoleDefinitionInput) {
  return {
    roleName: input.roleName,
    appId: RBAC_APP_ID,
    description: input.description,
    template: input.template,
    // The service validates every feature and action against what the
    // application has registered, so a typo fails here rather than silently
    // creating a role that grants nothing.
    permission: { appId: RBAC_APP_ID, privilege: input.privilege },
  };
}

export async function createRole(input: RoleDefinitionInput): Promise<void> {
  try {
    await http().post('/role', rolePayload(input), { headers: serviceHeaders() });
    invalidateRoleCache();
  } catch (error) {
    fail('createRole', error);
  }
}

export async function updateRole(roleId: string, input: RoleDefinitionInput): Promise<void> {
  try {
    await http().put(`/role/${encodeURIComponent(roleId)}`, rolePayload(input), {
      headers: serviceHeaders(),
    });
    invalidateRoleCache();
  } catch (error) {
    fail('updateRole', error);
  }
}

/**
 * Toggle a role's active flag.
 *
 * The endpoint is a toggle rather than a setter, so callers check the current
 * state first; sending it twice would put the role back where it started.
 */
export async function toggleRoleActive(roleId: string): Promise<void> {
  try {
    await http().patch(`/role/${encodeURIComponent(roleId)}`, {}, { headers: serviceHeaders() });
    invalidateRoleCache();
  } catch (error) {
    fail('toggleRoleActive', error);
  }
}

// ---------------------------------------------------------------------------
// Permission extraction
// ---------------------------------------------------------------------------

/**
 * Pull the flat action set out of a role's `permission` blob.
 *
 * The blob is `{ appId, privilege: [{ feature, actions: [] }] }` and reaches us
 * as either an object or a JSON string depending on the driver, so handle both.
 */
export function actionsFromPermission(permission: unknown): Set<string> {
  const actions = new Set<string>();
  if (!permission) return actions;

  let parsed: any = permission;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      logger.warn('RbacClient --> actionsFromPermission --> permission is not valid JSON');
      return actions;
    }
  }

  const privileges: Privilege[] = Array.isArray(parsed) ? parsed : parsed?.privilege ?? [];
  for (const privilege of privileges) {
    for (const action of privilege?.actions ?? []) {
      actions.add(action);
    }
  }
  return actions;
}
