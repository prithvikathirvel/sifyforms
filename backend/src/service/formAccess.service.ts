import { formDao } from '../dao/factory/formDao.factory';
import { teamDao } from '../dao/factory/teamDao.factory';
import { formShareDao } from '../dao/factory/formShareDao.factory';
import { FormOwnershipRecord } from '../dao/interfaces/FormDao';
import {
  ACTIONS,
  ACTION_TO_LEVEL,
  Action,
  POLICY_CEILING,
  RESPONSE_LEVEL_RANK,
  ResponseLevel,
  ResponsePolicy,
  maxResponseLevel,
  meetsLevel,
} from '../config/rbac.config';
import { getEffectivePermissions, ancestryFromPath } from './permission.service';
import { createError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Access to one particular form.
 *
 * Three things combine, and they are deliberately resolved in this order:
 *
 *   1. Roles - organization-wide, plus every team from the form's owning team
 *      up to the root. The strongest wins.
 *   2. Shares - an explicit grant on this one form, to the person or to a team
 *      they belong to. Also strongest-wins, so a share can only add access.
 *   3. The form's own response policy - a *ceiling*, applied last. A survey that
 *      promised anonymity stays anonymous no matter who is asking.
 *
 * Step 3 is what makes the promise on the public form real rather than a note.
 */

export interface FormAccess {
  formId: string;
  /** How much of a response this user may see, after the policy ceiling. */
  level: ResponseLevel;
  canEdit: boolean;
  canDelete: boolean;
  canPublish: boolean;
  canShare: boolean;
  canMove: boolean;
  canDeleteResponses: boolean;
  policy: ResponsePolicy;
  /** Why this access was granted, for the UI to explain itself. */
  reasons: string[];
}

function policyOf(form: FormOwnershipRecord): ResponsePolicy {
  const value = form.responsePolicy as ResponsePolicy;
  return value in POLICY_CEILING ? value : 'STANDARD';
}

/** The highest response tier a set of granted actions amounts to. */
function levelFromActions(actions: string[]): ResponseLevel {
  let level: ResponseLevel = 'NONE';
  for (const action of actions) {
    const mapped = ACTION_TO_LEVEL[action];
    if (mapped) level = maxResponseLevel(level, mapped);
  }
  return level;
}

export async function loadForm(formId: string, orgId: string): Promise<FormOwnershipRecord> {
  const form = await formDao.findFormOwnership(formId);
  if (!form || form.orgId !== orgId) {
    throw createError(404, 'Form not found');
  }
  return form;
}

/**
 * Resolve what `userId` may do with `formId`.
 *
 * Deliberately not cached: it depends on the form's team, its policy and its
 * shares, all of which change independently of the role cache underneath it.
 * The expensive part - role resolution - is cached in permission.service.
 */
export async function getFormAccess(
  userId: string,
  orgId: string,
  formId: string
): Promise<FormAccess> {
  const form = await loadForm(formId, orgId);
  const policy = policyOf(form);
  const reasons: string[] = [];

  // --- 1. roles, evaluated against the form's own team -----------------------
  const permissions = await getEffectivePermissions(userId, orgId, form.teamId ?? undefined);
  let level = levelFromActions(permissions.actions);
  let canEdit = permissions.actions.includes(ACTIONS.EDIT_FORM);
  let canDelete = permissions.actions.includes(ACTIONS.DELETE_FORM);
  const canPublish = permissions.actions.includes(ACTIONS.PUBLISH_FORM);
  const canShare = permissions.actions.includes(ACTIONS.SHARE_FORM);
  const canMove = permissions.actions.includes(ACTIONS.MOVE_FORM);
  let canDeleteResponses = permissions.actions.includes(ACTIONS.DELETE_RESPONSES);

  if (permissions.roles.length) {
    reasons.push(`${permissions.roles[permissions.roles.length - 1]} on this organization or team`);
  }

  // --- 2. explicit shares on this form --------------------------------------
  const memberships = await teamDao.findTeamsForUser(orgId, userId);
  const teamIds = memberships.map(m => m.teamId);
  const shares = await formShareDao.findActiveSharesForPrincipals(
    formId,
    userId,
    teamIds,
    new Date()
  );

  for (const share of shares) {
    const shared = share.level as ResponseLevel;
    if (shared in RESPONSE_LEVEL_RANK) {
      level = maxResponseLevel(level, shared);
    }
    if (share.canEdit) canEdit = true;
    reasons.push(
      share.principalType === 'USER'
        ? 'shared directly with you'
        : 'shared with a team you belong to'
    );
  }

  // --- 3. the form's policy, as a ceiling -----------------------------------
  const ceiling = POLICY_CEILING[policy];
  if (RESPONSE_LEVEL_RANK[level] > RESPONSE_LEVEL_RANK[ceiling]) {
    level = ceiling;
    reasons.push(`limited to ${ceiling.toLowerCase()} by this form's ${policy} policy`);
  }

  // RESTRICTED means role alone is never enough - only principals named on the
  // form get past it. Organization admins included: that is the point.
  if (policy === 'RESTRICTED' && shares.length === 0) {
    level = 'NONE';
    reasons.push('this form is restricted to people named on it');
  }

  // Deleting responses would defeat an anonymity promise by attrition, and it
  // is meaningless to someone who cannot read them.
  if (!meetsLevel(level, 'FULL')) {
    canDeleteResponses = false;
  }

  return {
    formId,
    level,
    canEdit,
    canDelete,
    canPublish,
    canShare,
    canMove,
    canDeleteResponses,
    policy,
    reasons,
  };
}

/** Throws 403 unless the user's response access reaches `required`. */
export async function assertResponseLevel(
  userId: string,
  orgId: string,
  formId: string,
  required: ResponseLevel
): Promise<FormAccess> {
  const access = await getFormAccess(userId, orgId, formId);
  if (!meetsLevel(access.level, required)) {
    logger.warn('Response access denied', { userId, formId, required, held: access.level, policy: access.policy });
    throw createError(
      403,
      access.policy === 'ANONYMOUS'
        ? 'This form is anonymous — individual responses are not viewable by anyone, including administrators.'
        : `You need ${required.toLowerCase()} access to this form's responses; you have ${access.level.toLowerCase()}.`
    );
  }
  return access;
}

/** Throws 403 unless the user may perform a build-plane action on this form. */
export async function assertFormAction(
  userId: string,
  orgId: string,
  formId: string,
  action: Action
): Promise<FormAccess> {
  const access = await getFormAccess(userId, orgId, formId);
  const allowed: Record<string, boolean> = {
    [ACTIONS.EDIT_FORM]: access.canEdit,
    [ACTIONS.DELETE_FORM]: access.canDelete,
    [ACTIONS.PUBLISH_FORM]: access.canPublish,
    [ACTIONS.SHARE_FORM]: access.canShare,
    [ACTIONS.MOVE_FORM]: access.canMove,
    [ACTIONS.DELETE_RESPONSES]: access.canDeleteResponses,
  };
  if (!allowed[action]) {
    throw createError(403, `You do not have permission to perform this action (${action})`);
  }
  return access;
}

/**
 * Every team whose forms this user can reach: the teams they belong to, plus all
 * descendants of those teams, since a role inherits downward.
 */
export async function reachableTeamIds(orgId: string, userId: string): Promise<string[]> {
  const [memberships, allTeams] = await Promise.all([
    teamDao.findTeamsForUser(orgId, userId),
    teamDao.findTeamsByOrg(orgId),
  ]);
  if (memberships.length === 0) return [];

  const held = new Set(memberships.map(m => m.teamId));
  // A team is reachable when any of its ancestors (or itself) is held.
  return allTeams
    .filter(team => ancestryFromPath(team.path).some(id => held.has(id)))
    .map(team => team.id);
}
