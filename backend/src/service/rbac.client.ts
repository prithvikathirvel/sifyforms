import prisma from '../utils/prisma';
import { RoleName } from '../config/rbac.config';
import {
  RBAC_BREAKER_COOLDOWN_MS,
  RBAC_BREAKER_THRESHOLD,
  ROLE_CACHE_TTL_MS,
  UMS_APP_ID,
} from '../config/ums.config';
import * as ums from './ums.client';
import { createError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Role definitions, read from the user-management service.
 *
 * That service owns what a role *means*; this application owns who holds it.
 * Because its role query filters `AND orgId = ?`, which never matches the null
 * rows an application-level role would have, definitions are materialised per
 * organization and every read here is organization-scoped.
 *
 * Availability is the hard requirement: definitions change perhaps monthly, so
 * an unreachable user-management service must not stop this application
 * authorizing requests. Three layers cover that - an in-memory TTL cache served
 * stale on failure, a durable last-known-good copy that survives a restart, and
 * a breaker that stops hammering a service that is already down.
 */

export interface RbacRole {
  id: string;
  name: string;
  appId: string;
  description?: string;
  permission?: unknown;
  isActive?: boolean;
}

/** `{ feature, actions[] }` entries, however the service happened to store them. */
interface Privilege {
  feature: string;
  actions: string[];
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  at: number;
  roles: RbacRole[];
}

/**
 * Keyed by organization. A single global slot would serve one organization's
 * definitions to another the moment a second organization exists.
 */
const roleCache = new Map<string, CacheEntry>();

export function invalidateRoleCache(orgId?: string): void {
  if (orgId) roleCache.delete(orgId);
  else roleCache.clear();
}

// ---------------------------------------------------------------------------
// Circuit breaker
// ---------------------------------------------------------------------------

let consecutiveFailures = 0;
let breakerOpenUntil = 0;

function recordSuccess(): void {
  consecutiveFailures = 0;
  breakerOpenUntil = 0;
}

function recordFailure(): void {
  consecutiveFailures += 1;
  if (consecutiveFailures >= RBAC_BREAKER_THRESHOLD) {
    breakerOpenUntil = Date.now() + RBAC_BREAKER_COOLDOWN_MS;
    logger.error('RbacClient --> breaker open', {
      failures: consecutiveFailures,
      cooldownMs: RBAC_BREAKER_COOLDOWN_MS,
    });
  }
}

// ---------------------------------------------------------------------------
// Durable last-known-good copy
// ---------------------------------------------------------------------------

async function persist(orgId: string, roles: RbacRole[]): Promise<void> {
  try {
    const payload = JSON.stringify(roles);
    await prisma.roleDefinitionCache.upsert({
      where: { appId_orgId: { appId: UMS_APP_ID, orgId } },
      update: { payload, fetchedAt: new Date() },
      create: { appId: UMS_APP_ID, orgId, payload },
    });
  } catch (error: any) {
    // The durable copy is an optimisation; failing to write it must not fail the request.
    logger.warn('RbacClient --> persist --> failed', { orgId, message: error?.message });
  }
}

async function loadPersisted(orgId: string): Promise<RbacRole[] | null> {
  try {
    const row = await prisma.roleDefinitionCache.findUnique({
      where: { appId_orgId: { appId: UMS_APP_ID, orgId } },
    });
    if (!row) return null;
    const parsed = JSON.parse(row.payload);
    return Array.isArray(parsed) ? parsed : null;
  } catch (error: any) {
    logger.warn('RbacClient --> loadPersisted --> failed', { orgId, message: error?.message });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

/** Role definitions for one organization. */
export async function listRoles(orgId: string, forceRefresh = false): Promise<RbacRole[]> {
  if (!orgId) {
    throw createError(400, 'Organization ID required to resolve role definitions');
  }

  const cached = roleCache.get(orgId);
  if (!forceRefresh && cached && Date.now() - cached.at < ROLE_CACHE_TTL_MS) {
    return cached.roles;
  }

  if (Date.now() < breakerOpenUntil) {
    const fallback = cached?.roles ?? (await loadPersisted(orgId));
    if (fallback) return fallback;
    throw createError(503, 'Role definitions are temporarily unavailable. Please try again shortly.');
  }

  try {
    const roles = (await ums.listRolesForOrg(orgId)) as RbacRole[];
    recordSuccess();
    roleCache.set(orgId, { at: Date.now(), roles });
    void persist(orgId, roles);
    return roles;
  } catch (error: any) {
    recordFailure();

    if (cached) {
      logger.warn('RbacClient --> listRoles --> serving stale definitions', {
        orgId,
        ageMs: Date.now() - cached.at,
        message: error?.message,
      });
      return cached.roles;
    }

    const persisted = await loadPersisted(orgId);
    if (persisted) {
      logger.warn('RbacClient --> listRoles --> serving persisted definitions', {
        orgId,
        message: error?.message,
      });
      roleCache.set(orgId, { at: Date.now(), roles: persisted });
      return persisted;
    }

    // Never a 403 here: telling someone their permissions were revoked when the
    // definition store is merely unreachable is worse than admitting an outage.
    throw createError(
      503,
      `Role definitions are unavailable for this organization (${error?.message ?? 'unknown error'})`
    );
  }
}

/** Resolve a role name (OWNER, CREATOR, ...) to its id within one organization. */
export async function resolveRoleId(roleName: RoleName | string, orgId: string): Promise<string> {
  let roles = await listRoles(orgId);
  let match = roles.find(r => r.name === roleName);
  if (!match) {
    // A role created after this process warmed its cache would otherwise fail.
    roles = await listRoles(orgId, true);
    match = roles.find(r => r.name === roleName);
  }
  if (!match) {
    throw createError(
      500,
      `Role "${roleName}" is not defined for this organization. Run "npm run rbac:seed -- --org ${orgId}".`
    );
  }
  return match.id;
}

export async function getRoleById(roleId: string, orgId: string): Promise<RbacRole | null> {
  const roles = await listRoles(orgId);
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
  privilege: RolePrivilege[];
}

function rolePayload(input: RoleDefinitionInput): ums.UmsRolePayload {
  return {
    roleName: input.roleName,
    description: input.description,
    permission: { appId: UMS_APP_ID, privilege: input.privilege },
  };
}

export async function createRole(input: RoleDefinitionInput, orgId: string): Promise<void> {
  await ums.createRole(orgId, rolePayload(input));
  invalidateRoleCache(orgId);
}

export async function updateRole(
  roleId: string,
  input: RoleDefinitionInput,
  orgId: string
): Promise<void> {
  await ums.updateRole(orgId, roleId, rolePayload(input));
  invalidateRoleCache(orgId);
}

/**
 * Toggle a role's active flag.
 *
 * The endpoint is a toggle rather than a setter, so callers check the current
 * state first; sending it twice would put the role back where it started.
 */
export async function toggleRoleActive(roleId: string, orgId: string): Promise<void> {
  await ums.toggleRole(orgId, roleId);
  invalidateRoleCache(orgId);
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
