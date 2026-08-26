import { teamDao } from '../dao/factory/teamDao.factory';
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
 *   - the RBAC service owns role *definitions* - what ORG_ADMIN or TEAM_LEAD is
 *     allowed to do - read through its existing `/role/:appId` endpoint;
 *   - this backend owns *assignments* - who holds which role, and where - in
 *     `OrgUser.role` and `TeamMember.role`.
 *
 * Keeping assignments here means a membership change is a single local write,
 * with no second write to another service to keep in step.
 *
 * A user's permissions in an organization are the union of:
 *   - the role they hold on the organization, and
 *   - the roles they hold on the team in question and on every team above it.
 *
 * Team roles inherit downward: the lead of a parent team has their lead
 * permissions on every sub-team, without an explicit membership row there.
 */

export interface EffectivePermissions {
  orgId: string;
  teamId?: string;
  /** Role names contributing to this decision, most general first. */
  roles: string[];
  orgRole: string | null;
  /** Team role held directly on `teamId`, ignoring inheritance. */
  teamRole: string | null;
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

function cacheKey(userId: string, orgId: string, teamId?: string): string {
  return `${userId}|${orgId}|${teamId ?? ''}`;
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
 * The chain of team ids from the root down to this team, inclusive.
 *
 * Read straight off the materialized path, so it costs one row read regardless
 * of how deeply the team is nested.
 */
export function ancestryFromPath(path: string): string[] {
  return path.split('/').filter(Boolean);
}

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
  orgId: string,
  teamId?: string
): Promise<EffectivePermissions> {
  const key = cacheKey(userId, orgId, teamId);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < RBAC_CACHE_TTL_MS) {
    return hit.value;
  }

  // Which team scopes are in play: the target team and everything above it.
  let ancestry: string[] = [];
  if (teamId) {
    const team = await teamDao.findTeamById(teamId);
    if (!team) {
      throw createError(404, 'Team not found');
    }
    if (team.orgId !== orgId) {
      throw createError(403, 'Team does not belong to this organization');
    }
    ancestry = ancestryFromPath(team.path);
  }

  const [orgMember, definitions, teamMemberships] = await Promise.all([
    orgDao.findOrgMember(orgId, userId),
    listRoles(),
    ancestry.length ? teamDao.findTeamsForUser(orgId, userId) : Promise.resolve([]),
  ]);

  const actions = new Set<string>();
  const roles: string[] = [];

  const collect = (roleName: string, roleId: string | null) => {
    roles.push(roleName);
    const definition = findDefinition(definitions, roleName, roleId);
    for (const action of actionsFromPermission(definition?.permission)) {
      actions.add(action);
    }
  };

  if (orgMember) {
    collect(orgMember.role, orgMember.roleId);
  }

  // Walk root -> leaf so `roles` reads in inheritance order.
  const byTeamId = new Map(teamMemberships.map(m => [m.teamId, m]));
  for (const ancestorId of ancestry) {
    const membership = byTeamId.get(ancestorId);
    if (membership) {
      collect(membership.role, membership.roleId);
    }
  }

  const value: EffectivePermissions = {
    orgId,
    teamId,
    roles,
    orgRole: orgMember?.role ?? null,
    teamRole: teamId ? byTeamId.get(teamId)?.role ?? null : null,
    actions: [...actions].sort(),
  };

  cache.set(key, { at: Date.now(), value });
  return value;
}

export async function hasPermission(
  userId: string,
  action: Action | string,
  orgId: string,
  teamId?: string
): Promise<boolean> {
  const effective = await getEffectivePermissions(userId, orgId, teamId);
  return effective.actions.includes(action);
}

/** Throws 403 unless the user holds `action` in the given scope. */
export async function assertPermission(
  userId: string,
  action: Action | string,
  orgId: string,
  teamId?: string
): Promise<EffectivePermissions> {
  const effective = await getEffectivePermissions(userId, orgId, teamId);
  if (!effective.actions.includes(action)) {
    logger.warn('Permission denied', { userId, action, orgId, teamId, roles: effective.roles });
    throw createError(403, `You do not have permission to perform this action (${action})`);
  }
  return effective;
}
