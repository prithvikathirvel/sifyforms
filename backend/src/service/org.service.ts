import { orgDao } from '../dao/factory/orgDao.factory';
import { teamDao } from '../dao/factory/teamDao.factory';
import { CreateOrgInput, UpdateOrgInput } from '../schemas/org.schema';
import {
  DEFAULT_ORG_OWNER_ROLE,
  ROLES,
} from '../config/rbac.config';
import { UMS_ROLE_MIRROR_ENABLED } from '../config/ums.config';
import { invalidateRoleCache, resolveRoleId } from './rbac.client';
import { provisionOrg } from './ums.provisioning';
import { cancelPendingFor, enqueueQuietly } from './ums.outbox';
import { assertRoleAssignable, rolesGrantingAdmin } from './role.service';
import { createDefaultTeam } from './team.service';
import { invalidatePermissions } from './permission.service';
import { createError } from '../utils/errors';
import logger from '../utils/logger';

// Roles are data now, not a constant, so a role created in the UI is usable
// immediately rather than after a code change.
async function assertOrgRole(role: string, orgId: string): Promise<string> {
  await assertRoleAssignable(role, orgId);
  return role;
}

/** Record a membership in the user-management service, without ever failing the caller. */
function mirrorMember(orgId: string, userId: string, roleName: string): void {
  if (!UMS_ROLE_MIRROR_ENABLED) return;
  void enqueueQuietly('MEMBER_SYNC', orgId, { userId, roleName });
}

/**
 * Create an organization.
 *
 * The local row must exist first, because its id is what the user-management
 * service is told about and what every later `x-org-id` carries. Registration
 * and role materialisation then happen before anyone can use the organization,
 * since without role definitions every permission check inside it would resolve
 * to nothing. A failure at any point removes the local row rather than leaving
 * a workspace that looks real and grants nothing.
 */
export async function createOrg(input: CreateOrgInput, userId: string) {
  const existing = await orgDao.findOrgBySlug(input.slug);
  if (existing) {
    throw createError(400, 'Organization slug already exists');
  }

  const org = await orgDao.createOrg({
    name: input.name,
    slug: input.slug,
    industry: input.industry ?? null,
    ownerId: userId,
    provisioningStatus: 'PROVISIONING',
  });

  let ownerRoleId: string;
  try {
    await provisionOrg(org.id, org.name);
    ownerRoleId = await resolveRoleId(DEFAULT_ORG_OWNER_ROLE, org.id);
  } catch (error: any) {
    await orgDao.deleteOrg(org.id).catch(cleanupError => {
      logger.error('OrgService --> createOrg --> cleanup failed', {
        orgId: org.id,
        message: cleanupError?.message,
      });
    });
    invalidateRoleCache(org.id);
    logger.error('OrgService --> createOrg --> provisioning failed', {
      slug: input.slug,
      message: error?.message,
    });
    throw createError(
      error?.statusCode && error.statusCode < 500 ? error.statusCode : 502,
      `Could not set up the organization: ${error?.message ?? 'user-management service unavailable'}`
    );
  }

  await orgDao.createOrgMember(org.id, userId, DEFAULT_ORG_OWNER_ROLE, ownerRoleId, null);

  // Every organization starts with a General team, so a new form always has a
  // team to belong to and is never governed by nothing.
  await createDefaultTeam(org.id, userId);

  await orgDao.setOrgProvisioningStatus(org.id, 'ACTIVE');
  mirrorMember(org.id, userId, DEFAULT_ORG_OWNER_ROLE);

  invalidatePermissions(userId, org.id);
  logger.info('OrgService --> createOrg', { orgId: org.id, ownerId: userId });
  return { ...org, provisioningStatus: 'ACTIVE' };
}

export async function listOrgs(userId: string) {
  const [owned, member] = await Promise.all([
    orgDao.findOwnedOrgsByUserId(userId),
    orgDao.findMemberOrgsByUserId(userId),
  ]);

  // The owner now also has an OrgUser row, so the two lists overlap. Membership
  // carries the real role, so let it win.
  const byId = new Map<string, any>();
  for (const org of owned) {
    byId.set(org.id, { ...org, role: ROLES.OWNER, isOwner: true });
  }
  for (const entry of member) {
    const existing = byId.get(entry.org.id);
    byId.set(entry.org.id, {
      ...entry.org,
      role: entry.role,
      isOwner: existing?.isOwner ?? false,
    });
  }
  return [...byId.values()];
}

export async function getOrg(orgId: string) {
  const org = await orgDao.findOrgById(orgId);
  if (!org) {
    throw createError(404, 'Organization not found');
  }
  return org;
}

export async function updateOrg(orgId: string, _userId: string, data: UpdateOrgInput) {
  // Authorization happens in requirePermission(MANAGE_ORG) on the route.
  const org = await orgDao.findOrgOwnerById(orgId);
  if (!org) {
    throw createError(404, 'Organization not found');
  }
  return orgDao.updateOrg(orgId, data);
}

export async function deleteOrg(orgId: string, _userId: string) {
  const org = await orgDao.findOrgOwnerById(orgId);
  if (!org) {
    throw createError(404, 'Organization not found');
  }

  // The user-management service refuses to delete an organization while role
  // assignments still reference it, so the members are captured before the
  // local cascade removes them and the unwind runs in the background.
  const withUsers = await orgDao.findOrgWithUsersById(orgId);
  const memberIds = withUsers?.users.map(u => u.user.id) ?? [];

  await orgDao.setOrgProvisioningStatus(orgId, 'DELETING');
  if (UMS_ROLE_MIRROR_ENABLED) {
    await cancelPendingFor(orgId);
    await enqueueQuietly('ORG_DELETE', orgId, { memberIds });
  }

  // Teams and memberships all live in this database and cascade away with the
  // organization row.
  await orgDao.deleteOrg(orgId);
  invalidatePermissions(undefined, orgId);
  invalidateRoleCache(orgId);

  return { message: 'Organization deleted successfully' };
}

export async function listOrgUsers(orgId: string) {
  const org = await orgDao.findOrgWithUsersById(orgId);
  if (!org) {
    throw createError(404, 'Organization not found');
  }
  return org.users.map(u => ({
    ...u.user,
    role: u.role,
    roleId: u.roleId,
    joinedAt: u.joinedAt,
    isOwner: u.user.id === org.ownerId,
  }));
}

/**
 * Refuse to leave an organization with nobody who can administer it.
 *
 * `nextRole` is the role the target is moving to, or null when they are being
 * removed outright. Naming who else could be promoted turns a dead end into an
 * instruction.
 */
async function assertNotLastAdmin(
  orgId: string,
  targetUserId: string,
  nextRole: string | null
): Promise<void> {
  const adminRoles = await rolesGrantingAdmin(orgId);
  if (nextRole !== null && adminRoles.includes(nextRole)) return;

  const org = await orgDao.findOrgWithUsersById(orgId);
  if (!org) return;

  const admins = org.users.filter(u => adminRoles.includes(u.role));
  const remaining = admins.filter(u => u.user.id !== targetUserId);
  if (remaining.length > 0) return;

  const candidates = org.users
    .filter(u => u.user.id !== targetUserId)
    .slice(0, 3)
    .map(u => u.user.email);

  throw createError(
    400,
    candidates.length
      ? `This is the only administrator left. Promote someone else first — for example ${candidates.join(', ')}.`
      : 'This is the only member of the organization and cannot be removed.'
  );
}

/** Change a member's organization-level role. */
export async function updateOrgUserRole(
  orgId: string,
  targetUserId: string,
  role: string
) {
  const roleName = await assertOrgRole(role, orgId);

  const org = await orgDao.findOrgOwnerById(orgId);
  if (!org) {
    throw createError(404, 'Organization not found');
  }
  const member = await orgDao.findOrgMember(orgId, targetUserId);
  if (!member) {
    throw createError(404, 'User is not a member of this organization');
  }
  if (targetUserId === org.ownerId && roleName !== ROLES.OWNER) {
    throw createError(400, 'The organization owner must keep the Owner role');
  }

  await assertNotLastAdmin(orgId, targetUserId, roleName);

  const roleId = await resolveRoleId(roleName, orgId);
  await orgDao.updateOrgMemberRole(orgId, targetUserId, roleName, roleId);
  invalidatePermissions(targetUserId, orgId);
  mirrorMember(orgId, targetUserId, roleName);

  return { message: 'Role updated successfully', role: roleName };
}

/**
 * Remove a member from the organization, including every team they belonged to
 * and every role assignment those memberships carried.
 */
export async function removeUser(orgId: string, _requesterId: string, targetUserId: string) {
  const org = await orgDao.findOrgOwnerById(orgId);
  if (!org) {
    throw createError(404, 'Organization not found');
  }
  if (targetUserId === org.ownerId) {
    throw createError(400, 'Cannot remove the organization owner');
  }
  const member = await orgDao.findOrgMember(orgId, targetUserId);
  if (!member) {
    throw createError(404, 'User is not a member of this organization');
  }

  await assertNotLastAdmin(orgId, targetUserId, null);

  // Leaving the org means leaving every team in it.
  const teamIds = await teamDao.deleteMembershipsForUserInOrg(orgId, targetUserId);
  await orgDao.deleteOrgMember(orgId, targetUserId);
  invalidatePermissions(targetUserId, orgId);
  if (UMS_ROLE_MIRROR_ENABLED) {
    void enqueueQuietly('MEMBER_REMOVE', orgId, { userId: targetUserId });
  }

  logger.info('OrgService --> removeUser', { orgId, targetUserId, teamsLeft: teamIds.length });
  return { message: 'User removed successfully' };
}
