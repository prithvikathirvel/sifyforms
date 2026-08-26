import { formShareDao } from '../dao/factory/formShareDao.factory';
import { teamDao } from '../dao/factory/teamDao.factory';
import { orgDao } from '../dao/factory/orgDao.factory';
import { RESPONSE_LEVELS, ResponseLevel } from '../config/rbac.config';
import { loadForm } from './formAccess.service';
import { createError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Per-form sharing: the exception path around roles.
 *
 * Roles set a baseline, but real work is full of one-offs - a contractor for six
 * weeks, an executive who wants one report. Without this, administrators solve
 * those by granting permanent roles, and the access list stops reflecting who
 * actually needs access.
 */

export interface ShareInput {
  principalType: 'USER' | 'TEAM';
  principalId: string;
  level: string;
  canEdit?: boolean;
  /** ISO date. Omit for an indefinite share. */
  expiresAt?: string | null;
}

function assertLevel(level: string): ResponseLevel {
  if (!(RESPONSE_LEVELS as readonly string[]).includes(level)) {
    throw createError(400, `Unknown access level "${level}". Expected one of: ${RESPONSE_LEVELS.join(', ')}`);
  }
  return level as ResponseLevel;
}

function parseExpiry(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw createError(400, 'expiresAt must be a valid date');
  }
  if (date.getTime() <= Date.now()) {
    throw createError(400, 'expiresAt must be in the future');
  }
  return date;
}

export async function listShares(formId: string, orgId: string) {
  await loadForm(formId, orgId);
  const shares = await formShareDao.findSharesByForm(formId);
  const now = Date.now();

  // Expired shares stay visible but are labelled, so an admin can see what
  // lapsed rather than wondering why someone lost access.
  return shares.map(share => ({
    ...share,
    isExpired: !!share.expiresAt && share.expiresAt.getTime() <= now,
  }));
}

export async function createShare(
  formId: string,
  orgId: string,
  actorId: string,
  input: ShareInput
) {
  await loadForm(formId, orgId);
  const level = assertLevel(input.level);
  const expiresAt = parseExpiry(input.expiresAt);

  // A share must name someone who is actually in this organization; otherwise it
  // is a grant to a stranger that nobody will ever notice.
  if (input.principalType === 'USER') {
    const member = await orgDao.findOrgMember(orgId, input.principalId);
    if (!member) throw createError(400, 'That person is not a member of this organization');
  } else if (input.principalType === 'TEAM') {
    const team = await teamDao.findTeamById(input.principalId);
    if (!team || team.orgId !== orgId) throw createError(404, 'Team not found');
  } else {
    throw createError(400, 'principalType must be USER or TEAM');
  }

  const share = await formShareDao.upsertShare({
    formId,
    principalType: input.principalType,
    principalId: input.principalId,
    level,
    canEdit: input.canEdit ?? false,
    expiresAt,
    createdBy: actorId,
  });

  logger.info('FormShareService --> createShare', {
    formId,
    principalType: input.principalType,
    level,
    expiresAt,
  });
  return share;
}

export async function revokeShare(formId: string, orgId: string, shareId: string) {
  await loadForm(formId, orgId);
  const share = await formShareDao.findShareById(shareId);
  if (!share || share.formId !== formId) {
    throw createError(404, 'Share not found');
  }
  await formShareDao.deleteShare(shareId);
  return { message: 'Access revoked' };
}

/** Forms shared directly with this user, or with a team they belong to. */
export async function listFormsSharedWithUser(orgId: string, userId: string): Promise<string[]> {
  const memberships = await teamDao.findTeamsForUser(orgId, userId);
  return formShareDao.findFormIdsSharedWith(
    userId,
    memberships.map(m => m.teamId),
    new Date()
  );
}
