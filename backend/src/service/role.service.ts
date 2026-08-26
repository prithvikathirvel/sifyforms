import prisma from '../utils/prisma';
import {
  ACTIONS,
  FEATURES,
  FEATURE_ACTIONS,
  ORG_ONLY_ACTIONS,
  RoleScopeTag,
  SYSTEM_ROLE_SCOPES,
  formatRoleScopes,
  isSystemRole,
  parseRoleScopes,
} from '../config/rbac.config';
import {
  RolePrivilege,
  actionsFromPermission,
  createRole as rbacCreateRole,
  listRoles,
  toggleRoleActive,
  updateRole as rbacUpdateRole,
} from './rbac.client';
import { invalidatePermissions } from './permission.service';
import { createError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * Role definitions.
 *
 * These live in the RBAC service and are shared by every organization on this
 * application - its `roles` table is unique on (name, appId), with no owner
 * column. So a role created here is visible to all organizations. That is a
 * known limitation, accepted for now; scoping roles per organization needs
 * either a change in that service or a local role table.
 *
 * Assignments remain local, so nothing here touches who holds what.
 */

export interface RoleView {
  id: string;
  name: string;
  description: string;
  scopes: RoleScopeTag[];
  privilege: RolePrivilege[];
  actions: string[];
  isActive: boolean;
  /** Roles the application depends on: editable permissions, fixed name. */
  isSystem: boolean;
  /** How many memberships currently reference it, so the UI can warn before changes. */
  assignedCount: number;
}

export interface RoleInput {
  name: string;
  description?: string;
  scopes: RoleScopeTag[];
  privilege: RolePrivilege[];
}

/** The full catalogue of features and actions a role can be built from. */
export function listAvailablePermissions() {
  return Object.values(FEATURES).map(feature => ({
    feature,
    actions: (FEATURE_ACTIONS[feature] ?? []).map(action => ({
      ...action,
      // Meaningless on a role that is only ever granted to a team.
      orgOnly: ORG_ONLY_ACTIONS.includes(action.key),
    })),
  }));
}

function privilegeFrom(permission: unknown): RolePrivilege[] {
  let parsed: any = permission;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }
  return Array.isArray(parsed) ? parsed : parsed?.privilege ?? [];
}

/** Count memberships pointing at each role name, in one pass per table. */
async function assignmentCounts(): Promise<Map<string, number>> {
  const [orgRoles, teamRoles] = await Promise.all([
    prisma.orgUser.groupBy({ by: ['role'], _count: true }),
    prisma.teamMember.groupBy({ by: ['role'], _count: true }),
  ]);
  const counts = new Map<string, number>();
  for (const row of [...orgRoles, ...teamRoles]) {
    counts.set(row.role, (counts.get(row.role) ?? 0) + row._count);
  }
  return counts;
}

export async function listRoleViews(): Promise<RoleView[]> {
  const [roles, counts] = await Promise.all([listRoles(true), assignmentCounts()]);

  return roles
    .map(role => {
      const privilege = privilegeFrom(role.permission);
      return {
        id: role.id,
        name: role.name,
        description: role.description ?? '',
        scopes: isSystemRole(role.name)
          ? SYSTEM_ROLE_SCOPES[role.name] ?? ['ORG', 'TEAM']
          : parseRoleScopes((role as any).template),
        privilege,
        actions: [...actionsFromPermission(role.permission)].sort(),
        isActive: role.isActive !== false,
        isSystem: isSystemRole(role.name),
        assignedCount: counts.get(role.name) ?? 0,
      };
    })
    .sort((a, b) => {
      if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
      return a.name.localeCompare(b.name);
    });
}

/** Names assignable at a given scope - what the member and team pickers offer. */
export async function assignableRoleNames(scope: RoleScopeTag): Promise<string[]> {
  const roles = await listRoleViews();
  return roles.filter(r => r.isActive && r.scopes.includes(scope)).map(r => r.name);
}

/**
 * Reject a role that is not assignable at this scope.
 *
 * Replaces the hardcoded scope lists, so a custom role works the moment it is
 * created rather than needing a code change.
 */
export async function assertRoleAssignable(role: string, scope: RoleScopeTag): Promise<void> {
  const allowed = await assignableRoleNames(scope);
  if (!allowed.includes(role)) {
    throw createError(
      400,
      `"${role}" cannot be assigned at ${scope.toLowerCase()} level. Available: ${allowed.join(', ')}`
    );
  }
}

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

const NAME_PATTERN = /^[A-Za-z0-9][A-Za-z0-9 _-]{1,48}$/;

function validate(input: RoleInput): void {
  if (!NAME_PATTERN.test(input.name.trim())) {
    throw createError(
      400,
      'Role name must be 2-49 characters, letters, numbers, spaces, hyphens or underscores'
    );
  }
  if (input.scopes.length === 0) {
    throw createError(400, 'Choose at least one place this role can be assigned');
  }

  const known = new Map<string, Set<string>>(
    Object.values(FEATURES).map(f => [f as string, new Set((FEATURE_ACTIONS[f] ?? []).map(a => a.key))])
  );
  for (const entry of input.privilege) {
    const actions = known.get(entry.feature);
    if (!actions) throw createError(400, `Unknown feature "${entry.feature}"`);
    for (const action of entry.actions) {
      if (!actions.has(action)) {
        throw createError(400, `Unknown action "${action}" for feature "${entry.feature}"`);
      }
    }
  }

  if (input.privilege.every(p => p.actions.length === 0)) {
    throw createError(400, 'A role needs at least one permission');
  }
}

/**
 * Privileges as the RBAC service wants them: features with no selected actions
 * are dropped, since it validates every entry it is given.
 */
function cleanPrivilege(privilege: RolePrivilege[], scopes: RoleScopeTag[]): RolePrivilege[] {
  // A team-only role cannot carry organization-wide administration; storing it
  // would suggest a grant that no permission check would ever honour.
  const teamOnly = !scopes.includes('ORG');
  return privilege
    .map(p => ({
      feature: p.feature,
      actions: [...new Set(p.actions)].filter(a => !teamOnly || !ORG_ONLY_ACTIONS.includes(a)),
    }))
    .filter(p => p.actions.length > 0);
}

export async function createRole(input: RoleInput) {
  validate(input);
  const name = input.name.trim();

  const existing = await listRoleViews();
  if (existing.some(r => r.name.toLowerCase() === name.toLowerCase())) {
    throw createError(409, `A role named "${name}" already exists`);
  }

  await rbacCreateRole({
    roleName: name,
    description: input.description?.trim() || '',
    template: formatRoleScopes(input.scopes),
    privilege: cleanPrivilege(input.privilege, input.scopes),
  });

  logger.info('RoleService --> createRole', { name, scopes: input.scopes });
  return { message: `Role "${name}" created`, name };
}

export async function updateRole(roleId: string, input: RoleInput) {
  validate(input);
  const roles = await listRoleViews();
  const role = roles.find(r => r.id === roleId);
  if (!role) throw createError(404, 'Role not found');

  const name = input.name.trim();
  if (role.isSystem && name !== role.name) {
    throw createError(
      400,
      `"${role.name}" is a built-in role and cannot be renamed. Its permissions can still be changed.`
    );
  }
  if (
    !role.isSystem &&
    roles.some(r => r.id !== roleId && r.name.toLowerCase() === name.toLowerCase())
  ) {
    throw createError(409, `A role named "${name}" already exists`);
  }

  await rbacUpdateRole(roleId, {
    roleName: role.isSystem ? role.name : name,
    description: input.description?.trim() || '',
    template: formatRoleScopes(role.isSystem ? role.scopes : input.scopes),
    privilege: cleanPrivilege(input.privilege, role.isSystem ? role.scopes : input.scopes),
  });

  // Permissions are cached per user; a definition change invalidates all of them.
  invalidatePermissions();
  logger.info('RoleService --> updateRole', { roleId, name: role.name });
  return { message: `Role "${role.name}" updated` };
}

/**
 * Retire a role, or bring it back.
 *
 * There is no delete in the RBAC service, and deleting would orphan every
 * membership naming it, so retiring is the right shape: it disappears from the
 * pickers while existing holders keep working until they are moved.
 */
export async function setRoleActive(roleId: string, active: boolean) {
  const roles = await listRoleViews();
  const role = roles.find(r => r.id === roleId);
  if (!role) throw createError(404, 'Role not found');

  if (role.isSystem && !active) {
    throw createError(400, `"${role.name}" is a built-in role and cannot be retired`);
  }
  if (!active && role.assignedCount > 0) {
    throw createError(
      400,
      `${role.assignedCount} member(s) still hold "${role.name}". Move them to another role first.`
    );
  }
  if (role.isActive === active) {
    return { message: `Role is already ${active ? 'active' : 'retired'}` };
  }

  await toggleRoleActive(roleId);
  invalidatePermissions();
  return { message: `Role "${role.name}" ${active ? 'restored' : 'retired'}` };
}

/** Actions that let a role administer the organization, for the last-admin guard. */
export async function rolesGrantingAdmin(): Promise<string[]> {
  const roles = await listRoleViews();
  return roles.filter(r => r.actions.includes(ACTIONS.MANAGE_ROLES)).map(r => r.name);
}
