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
} from '../schemas/team.schema';

const router = Router();

router.use(authMiddleware);

// `orgMiddleware` establishes that the caller belongs to the org at all;
// `requirePermission` then decides what they may do inside it.
router.post('/', validate(CreateOrgSchema), createOrg);
router.get('/', listOrgs);

router.get('/:orgId', orgMiddleware, requirePermission(ACTIONS.VIEW_ORG), getOrg);
router.put(
  '/:orgId',
  orgMiddleware,
  requirePermission(ACTIONS.MANAGE_ORG),
  validate(UpdateOrgSchema),
  updateOrg
);
router.delete('/:orgId', orgMiddleware, requirePermission(ACTIONS.DELETE_ORG), deleteOrg);

// --- the caller's own access ------------------------------------------------
router.get('/:orgId/me/permissions', orgMiddleware, getMyPermissions);
router.get('/:orgId/me/teams', orgMiddleware, listMyTeams);

// --- members ----------------------------------------------------------------
router.get(
  '/:orgId/users',
  orgMiddleware,
  requirePermission(ACTIONS.VIEW_MEMBERS),
  listOrgUsers
);
router.put(
  '/:orgId/users/:userId/role',
  orgMiddleware,
  requirePermission(ACTIONS.ASSIGN_ORG_ROLE),
  validate(UpdateOrgUserRoleSchema),
  updateOrgUserRole
);
router.delete(
  '/:orgId/users/:userId',
  orgMiddleware,
  requirePermission(ACTIONS.REMOVE_USER),
  removeUser
);

// --- invitations ------------------------------------------------------------
router.post(
  '/:orgId/invites',
  orgMiddleware,
  requirePermission(ACTIONS.INVITE_USER),
  validate(CreateInviteSchema),
  createInvite
);
router.get(
  '/:orgId/invites',
  orgMiddleware,
  requirePermission(ACTIONS.VIEW_MEMBERS),
  listOrgInvites
);
router.delete(
  '/:orgId/invites/:inviteId',
  orgMiddleware,
  requirePermission(ACTIONS.INVITE_USER),
  revokeInvite
);

// --- roles ------------------------------------------------------------------
// Definitions are shared across every organization on this application (the
// RBAC service has no owner column on roles), so managing them is gated behind
// MANAGE_ROLES rather than being open to any member.
router.get(
  '/:orgId/roles',
  orgMiddleware,
  requirePermission(ACTIONS.VIEW_MEMBERS),
  listRoles
);
router.post(
  '/:orgId/roles',
  orgMiddleware,
  requirePermission(ACTIONS.MANAGE_ROLES),
  validate(CreateRoleSchema),
  createRole
);
router.put(
  '/:orgId/roles/:roleId',
  orgMiddleware,
  requirePermission(ACTIONS.MANAGE_ROLES),
  validate(CreateRoleSchema),
  updateRole
);
router.patch(
  '/:orgId/roles/:roleId/active',
  orgMiddleware,
  requirePermission(ACTIONS.MANAGE_ROLES),
  setRoleActive
);

// --- teams ------------------------------------------------------------------
router.post(
  '/:orgId/teams',
  orgMiddleware,
  requirePermission(ACTIONS.CREATE_TEAM),
  validate(CreateTeamSchema),
  createTeam
);
router.get(
  '/:orgId/teams',
  orgMiddleware,
  requirePermission(ACTIONS.VIEW_TEAM),
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
router.delete(
  '/:orgId/teams/:teamId/members/:userId',
  orgMiddleware,
  requirePermission(ACTIONS.REMOVE_TEAM_MEMBER),
  removeMember
);

export default router;
