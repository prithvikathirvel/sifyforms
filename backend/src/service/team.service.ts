import { teamDao } from '../dao/factory/teamDao.factory';
import { formDao } from '../dao/factory/formDao.factory';
import { orgDao } from '../dao/factory/orgDao.factory';
import { TeamRecord, TeamTreeNode, TeamWithCounts } from '../dao/interfaces/TeamDao';
import { invalidatePermissions } from './permission.service';
import { createError } from '../utils/errors';
import { generateSlug } from '../utils/slug';
import logger from '../utils/logger';

/**
 * Hierarchical Teams — Option B (top-down visibility).
 *
 * Teams form a tree via parentId. Depth is cached and capped.
 * Members of a parent implicitly see all descendants (for listing/visibility).
 * No role inheritance, no share inheritance — only visibility.
 */

const MAX_DEPTH = 10; // 0=root, up to 10 levels deep for flexible nesting

async function loadTeamInOrg(orgId: string, teamId: string): Promise<TeamRecord> {
  const team = await teamDao.findTeamById(teamId);
  if (!team || team.orgId !== orgId) {
    throw createError(404, 'Team not found');
  }
  return team;
}

/**
 * Walk up ancestors to detect cycle and collect path.
 * Returns ancestors array root->parent.
 */
async function getAncestorsChain(teamId: string): Promise<TeamRecord[]> {
  return teamDao.findAncestors(teamId);
}

/**
 * Check if potentialParent is a descendant of teamId (would create cycle).
 */
async function wouldCreateCycle(teamId: string, potentialParentId: string): Promise<boolean> {
  if (teamId === potentialParentId) return true;
  const descendants = await teamDao.findDescendants(teamId);
  return descendants.some(d => d.id === potentialParentId);
}

/**
 * The team every organization starts with.
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
    parentId: null,
    depth: 0,
    createdBy: ownerId,
  });
  return created;
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

  const slug = generateSlug(input.slug || input.name);
  if (!slug) {
    throw createError(400, 'Team name must contain at least one alphanumeric character');
  }
  const clash = await teamDao.findTeamBySlug(orgId, slug);
  if (clash) {
    // User-friendly message, no technical URL jargon
    throw createError(400, `A team named "${input.name.trim()}" already exists. Please choose a different name.`);
  }

  let parentId: string | null = null;
  let depth = 0;

  if (input.parentId) {
    const parent = await teamDao.findTeamById(input.parentId);
    if (!parent || parent.orgId !== orgId) {
      throw createError(404, 'Parent team not found in this organization');
    }
    if (parent.isDefault) {
      throw createError(400, 'You cannot add a sub-team under General. General is a system team.');
    }
    if (parent.depth >= MAX_DEPTH) {
      throw createError(400, `"${parent.name}" is already at the deepest level. You cannot add more sub-teams under it.`);
    }
    parentId = parent.id;
    depth = parent.depth + 1;
  }

  const team = await teamDao.createTeam({
    orgId,
    name: input.name.trim(),
    slug,
    description: input.description?.trim() || null,
    parentId,
    depth,
    createdBy: creatorId,
  });

  logger.info('TeamService --> createTeam', { orgId, teamId: team.id, parentId, depth });
  return team;
}

/** List teams — supports tree or flat format. 
 *  For Option B, non-owners see only effective teams (direct + descendants) to prevent child members seeing parent/sibling.
 *  If userId not provided or user is owner, returns all.
 */
export async function listTeams(orgId: string, format: 'tree' | 'flat' = 'flat', userId?: string): Promise<TeamWithCounts[] | TeamTreeNode[]> {
  if (!userId) {
    if (format === 'tree') return teamDao.findTeamsTree(orgId);
    return teamDao.findTeamsByOrg(orgId);
  }

  const org = await orgDao.findOrgById(orgId);
  if (!org) throw createError(404, 'Organization not found');

  // Owner sees all
  if (org.ownerId === userId) {
    if (format === 'tree') return teamDao.findTeamsTree(orgId);
    return teamDao.findTeamsByOrg(orgId);
  }

  // For non-owners, check if they have org-level admin that should see all?
  // For strict Option B, we filter to effective only. This fixes bug where Registration member sees ITEST and OS sibling.
  const effectiveIds = new Set(await listEffectiveTeamsForUser(orgId, userId));
  if (effectiveIds.size === 0) {
    return format === 'tree' ? [] : [];
  }

  if (format === 'tree') {
    const fullTree = await teamDao.findTeamsTree(orgId);
    // Filter tree to only effective branches, lifting effective children up if parent not effective
    function filterTree(nodes: TeamTreeNode[]): TeamTreeNode[] {
      const result: TeamTreeNode[] = [];
      for (const node of nodes) {
        const childrenFiltered = node.children ? filterTree(node.children) : [];
        if (effectiveIds.has(node.id)) {
          result.push({ ...node, children: childrenFiltered });
        } else {
          // If parent not effective but children are, lift children up (don't show parent)
          result.push(...childrenFiltered);
        }
      }
      return result;
    }
    return filterTree(fullTree);
  } else {
    const all = await teamDao.findTeamsByOrg(orgId);
    return all.filter(t => effectiveIds.has(t.id));
  }
}

export async function listTeamsTree(orgId: string, userId?: string): Promise<TeamTreeNode[]> {
  const result = await listTeams(orgId, 'tree', userId);
  return result as TeamTreeNode[];
}

export async function getTeam(orgId: string, teamId: string, requesterId?: string) {
  const team = await loadTeamInOrg(orgId, teamId);
  const org = await orgDao.findOrgById(orgId);

  // Enforce top-down visibility for non-owners
  if (requesterId && org && org.ownerId !== requesterId) {
    const effective = new Set(await listEffectiveTeamsForUser(orgId, requesterId));
    if (effective.size > 0 && !effective.has(teamId)) {
      throw createError(403, 'You do not have access to this team');
    }
  }

  const [members, ancestors, children] = await Promise.all([
    teamDao.findMembers(teamId),
    teamDao.findAncestors(teamId),
    teamDao.findDirectChildren(teamId),
  ]);

  // For breadcrumb display - filter ancestors to only effective for non-owners to avoid showing parent when child is member
  let filteredAncestors = ancestors;
  let breadcrumb: TeamRecord[] = [...ancestors, team];
  if (requesterId && org && org.ownerId !== requesterId) {
    const effective = new Set(await listEffectiveTeamsForUser(orgId, requesterId));
    if (effective.size > 0) {
      filteredAncestors = ancestors.filter(a => effective.has(a.id));
      breadcrumb = [...filteredAncestors, team];
    }
  }

  return { 
    ...team, 
    members, 
    ancestors: filteredAncestors,
    children: children.filter(c => {
      // For non-owners, children should be filtered to effective as well (parent sees descendants, but if child member, they see only their own descendants)
      // Actually for getTeam, children are direct children; if requester is member of this team, they should see children (top-down). If requester is owner, see all.
      return true;
    }),
    breadcrumb,
    path: breadcrumb.map(b => b.name).join(' > ')
  };
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
 * Move a team to a new parent (or root if null).
 * Handles cycle detection, depth validation, and subtree depth updates.
 */
export async function moveTeam(orgId: string, teamId: string, newParentId: string | null) {
  const team = await loadTeamInOrg(orgId, teamId);

  if (team.isDefault) {
    throw createError(400, 'General team cannot be moved. It always stays at the top level.');
  }

  if (newParentId === teamId) {
    throw createError(400, 'A team cannot be moved inside itself.');
  }

  // Moving to root
  if (!newParentId) {
    const delta = 0 - team.depth;
    const maxSubDepth = await teamDao.getMaxSubtreeDepth(teamId);
    if (maxSubDepth > MAX_DEPTH) {
      throw createError(400, 'This team has sub-teams that are too deep to move to the top level.');
    }
    await teamDao.moveTeamSubtree(teamId, null, delta);
    const updated = await teamDao.findTeamById(teamId);
    logger.info('TeamService --> moveTeam to root', { orgId, teamId });
    return updated;
  }

  // Moving under a parent
  const newParent = await loadTeamInOrg(orgId, newParentId);

  if (newParent.isDefault) {
    throw createError(400, 'You cannot move a team under General.');
  }

  if (await wouldCreateCycle(teamId, newParentId)) {
    throw createError(400, 'You cannot move a team inside one of its own sub-teams.');
  }

  if (newParent.depth >= MAX_DEPTH) {
    throw createError(400, `"${newParent.name}" is already at the deepest level. Choose a different parent.`);
  }

  const newDepth = newParent.depth + 1;
  const delta = newDepth - team.depth;

  // Check if subtree would exceed max depth after move
  const maxSubDepth = await teamDao.getMaxSubtreeDepth(teamId);
  if (newDepth + maxSubDepth > MAX_DEPTH) {
    throw createError(400, `Moving "${team.name}" under "${newParent.name}" would make some sub-teams too deep. Choose a higher level parent.`);
  }

  await teamDao.moveTeamSubtree(teamId, newParentId, delta);
  const updated = await teamDao.findTeamById(teamId);
  logger.info('TeamService --> moveTeam', { orgId, teamId, newParentId, delta });
  return updated;
}

/**
 * Delete a team.
 * mode: 'reparent' (default) - Re-parent its children to its own parent (or root). Forms go to General fallback.
 *       'cascade' - Delete team and all its sub-teams. Forms go to General.
 */
export async function deleteTeam(orgId: string, teamId: string, mode: 'reparent' | 'cascade' = 'reparent') {
  const team = await loadTeamInOrg(orgId, teamId);

  if (team.isDefault) {
    throw createError(400, 'General team cannot be deleted. It is where forms without a team live.');
  }

  const fallback = await teamDao.findDefaultTeam(orgId);
  const fallbackId = fallback?.id ?? null;

  if (mode === 'cascade') {
    // Delete all descendants + team
    const descendants = await teamDao.findDescendants(teamId);
    // Move all forms from team and descendants to fallback
    let totalFormsMoved = 0;
    const allTeamIds = [teamId, ...descendants.map(d => d.id)];
    for (const tId of allTeamIds) {
      const moved = await formDao.reassignFormsToTeam(tId, fallbackId);
      totalFormsMoved += moved;
    }
    // Delete descendants first (leaf first) to avoid FK issues, then team
    // Sort by depth descending
    const sorted = [...descendants].sort((a, b) => b.depth - a.depth);
    for (const d of sorted) {
      await teamDao.deleteTeam(d.id);
    }
    await teamDao.deleteTeam(team.id);

    invalidatePermissions(undefined, orgId);
    logger.info('TeamService --> deleteTeam cascade', { orgId, teamId, totalFormsMoved, deletedCount: allTeamIds.length });
    return {
      message: `Team and ${descendants.length} sub-team(s) deleted. ${totalFormsMoved} form(s) moved to General.`,
      formsMoved: totalFormsMoved,
      deletedCount: allTeamIds.length,
      mode: 'cascade',
    };
  }

  // Default reparent mode
  const children = await teamDao.findDirectChildren(teamId);

  // Re-parent children to team's parent, adjusting depth
  for (const child of children) {
    let newParentDepth = -1;
    if (team.parentId) {
      const parentOfDeleted = await teamDao.findTeamById(team.parentId);
      if (parentOfDeleted) newParentDepth = parentOfDeleted.depth;
    }
    const newDepth = newParentDepth + 1;
    const actualDelta = newDepth - child.depth;
    await teamDao.moveTeamSubtree(child.id, team.parentId || null, actualDelta);
  }

  const formsMoved = await formDao.reassignFormsToTeam(team.id, fallbackId);
  await teamDao.deleteTeam(team.id);

  invalidatePermissions(undefined, orgId);
  logger.info('TeamService --> deleteTeam reparent', { orgId, teamId, formsMoved, reparentedChildren: children.length });
  return {
    message:
      formsMoved > 0
        ? `Team deleted. ${formsMoved} form(s) moved to General. ${children.length} sub-team(s) moved up.`
        : children.length > 0
        ? `Team deleted. ${children.length} sub-team(s) moved up.`
        : 'Team deleted successfully',
    formsMoved,
    childrenReparented: children.length,
    mode: 'reparent',
  };
}

// ---------------------------------------------------------------------------
// Membership
// ---------------------------------------------------------------------------

export async function listMembers(orgId: string, teamId: string) {
  await loadTeamInOrg(orgId, teamId);
  return teamDao.findMembers(teamId);
}

export async function addMember(
  orgId: string,
  teamId: string,
  actorId: string,
  userId: string
) {
  await loadTeamInOrg(orgId, teamId);

  const org = await orgDao.findOrgById(orgId);
  const orgMember = await orgDao.findOrgMember(orgId, userId);
  if (!orgMember && org?.ownerId !== userId) {
    throw createError(400, 'This person is not part of your organization.');
  }

  const member = await teamDao.upsertMember({
    teamId,
    userId,
    addedBy: actorId,
  });

  logger.info('TeamService --> addMember', { orgId, teamId, userId });
  return member;
}

export async function addMembersBulk(
  orgId: string,
  teamId: string,
  actorId: string,
  userIds: string[]
) {
  await loadTeamInOrg(orgId, teamId);
  const org = await orgDao.findOrgById(orgId);
  if (!org) throw createError(404, 'Organization not found');

  const results: any[] = [];
  const errors: { userId: string; reason: string }[] = [];

  for (const userId of userIds) {
    try {
      const orgMember = await orgDao.findOrgMember(orgId, userId);
      if (!orgMember && org.ownerId !== userId) {
        errors.push({ userId, reason: 'Not part of organization' });
        continue;
      }
      const member = await teamDao.upsertMember({ teamId, userId, addedBy: actorId });
      results.push(member);
    } catch (e: any) {
      errors.push({ userId, reason: e.message || 'Failed to add' });
    }
  }

  logger.info('TeamService --> addMembersBulk', { orgId, teamId, added: results.length, failed: errors.length });
  return { added: results, errors, addedCount: results.length };
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

/** Direct teams a user belongs to. */
export async function listTeamsForUser(orgId: string, userId: string) {
  return teamDao.findTeamsForUser(orgId, userId);
}

/** Effective teams: direct + all descendants (Option B top-down visibility). */
export async function listEffectiveTeamsForUser(orgId: string, userId: string): Promise<string[]> {
  const directMemberships = await teamDao.findTeamsForUser(orgId, userId);
  const directTeamIds = directMemberships.map(m => m.teamId);

  if (directTeamIds.length === 0) return [];

  // For each direct team, get all descendants
  const allIds = new Set<string>(directTeamIds);
  for (const teamId of directTeamIds) {
    const descendants = await teamDao.findDescendants(teamId);
    for (const d of descendants) {
      allIds.add(d.id);
    }
  }

  return Array.from(allIds);
}

/** Get full tree with effective membership flags for a user (for UI). */
export async function getTeamsTreeForUser(orgId: string, userId: string) {
  const tree = await teamDao.findTeamsTree(orgId);
  const effectiveIds = new Set(await listEffectiveTeamsForUser(orgId, userId));
  const directMemberships = await teamDao.findTeamsForUser(orgId, userId);
  const directIds = new Set(directMemberships.map(m => m.teamId));

  function markNodes(nodes: TeamTreeNode[]): any[] {
    return nodes.map(node => ({
      ...node,
      isDirectMember: directIds.has(node.id),
      isEffectiveMember: effectiveIds.has(node.id),
      isInherited: effectiveIds.has(node.id) && !directIds.has(node.id),
      children: markNodes(node.children || []),
    }));
  }

  return markNodes(tree);
}
