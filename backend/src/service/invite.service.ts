import { inviteDao } from '../dao/factory/inviteDao.factory';
import { orgDao } from '../dao/factory/orgDao.factory';
import { userDao } from '../dao/factory/userDao.factory';
import { InviteStatus, InviteWithOrg } from '../dao/interfaces/InviteDao';
import {
  DEFAULT_ORG_MEMBER_ROLE,
} from '../config/rbac.config';
import { UMS_ROLE_MIRROR_ENABLED } from '../config/ums.config';
import { resolveRoleId } from './rbac.client';
import { enqueueQuietly } from './ums.outbox';
import { assertRoleAssignable, assignableRoleNames } from './role.service';
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

async function assertOrgRole(role: string, orgId: string): Promise<string> {
  await assertRoleAssignable(role, orgId);
  return role;
}

export async function createInvite(
  orgId: string,
  inviterId: string,
  email: string,
  role: string = DEFAULT_ORG_MEMBER_ROLE
) {
  const normalizedEmail = normalizeEmail(email);
  const roleName = await assertOrgRole(role, orgId);

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
  const roleId = await resolveRoleId(roleName, orgId);

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

/**
 * The outcome of a single row in a bulk invitation.
 *
 * `row` is the 1-based position in the list the admin submitted, which is the
 * only identifier they have for a line they typed. Reporting failures by email
 * alone is useless when the failure is that the email is unparseable.
 */
export interface BulkInviteRowResult {
  row: number;
  email: string;
  status: 'invited' | 'skipped' | 'failed';
  /** Present on skipped and failed rows; safe to show to the admin verbatim. */
  reason?: string;
}

export interface BulkInviteResult {
  invited: number;
  skipped: number;
  failed: number;
  results: BulkInviteRowResult[];
}

/*
 * Deliberately stricter than the browser's own `type="email"`, and deliberately
 * not RFC 5322. The full grammar accepts quoted local parts and bracketed IP
 * literals that no invite list ever contains and that would sail past a
 * hand-check; what an admin actually pastes are ordinary addresses with the
 * occasional stray comma, space or trailing semicolon. This rejects those.
 */
const EMAIL_PATTERN = /^[^\s@,;<>"']+@[^\s@,;<>"'.]+(\.[^\s@,;<>"'.]+)+$/;

/**
 * Invite many people at once.
 *
 * The governing decision is that this is not atomic and must not be. An admin
 * pasting sixty addresses will have a typo in one of them, and rolling back the
 * other fifty-nine to punish that typo is the behaviour of a system that has
 * confused correctness with usefulness. Each row succeeds or fails alone and
 * every outcome comes back described, so the admin can fix three lines and
 * re-paste rather than start again.
 *
 * "Already a member" and "already invited" are reported as *skipped*, not
 * failed. Re-pasting a list that overlaps with last week's is the normal way
 * this feature gets used, and the correct outcome — that person is in the org —
 * has already been achieved. Calling that an error trains people to ignore the
 * error count.
 *
 * Rows run sequentially. The lookups per row are cheap but they are writes
 * against a shared org, and firing 200 of them concurrently to save a second on
 * an action performed once a quarter is a bad trade against connection-pool
 * exhaustion.
 */
export async function createInvitesBulk(
  orgId: string,
  inviterId: string,
  rows: Array<{ email: string; role?: string }>,
  defaultRole: string = DEFAULT_ORG_MEMBER_ROLE
): Promise<BulkInviteResult> {
  const org = await orgDao.findOrgById(orgId);
  if (!org) {
    throw createError(404, 'Organization not found');
  }

  // Resolved once for the whole batch rather than once per row: the role list
  // cannot change mid-request, and this is the difference between one lookup
  // and two hundred.
  const assignable = await assignableRoleNames(orgId);
  const assignableSet = new Set(assignable.map((name) => name.toLowerCase()));

  const results: BulkInviteRowResult[] = [];
  // Duplicates *within the submitted list* are the most common paste error and
  // the server has to catch them: the second occurrence would otherwise
  // silently overwrite the first via upsert, with a different role.
  const seen = new Map<string, number>();

  for (let index = 0; index < rows.length; index += 1) {
    const raw = rows[index];
    const row = index + 1;
    const email = normalizeEmail(String(raw?.email ?? ''));

    if (!email) {
      results.push({ row, email: '', status: 'failed', reason: 'No email address on this line' });
      continue;
    }
    if (email.length > 320) {
      results.push({ row, email, status: 'failed', reason: 'Email address is too long' });
      continue;
    }
    if (!EMAIL_PATTERN.test(email)) {
      results.push({ row, email, status: 'failed', reason: 'Not a valid email address' });
      continue;
    }

    const firstSeenAt = seen.get(email);
    if (firstSeenAt !== undefined) {
      results.push({ row, email, status: 'skipped', reason: `Same address as line ${firstSeenAt}` });
      continue;
    }
    seen.set(email, row);

    const role = (raw?.role ?? '').trim() || defaultRole;
    if (!assignableSet.has(role.toLowerCase())) {
      results.push({
        row,
        email,
        status: 'failed',
        reason: `Role "${role}" is not one you can assign. Available: ${assignable.join(', ')}`,
      });
      continue;
    }
    // Use the canonical casing the org defined, not whatever was typed.
    const roleName = assignable.find((name) => name.toLowerCase() === role.toLowerCase()) as string;

    try {
      const existingUser = await userDao.findUserByEmail(email);
      if (existingUser) {
        const member = await orgDao.findOrgMember(orgId, existingUser.id);
        if (member || org.ownerId === existingUser.id) {
          results.push({ row, email, status: 'skipped', reason: 'Already a member of this organization' });
          continue;
        }
      }

      const existingInvite = await inviteDao.findInviteByOrgAndEmail(orgId, email);
      if (existingInvite?.inviteStatus === 'PENDING') {
        results.push({ row, email, status: 'skipped', reason: 'Already has a pending invitation' });
        continue;
      }

      const roleId = await resolveRoleId(roleName, orgId);
      await inviteDao.upsertInvite({ email, orgId, roleId, role: roleName, invitedBy: inviterId });
      results.push({ row, email, status: 'invited' });
    } catch (error) {
      // One row's failure is that row's failure. Anything unexpected is logged
      // with its position so it can be traced, and reported without leaking the
      // internals to the admin's screen: only a deliberate 4xx from our own
      // code carries a message safe to repeat back.
      logger.error('InviteService --> createInvitesBulk --> row failed', { orgId, row, email, error });
      const known = error as { statusCode?: number; message?: string };
      results.push({
        row,
        email,
        status: 'failed',
        reason: known?.statusCode && known.statusCode < 500 && known.message
          ? known.message
          : 'Could not be invited. Try this address again.',
      });
    }
  }

  const summary: BulkInviteResult = {
    invited: results.filter((entry) => entry.status === 'invited').length,
    skipped: results.filter((entry) => entry.status === 'skipped').length,
    failed: results.filter((entry) => entry.status === 'failed').length,
    results,
  };

  logger.info('InviteService --> createInvitesBulk', {
    orgId,
    total: rows.length,
    invited: summary.invited,
    skipped: summary.skipped,
    failed: summary.failed,
  });
  return summary;
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
  const roleId = invite.roleId ?? (await resolveRoleId(roleName, invite.orgId));

  // One local write: the membership row IS the role assignment.
  await orgDao.createOrgMember(invite.orgId, userId, roleName, roleId, invite.invitedBy);
  await inviteDao.updateInviteStatus(inviteId, 'ACCEPTED');
  invalidatePermissions(userId, invite.orgId);
  if (UMS_ROLE_MIRROR_ENABLED) {
    void enqueueQuietly('MEMBER_SYNC', invite.orgId, { userId, roleName });
  }

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
