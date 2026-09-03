import { orgDao } from '../dao/factory/orgDao.factory';
import { RBAC_CACHE_TTL_MS, Action } from '../config/rbac.config';
import { actionsFromPermission, listRoles, RbacRole } from './rbac.client';
import { createError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Effective-permission resolution.
 *
 * Responsibility is split across the two services:
 *
 *   - the RBAC service owns role *definitions* - what ORG_ADMIN or CREATOR is
 *     allowed to do - read through its existing `/role/:appId` endpoint;
 *   - this backend owns *assignments* - who holds which role - in
 *     `OrgUser.role`.
 *
 * A user's permissions in an organization come from their organization role
 * alone. Teams are grouping buckets and carry no permissions, so a membership
 * change is a single local write with nothing else to keep in step.
 */

export interface EffectivePermissions {
  orgId: string;
  /** Role names contributing to this decision, most general first. */
  roles: string[];
  orgRole: string | null;
  actions: string[];
}

// ---------------------------------------------------------------------------
// Cache
// ---------------------------------------------------------------------------

interface CacheEntry {
  at: number;
  value: EffectivePermissions;
}

const cache = new Map<string, CacheEntry>();

function cacheKey(userId: string, orgId: string): string {
  return `${userId}|${orgId}`;
}

/**
 * Drop cached decisions. Called after any membership or role change so a user
 * does not keep stale access for the length of the TTL.
 *
 * With neither argument the whole cache is cleared; that only happens on role
 * definition changes, which are rare.
 */
export function invalidatePermissions(userId?: string, orgId?: string): void {
  if (!userId && !orgId) {
    cache.clear();
    return;
  }
  for (const key of [...cache.keys()]) {
    const [keyUser, keyOrg] = key.split('|');
    if ((!userId || keyUser === userId) && (!orgId || keyOrg === orgId)) {
      cache.delete(key);
    }
  }
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

/**
 * Look up a role definition by the name cached on the membership row, falling
 * back to its id. A membership naming a role the RBAC service does not define
 * contributes nothing rather than throwing - one unknown role should not lock a
 * user out of everything else they hold.
 */
function findDefinition(
  roles: RbacRole[],
  roleName: string,
  roleId: string | null
): RbacRole | undefined {
  const match = roles.find(r => r.name === roleName) ?? (roleId ? roles.find(r => r.id === roleId) : undefined);
  if (!match) {
    logger.warn('Permission --> unknown role definition', { roleName, roleId });
  }
  return match;
}

export async function getEffectivePermissions(
  userId: string,
  orgId: string
): Promise<EffectivePermissions> {
  const key = cacheKey(userId, orgId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < RBAC_CACHE_TTL_MS) {
    return hit.value;
  }

  const orgMember = await orgDao.findOrgMember(orgId, userId);

  const actions = new Set<string>();
  const roles: string[] = [];

  if (orgMember) {
    // Only reached for an actual member, so a failure to read definitions is a
    // genuine outage and propagates as 503. A non-member resolves to an empty
    // action set without ever touching the user-management service.
    const definitions = await listRoles(orgId);
    roles.push(orgMember.role);
    const definition = findDefinition(definitions, orgMember.role, orgMember.roleId);
    for (const action of actionsFromPermission(definition?.permission)) {
      actions.add(action);
    }
  }

  const value: EffectivePermissions = {
    orgId,
    roles,
    orgRole: orgMember?.role ?? null,
    actions: [...actions].sort(),
  };

  cache.set(key, { at: Date.now(), value });
  return value;
}

/** Throws 403 unless the user holds `action` in this organization. */
export async function assertPermission(
  userId: string,
  action: Action | string,
  orgId: string
): Promise<EffectivePermissions> {
  const effective = await getEffectivePermissions(userId, orgId);
  if (!effective.actions.includes(action)) {
    logger.warn('Permission denied', { userId, action, orgId, roles: effective.roles });
    throw createError(403, `You do not have permission to perform this action (${action})`);
  }
  return effective;
}
