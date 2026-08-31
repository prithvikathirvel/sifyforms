import { teamDao } from '../dao/factory/teamDao.factory';
import { formDao } from '../dao/factory/formDao.factory';
import { orgDao } from '../dao/factory/orgDao.factory';
import { TeamRecord } from '../dao/interfaces/TeamDao';
import { invalidatePermissions } from './permission.service';
import { createError } from '../utils/errors';
import { generateSlug } from '../utils/slug';
import logger from '../utils/logger';

/**
 * Teams.
 *
 * Teams are flat organizational buckets: they group forms and act as targets for
 * per-form sharing. They carry no permissions of their own — a user's access is
 * governed entirely by their organization role, plus explicit form shares.
 */

async function loadTeamInOrg(orgId: string, teamId: string): Promise<TeamRecord> {
  const team = await teamDao.findTeamById(teamId);
  if (!team || team.orgId !== orgId) {
    throw createError(404, 'Team not found');
  }
  return team;
}

/**
 * The team every organization starts with.
 *
 * Without it a newly created form would have no team to group under. Created
 * directly rather than through `createTeam` because the org has no members yet
 * whose permissions could be checked.
 */
export async function createDefaultTeam(orgId: string, ownerId: string) {
  const existing = await teamDao.findDefaultTeam(orgId);
  if (existing) return existing;

  const created = await teamDao.createTeam({
    orgId,
    name: 'General',
    slug: 'general',
    description: 'Default team. Forms without a team of their own live here.',
    isDefault: true,
    createdBy: ownerId,
  });
  return created;
}

export async function createTeam(
  orgId: string,
  creatorId: string,
  input: { name: string; slug?: string; description?: string }
) {
  const org = await orgDao.findOrgById(orgId);
  if (!org) {
    throw createError(404, 'Organization not found');
  }

  const slug = generateSlug(input.slug || input.name);
  if (!slug) {
    throw createError(400, 'Team name must contain at least one alphanumeric character');
  }
  const clash = await teamDao.findTeamBySlug(orgId, slug);
  if (clash) {
    throw createError(400, `A team with the URL "${slug}" already exists in this organization`);
  }

  const team = await teamDao.createTeam({
    orgId,
    name: input.name.trim(),
    slug,
    description: input.description?.trim() || null,
    createdBy: creatorId,
  });

  logger.info('TeamService --> createTeam', { orgId, teamId: team.id });
  return team;
}

/** The org's teams as a flat list. */
export async function listTeams(orgId: string) {
  return teamDao.findTeamsByOrg(orgId);
}

export async function getTeam(orgId: string, teamId: string) {
  const team = await loadTeamInOrg(orgId, teamId);
  const members = await teamDao.findMembers(teamId);
  return { ...team, members };
}

export async function updateTeam(
  orgId: string,
  teamId: string,
  data: { name?: string; description?: string | null }
) {
  await loadTeamInOrg(orgId, teamId);
  return teamDao.updateTeam(teamId, {
    ...(data.name !== undefined ? { name: data.name.trim() } : {}),
    ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
  });
}

/**
 * Delete a team. Forms outlive the team that held them — re-home them on the
 * General team rather than letting them fall out of every grouping.
 */
export async function deleteTeam(orgId: string, teamId: string) {
  const team = await loadTeamInOrg(orgId, teamId);

  if (team.isDefault) {
    throw createError(400, 'The General team cannot be deleted — it is where forms without a team live.');
  }

  const fallback = await teamDao.findDefaultTeam(orgId);
  const formsMoved = await formDao.reassignFormsToTeam(team.id, fallback?.id ?? null);
  await teamDao.deleteTeam(team.id);

  invalidatePermissions(undefined, orgId);
  logger.info('TeamService --> deleteTeam', { orgId, teamId, formsMoved });
  return {
    message:
      formsMoved > 0
        ? `Team deleted. ${formsMoved} form(s) moved to General.`
        : 'Team deleted successfully',
    formsMoved,
  };
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

export async function listMembers(orgId: string, teamId: string) {
  await loadTeamInOrg(orgId, teamId);
  return teamDao.findMembers(teamId);
}

/**
 * Add a user to a team. Team membership carries no role — it only places the
 * user in the team (for grouping and team-targeted sharing).
 */
export async function addMember(
  orgId: string,
  teamId: string,
  actorId: string,
  userId: string
) {
  await loadTeamInOrg(orgId, teamId);

  // Team membership is only meaningful for people already in the organization.
  const org = await orgDao.findOrgById(orgId);
  const orgMember = await orgDao.findOrgMember(orgId, userId);
  if (!orgMember && org?.ownerId !== userId) {
    throw createError(400, 'User is not a member of this organization');
  }

  const member = await teamDao.upsertMember({
    teamId,
    userId,
    addedBy: actorId,
  });

  logger.info('TeamService --> addMember', { orgId, teamId, userId });
  return member;
}

export async function removeMember(orgId: string, teamId: string, userId: string) {
  await loadTeamInOrg(orgId, teamId);
  const member = await teamDao.findMember(teamId, userId);
  if (!member) {
    throw createError(404, 'User is not a member of this team');
  }

  await teamDao.deleteMember(teamId, userId);
  return { message: 'Member removed from team' };
}

/** Teams the given user belongs to within one organization. */
export async function listTeamsForUser(orgId: string, userId: string) {
  return teamDao.findTeamsForUser(orgId, userId);
}
