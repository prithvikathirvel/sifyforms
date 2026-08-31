import { inviteDao } from '../dao/factory/inviteDao.factory';
import { orgDao } from '../dao/factory/orgDao.factory';
import { userDao } from '../dao/factory/userDao.factory';
import { InviteStatus, InviteWithOrg } from '../dao/interfaces/InviteDao';
import {
  DEFAULT_ORG_MEMBER_ROLE,
} from '../config/rbac.config';
import { resolveRoleId } from './rbac.client';
import { assertRoleAssignable } from './role.service';
import { invalidatePermissions } from './permission.service';
import { createError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Organization invitations.
 *
 * Invites are addressed to an email, not a user id, so someone who has not
 * signed up yet can be invited; the invite surfaces on their first login and
 * membership is created only when they accept.
 *
 * There is no mail transport in this stack, so invites are delivered in-app.
 */

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

async function assertOrgRole(role: string): Promise<string> {
  await assertRoleAssignable(role);
  return role;
}

export async function createInvite(
  orgId: string,
  inviterId: string,
  email: string,
  role: string = DEFAULT_ORG_MEMBER_ROLE
) {
  const normalizedEmail = normalizeEmail(email);
  const roleName = await assertOrgRole(role);

  const org = await orgDao.findOrgById(orgId);
  if (!org) {
    throw createError(404, 'Organization not found');
  }

  // Someone already in the org does not need an invite.
  const existingUser = await userDao.findUserByEmail(normalizedEmail);
  if (existingUser) {
    const member = await orgDao.findOrgMember(orgId, existingUser.id);
    if (member || org.ownerId === existingUser.id) {
      throw createError(400, 'User is already a member of this organization');
    }
  }

  const existingInvite = await inviteDao.findInviteByOrgAndEmail(orgId, normalizedEmail);
  if (existingInvite?.inviteStatus === 'PENDING') {
    throw createError(400, 'An invitation for this email is already pending');
  }

  // Resolve the role up front: a dangling roleId would only surface at accept
  // time, long after the admin could do anything about it.
  const roleId = await resolveRoleId(roleName);

  const invite = await inviteDao.upsertInvite({
    email: normalizedEmail,
    orgId,
    roleId,
    role: roleName,
    invitedBy: inviterId,
  });

  logger.info('InviteService --> createInvite', { orgId, email: normalizedEmail, role: roleName });
  return invite;
}

export async function listOrgInvites(orgId: string, status?: InviteStatus) {
  return inviteDao.findInvitesByOrg(orgId, status);
}

/** Pending invites addressed to the signed-in user, for the org-chooser screen. */
export async function listMyInvites(email: string): Promise<InviteWithOrg[]> {
  return inviteDao.findInvitesByEmail(normalizeEmail(email), 'PENDING');
}

export async function revokeInvite(orgId: string, inviteId: string) {
  const invite = await inviteDao.findInviteById(inviteId);
  if (!invite || invite.orgId !== orgId) {
    throw createError(404, 'Invitation not found');
  }
  if (invite.inviteStatus !== 'PENDING') {
    throw createError(400, `Invitation is already ${invite.inviteStatus.toLowerCase()}`);
  }
  await inviteDao.updateInviteStatus(inviteId, 'REVOKED');
  return { message: 'Invitation revoked' };
}

/**
 * Accept an invite, turning it into a membership. The membership row carries the
 * role, so this is a single local write.
 */
export async function acceptInvite(inviteId: string, userId: string, userEmail: string) {
  const invite = await inviteDao.findInviteById(inviteId);
  if (!invite) {
    throw createError(404, 'Invitation not found');
  }
  if (invite.email !== normalizeEmail(userEmail)) {
    throw createError(403, 'This invitation was sent to a different email address');
  }
  if (invite.inviteStatus !== 'PENDING') {
    throw createError(400, `Invitation is already ${invite.inviteStatus.toLowerCase()}`);
  }

  const alreadyMember = await orgDao.findOrgMember(invite.orgId, userId);
  if (alreadyMember) {
    // Membership exists but the invite was never closed out; settle it and move on.
    await inviteDao.updateInviteStatus(inviteId, 'ACCEPTED');
    return { message: 'You are already a member of this organization', org: invite.org };
  }

  const roleName = invite.role || DEFAULT_ORG_MEMBER_ROLE;
  const roleId = invite.roleId ?? (await resolveRoleId(roleName));

  // One local write: the membership row IS the role assignment.
  await orgDao.createOrgMember(invite.orgId, userId, roleName, roleId, invite.invitedBy);
  await inviteDao.updateInviteStatus(inviteId, 'ACCEPTED');
  invalidatePermissions(userId, invite.orgId);

  logger.info('InviteService --> acceptInvite', { inviteId, userId, orgId: invite.orgId });
  return { message: 'Invitation accepted', org: invite.org, role: roleName };
}

export async function rejectInvite(inviteId: string, userEmail: string) {
  const invite = await inviteDao.findInviteById(inviteId);
  if (!invite) {
    throw createError(404, 'Invitation not found');
  }
  if (invite.email !== normalizeEmail(userEmail)) {
    throw createError(403, 'This invitation was sent to a different email address');
  }
  if (invite.inviteStatus !== 'PENDING') {
    throw createError(400, `Invitation is already ${invite.inviteStatus.toLowerCase()}`);
  }
  await inviteDao.updateInviteStatus(inviteId, 'REJECTED');
  return { message: 'Invitation declined' };
}
