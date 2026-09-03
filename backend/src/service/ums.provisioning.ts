import {
  FEATURES,
  FEATURE_ACTIONS,
  ROLE_DEFINITIONS,
  RoleName,
} from '../config/rbac.config';
import { UMS_APP_ID } from '../config/ums.config';
import * as ums from './ums.client';
import { ensureOrganization } from './keycloak.admin';
import { invalidateRoleCache } from './rbac.client';
import logger from '../utils/logger';

/**
 * Bringing an organization into existence in the user-management service.
 *
 * Every step is idempotent, because the only way to survive a partial failure
 * against a service that offers no transaction is to be able to run the whole
 * sequence again.
 */

function nonEmpty(privilege: { feature: string; actions: string[] }[]) {
  return privilege.filter(p => p.actions.length > 0);
}

/**
 * Register the organization so `x-org-id` is accepted for it.
 *
 * The Keycloak record is created first: the user-management service creates one
 * without a domain, which Keycloak 26 rejects, but it treats a 409 from Keycloak
 * as "already there" and writes its own row regardless. Creating it here with a
 * domain is what makes registration succeed against an unmodified service.
 */
export async function registerOrg(orgId: string, name: string): Promise<void> {
  await ensureOrganization(orgId, name);
  await ums.createOrganisation(orgId, name);
}

/**
 * Give the organization its own copy of the role definitions.
 *
 * Existing roles are left alone: an organization is expected to diverge from
 * the template once an administrator edits its permissions, and re-running this
 * must not undo that.
 */
export async function ensureOrgRoleDefinitions(orgId: string): Promise<void> {
  const existing = await ums.listRolesForOrg(orgId);
  const known = new Set(existing.map(r => r.name));

  for (const [name, definition] of Object.entries(ROLE_DEFINITIONS) as [RoleName, (typeof ROLE_DEFINITIONS)[RoleName]][]) {
    if (known.has(name)) continue;
    await ums.createRole(orgId, {
      roleName: name,
      description: definition.description,
      permission: { appId: UMS_APP_ID, privilege: nonEmpty(definition.privilege) },
    });
    logger.info('UmsProvisioning --> role created', { orgId, role: name });
  }

  invalidateRoleCache(orgId);
}

/**
 * Register the feature catalogue for the organization.
 *
 * Purely for the user-management service's own admin screens - it does not
 * validate a role's privileges against this table - so a failure here is logged
 * and swallowed rather than failing the organization.
 */
export async function ensureOrgFeatures(orgId: string): Promise<void> {
  try {
    const existing = await ums.listFeatures(orgId);
    const known = new Set(existing.map((f: any) => f?.name ?? f?.feature));

    for (const feature of Object.values(FEATURES)) {
      if (known.has(feature)) continue;
      await ums.createFeature(orgId, feature, FEATURE_ACTIONS[feature] ?? []);
    }
  } catch (error: any) {
    logger.warn('UmsProvisioning --> ensureOrgFeatures --> skipped', {
      orgId,
      message: error?.message,
    });
  }
}

/** Register the organization and materialise its roles. Safe to re-run. */
export async function provisionOrg(orgId: string, name: string): Promise<void> {
  await registerOrg(orgId, name);
  await ensureOrgFeatures(orgId);
  await ensureOrgRoleDefinitions(orgId);
}

/** Record a member and the role they hold. Safe to re-run. */
export async function mirrorMembership(
  orgId: string,
  userId: string,
  roleId: string
): Promise<void> {
  await ums.addOrgMember(orgId, userId);
  await ums.assignRole(userId, roleId, orgId);
}

export async function mirrorMemberRemoval(orgId: string, userId: string): Promise<void> {
  await ums.removeAssignment(userId, orgId);
  await ums.removeOrgMember(orgId, userId);
}

/**
 * Remove the organization from the user-management service.
 *
 * Member removal is attempted for everyone but never allowed to abort the
 * unwind: retiring the organization is what actually matters, and a member that
 * cannot be detached must not leave it active forever.
 *
 * Note for whoever configures the service user: that service removes a user
 * from `app_users` once they hold no organizations at all. A service account
 * that is also an organization member therefore loses its application
 * membership the moment that organization is deleted, and every later call from
 * it is refused. Keep the service user out of organizations.
 */
export async function unwindOrg(orgId: string, memberIds: string[]): Promise<void> {
  for (const userId of memberIds) {
    try {
      await mirrorMemberRemoval(orgId, userId);
    } catch (error: any) {
      logger.warn('UmsProvisioning --> unwindOrg --> member not detached', {
        orgId,
        userId,
        message: error?.message,
      });
    }
  }
  await ums.deleteOrganisation(orgId);
  invalidateRoleCache(orgId);
}
