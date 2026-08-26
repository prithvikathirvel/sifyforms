import { teamDao } from '../dao/factory/teamDao.factory';
import { formDao } from '../dao/factory/formDao.factory';
import { orgDao } from '../dao/factory/orgDao.factory';
import { TeamRecord, TeamWithCounts } from '../dao/interfaces/TeamDao';
import {
  DEFAULT_TEAM_ROLE,
  DEFAULT_TEAM_MEMBER_ROLE,
  MAX_TEAM_DEPTH,
  TEAM_SCOPE_ROLES,
  RoleName,
} from '../config/rbac.config';
import { resolveRoleId } from './rbac.client';
import { assertRoleAssignable } from './role.service';
import { invalidatePermissions } from './permission.service';
import { createError } from '../utils/errors';
import { generateSlug } from '../utils/slug';
import logger from '../utils/logger';

/**
 * Teams, including nesting.
 *
 * Each team stores a materialized `path` of ancestor ids ending in its own id.
 * That single column answers "who is above me" (for inherited permissions) and
 * "what is below me" (for subtree operations) without recursive queries.
 */

export interface TeamNode extends TeamWithCounts {
  children: TeamNode[];
}

async function assertTeamRole(role: string): Promise<string> {
  await assertRoleAssignable(role, 'TEAM');
  return role;
}

async function loadTeamInOrg(orgId: string, teamId: string): Promise<TeamRecord> {
  const team = await teamDao.findTeamById(teamId);
  if (!team || team.orgId !== orgId) {
    throw createError(404, 'Team not found');
  }
  return team;
}

// ---------------------------------------------------------------------------
// Teams
// ---------------------------------------------------------------------------

/**
 * The team every organization starts with.
 *
 * Without it a newly created form would have no team, and so no roles governing
 * it. Created directly rather than through `createTeam` because the org has no
 * members yet whose permissions could be checked.
 */
export async function createDefaultTeam(orgId: string, ownerId: string) {
  const existing = await teamDao.findDefaultTeam(orgId);
  if (existing) return existing;

  const created = await teamDao.createTeam({
    orgId,
    parentId: null,
    name: 'General',
    slug: 'general',
    description: 'Default team. Forms without a team of their own live here.',
    path: '',
    depth: 0,
    isDefault: true,
    createdBy: ownerId,
  });
  const team = await teamDao.setTeamPath(created.id, `/${created.id}`, 0);

  await teamDao.upsertMember({
    teamId: team.id,
    userId: ownerId,
    roleId: null,
    role: DEFAULT_TEAM_ROLE,
    addedBy: ownerId,
  });
  invalidatePermissions(ownerId, orgId);
  return team;
}

export async function createTeam(
  orgId: string,
  creatorId: string,
  input: { name: string; slug?: string; description?: string; parentId?: string | null }
) {
  const org = await orgDao.findOrgById(orgId);
  if (!org) {
    throw createError(404, 'Organization not found');
  }

  let parent: TeamRecord | null = null;
  if (input.parentId) {
    parent = await loadTeamInOrg(orgId, input.parentId);
    if (parent.depth + 1 > MAX_TEAM_DEPTH) {
      throw createError(
        400,
        `Teams cannot nest more than ${MAX_TEAM_DEPTH} levels below a root team`
      );
    }
  }

  const slug = generateSlug(input.slug || input.name);
  if (!slug) {
    throw createError(400, 'Team name must contain at least one alphanumeric character');
  }
  const clash = await teamDao.findTeamBySlug(orgId, slug);
  if (clash) {
    throw createError(400, `A team with the URL "${slug}" already exists in this organization`);
  }

  // `path` needs the team's own id, which only exists after the insert; write a
  // placeholder, then fix it up. Two statements, but no id generation here.
  const created = await teamDao.createTeam({
    orgId,
    parentId: parent?.id ?? null,
    name: input.name.trim(),
    slug,
    description: input.description?.trim() || null,
    path: '',
    depth: parent ? parent.depth + 1 : 0,
    createdBy: creatorId,
  });

  const path = `${parent ? parent.path : ''}/${created.id}`;
  const team = await teamDao.setTeamPath(created.id, path, created.depth);

  // The creator leads the team they created - the stated team default.
  const leadRoleId = await resolveRoleId(DEFAULT_TEAM_ROLE);
  await teamDao.upsertMember({
    teamId: team.id,
    userId: creatorId,
    roleId: leadRoleId,
    role: DEFAULT_TEAM_ROLE,
    addedBy: creatorId,
  });
  invalidatePermissions(creatorId, orgId);

  logger.info('TeamService --> createTeam', { orgId, teamId: team.id, parentId: parent?.id });
  return team;
}

/** The org's teams as a nested tree. */
export async function listTeams(orgId: string): Promise<TeamNode[]> {
  const teams = await teamDao.findTeamsByOrg(orgId);

  const nodes = new Map<string, TeamNode>();
  for (const team of teams) {
    nodes.set(team.id, { ...team, children: [] });
  }

  const roots: TeamNode[] = [];
  // findTeamsByOrg orders by path, so a parent is always seen before its children.
  for (const team of teams) {
    const node = nodes.get(team.id)!;
    const parent = team.parentId ? nodes.get(team.parentId) : undefined;
    if (parent) {
      parent.children.push(node);
    } else {
      roots.push(node);
    }
  }
  return roots;
}

export async function getTeam(orgId: string, teamId: string) {
  const team = await loadTeamInOrg(orgId, teamId);
  const [members, children] = await Promise.all([
    teamDao.findMembers(teamId),
    teamDao.findChildren(teamId),
  ]);
  return { ...team, members, children };
}

export async function updateTeam(
  orgId: string,
  teamId: string,
  data: { name?: string; description?: string | null }
) {
  await loadTeamInOrg(orgId, teamId);
  // `slug` and `path` are deliberately immutable: the path is referenced by every
  // descendant, and renaming a team should not invalidate permission lookups.
  return teamDao.updateTeam(teamId, {
    ...(data.name !== undefined ? { name: data.name.trim() } : {}),
    ...(data.description !== undefined ? { description: data.description?.trim() || null } : {}),
  });
}

/**
 * Delete a team. Sub-teams block the delete unless `cascade` is set, in which
 * case the whole subtree goes - deepest first, so no parent is removed while a
 * child still references it.
 */
export async function deleteTeam(orgId: string, teamId: string, cascade = false) {
  const team = await loadTeamInOrg(orgId, teamId);
  const subtree = await teamDao.findSubtree(orgId, team.path);
  const descendants = subtree.filter(t => t.id !== teamId);

  if (descendants.length > 0 && !cascade) {
    throw createError(
      400,
      `This team has ${descendants.length} sub-team(s). Delete or move them first, or pass cascade=true.`
    );
  }

  if (team.isDefault) {
    throw createError(400, 'The General team cannot be deleted — it is where forms without a team live.');
  }

  // Forms outlive the team that held them. Re-home them on the General team
  // rather than letting them fall out of every permission scope.
  const fallback = await teamDao.findDefaultTeam(orgId);

  // Deepest first, so no parent is removed while a child still references it.
  // Memberships cascade with each team row.
  const ordered = [...subtree].sort((a, b) => b.depth - a.depth);
  let formsMoved = 0;
  for (const node of ordered) {
    formsMoved += await formDao.reassignFormsToTeam(node.id, fallback?.id ?? null);
    await teamDao.deleteTeam(node.id);
  }

  invalidatePermissions(undefined, orgId);
  logger.info('TeamService --> deleteTeam', { orgId, teamId, removed: ordered.length, formsMoved });
  return {
    message:
      formsMoved > 0
        ? `Team deleted. ${formsMoved} form(s) moved to General.`
        : 'Team deleted successfully',
    removed: ordered.length,
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
 * Add a user to a team, or change the role they already hold there.
 *
 * The `@@unique([teamId, userId])` key is what enforces one role per person per
 * team; holding a different role in another team is fine.
 */
export async function addMember(
  orgId: string,
  teamId: string,
  actorId: string,
  userId: string,
  role: string = DEFAULT_TEAM_MEMBER_ROLE
) {
  await loadTeamInOrg(orgId, teamId);
  const roleName = await assertTeamRole(role);

  // Team membership is only meaningful for people already in the organization.
  const org = await orgDao.findOrgById(orgId);
  const orgMember = await orgDao.findOrgMember(orgId, userId);
  if (!orgMember && org?.ownerId !== userId) {
    throw createError(400, 'User is not a member of this organization');
  }

  const roleId = await resolveRoleId(roleName);
  const member = await teamDao.upsertMember({
    teamId,
    userId,
    roleId,
    role: roleName,
    addedBy: actorId,
  });
  invalidatePermissions(userId, orgId);

  logger.info('TeamService --> addMember', { orgId, teamId, userId, role: roleName });
  return member;
}

export async function updateMemberRole(
  orgId: string,
  teamId: string,
  actorId: string,
  userId: string,
  role: string
) {
  const existing = await teamDao.findMember(teamId, userId);
  if (!existing) {
    throw createError(404, 'User is not a member of this team');
  }
  return addMember(orgId, teamId, actorId, userId, role);
}

export async function removeMember(orgId: string, teamId: string, userId: string) {
  await loadTeamInOrg(orgId, teamId);
  const member = await teamDao.findMember(teamId, userId);
  if (!member) {
    throw createError(404, 'User is not a member of this team');
  }

  await teamDao.deleteMember(teamId, userId);
  invalidatePermissions(userId, orgId);

  return { message: 'Member removed from team' };
}

/** Teams the given user belongs to within one organization. */
export async function listTeamsForUser(orgId: string, userId: string) {
  return teamDao.findTeamsForUser(orgId, userId);
}
