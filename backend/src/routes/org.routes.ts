import { Router } from 'express';
import {
  createOrg,
  listOrgs,
  getOrg,
  updateOrg,
  deleteOrg,
  listOrgUsers,
  updateOrgUserRole,
  removeUser,
} from '../controllers/express/org.controller';
import {
  listRoles,
  createRole,
  updateRole,
  setRoleActive,
} from '../controllers/express/role.controller';
import {
  createInvite,
  listOrgInvites,
  revokeInvite,
} from '../controllers/express/invite.controller';
import {
  createTeam,
  listTeams,
  getTeam,
  updateTeam,
  deleteTeam,
  listMembers,
  addMember,
  updateMemberRole,
  removeMember,
  getMyPermissions,
  listMyTeams,
} from '../controllers/express/team.controller';
import { validate } from '../middleware/validate.middleware';
import { authMiddleware, orgMiddleware } from '../middleware/auth.middleware';
import { requirePermission } from '../middleware/permission.middleware';
import { ACTIONS } from '../config/rbac.config';
import { CreateOrgSchema, UpdateOrgSchema } from '../schemas/org.schema';
import { CreateInviteSchema, UpdateOrgUserRoleSchema } from '../schemas/invite.schema';
import { CreateRoleSchema } from '../schemas/role.schema';
import {
  CreateTeamSchema,
  UpdateTeamSchema,
  AddTeamMemberSchema,
  UpdateTeamMemberSchema,
} from '../schemas/team.schema';

const router = Router();

router.use(authMiddleware);

// `orgMiddleware` establishes that the caller belongs to the org at all;
// `requirePermission` then decides what they may do inside it.
router.post('/', validate(CreateOrgSchema), createOrg);
router.get('/', listOrgs);

router.get('/:orgId', orgMiddleware, requirePermission(ACTIONS.VIEW_ORG, { teamIdFrom: 'none' }), getOrg);
router.put(
  '/:orgId',
  orgMiddleware,
  requirePermission(ACTIONS.MANAGE_ORG, { teamIdFrom: 'none' }),
  validate(UpdateOrgSchema),
  updateOrg
);
router.delete('/:orgId', orgMiddleware, requirePermission(ACTIONS.DELETE_ORG, { teamIdFrom: 'none' }), deleteOrg);

// --- the caller's own access ------------------------------------------------
router.get('/:orgId/me/permissions', orgMiddleware, getMyPermissions);
router.get('/:orgId/me/teams', orgMiddleware, listMyTeams);

// --- members ----------------------------------------------------------------
router.get(
  '/:orgId/users',
  orgMiddleware,
  requirePermission(ACTIONS.VIEW_MEMBERS, { teamIdFrom: 'none' }),
  listOrgUsers
);
router.put(
  '/:orgId/users/:userId/role',
  orgMiddleware,
  requirePermission(ACTIONS.ASSIGN_ORG_ROLE, { teamIdFrom: 'none' }),
  validate(UpdateOrgUserRoleSchema),
  updateOrgUserRole
);
router.delete(
  '/:orgId/users/:userId',
  orgMiddleware,
  requirePermission(ACTIONS.REMOVE_USER, { teamIdFrom: 'none' }),
  removeUser
);

// --- invitations ------------------------------------------------------------
router.post(
  '/:orgId/invites',
  orgMiddleware,
  requirePermission(ACTIONS.INVITE_USER, { teamIdFrom: 'none' }),
  validate(CreateInviteSchema),
  createInvite
);
router.get(
  '/:orgId/invites',
  orgMiddleware,
  requirePermission(ACTIONS.VIEW_MEMBERS, { teamIdFrom: 'none' }),
  listOrgInvites
);
router.delete(
  '/:orgId/invites/:inviteId',
  orgMiddleware,
  requirePermission(ACTIONS.INVITE_USER, { teamIdFrom: 'none' }),
  revokeInvite
);

// --- roles ------------------------------------------------------------------
// Definitions are shared across every organization on this application (the
// RBAC service has no owner column on roles), so managing them is gated behind
// MANAGE_ROLES rather than being open to any member.
router.get(
  '/:orgId/roles',
  orgMiddleware,
  requirePermission(ACTIONS.VIEW_MEMBERS, { teamIdFrom: 'none' }),
  listRoles
);
router.post(
  '/:orgId/roles',
  orgMiddleware,
  requirePermission(ACTIONS.MANAGE_ROLES, { teamIdFrom: 'none' }),
  validate(CreateRoleSchema),
  createRole
);
router.put(
  '/:orgId/roles/:roleId',
  orgMiddleware,
  requirePermission(ACTIONS.MANAGE_ROLES, { teamIdFrom: 'none' }),
  validate(CreateRoleSchema),
  updateRole
);
router.patch(
  '/:orgId/roles/:roleId/active',
  orgMiddleware,
  requirePermission(ACTIONS.MANAGE_ROLES, { teamIdFrom: 'none' }),
  setRoleActive
);

// --- teams ------------------------------------------------------------------
// CREATE_TEAM is checked against `parentId` when nesting, so a lead of the parent
// team can create sub-teams without needing org-wide rights.
router.post(
  '/:orgId/teams',
  orgMiddleware,
  requirePermission(ACTIONS.CREATE_TEAM, { teamIdFrom: 'body', teamIdKey: 'parentId' }),
  validate(CreateTeamSchema),
  createTeam
);
router.get(
  '/:orgId/teams',
  orgMiddleware,
  requirePermission(ACTIONS.VIEW_TEAM, { teamIdFrom: 'none' }),
  listTeams
);
router.get('/:orgId/teams/:teamId', orgMiddleware, requirePermission(ACTIONS.VIEW_TEAM), getTeam);
router.put(
  '/:orgId/teams/:teamId',
  orgMiddleware,
  requirePermission(ACTIONS.EDIT_TEAM),
  validate(UpdateTeamSchema),
  updateTeam
);
router.delete('/:orgId/teams/:teamId', orgMiddleware, requirePermission(ACTIONS.DELETE_TEAM), deleteTeam);

// --- team membership --------------------------------------------------------
router.get(
  '/:orgId/teams/:teamId/members',
  orgMiddleware,
  requirePermission(ACTIONS.VIEW_TEAM),
  listMembers
);
router.post(
  '/:orgId/teams/:teamId/members',
  orgMiddleware,
  requirePermission(ACTIONS.ADD_TEAM_MEMBER),
  validate(AddTeamMemberSchema),
  addMember
);
router.put(
  '/:orgId/teams/:teamId/members/:userId',
  orgMiddleware,
  requirePermission(ACTIONS.ASSIGN_TEAM_ROLE),
  validate(UpdateTeamMemberSchema),
  updateMemberRole
);
router.delete(
  '/:orgId/teams/:teamId/members/:userId',
  orgMiddleware,
  requirePermission(ACTIONS.REMOVE_TEAM_MEMBER),
  removeMember
);

export default router;
