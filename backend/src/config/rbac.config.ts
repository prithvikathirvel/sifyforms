/**
 * RBAC configuration for the Form Builder application.
 *
 * Role *definitions* live in the user-management service; this file names what
 * this backend expects to find there, and `npm run rbac:seed` creates it.
 * Role *assignments* - who holds which role, and where - are owned here, in
 * `OrgUser.role` and `TeamMember.role`.
 *
 * Permissions divide along three planes that are held by different people and
 * correlate weakly, so they are kept independent:
 *
 *   Build      create, edit, publish, delete forms
 *   Responses  read what people submitted, and take it off the platform
 *   Administer members, teams, roles, billing
 *
 * The person who builds an exit-interview form is usually not the person who
 * should read the answers. Collapsing these into one viewer-to-admin ladder
 * makes that impossible to express.
 */

export const RBAC_BASE_URL =
  process.env.RBAC_SERVICE_URL ?? process.env.USER_MANAGEMENT_URL ?? 'http://localhost:3001';

export const RBAC_APP_ID = process.env.RBAC_APP_ID ?? 'Form-Builder';

/** Milliseconds an effective-permission lookup is cached per (user, scope). */
export const RBAC_CACHE_TTL_MS = Number(process.env.RBAC_CACHE_TTL_MS ?? 30_000);

export const RBAC_TIMEOUT_MS = Number(process.env.RBAC_TIMEOUT_MS ?? 5_000);

/** Teams may nest this many levels below a root team. */
export const MAX_TEAM_DEPTH = Number(process.env.MAX_TEAM_DEPTH ?? 5);

// ---------------------------------------------------------------------------
// Response access ladder
// ---------------------------------------------------------------------------

/**
 * How much of a response someone may see. Ordinal - a higher tier includes
 * everything below it.
 *
 * AGGREGATE is the tier worth having: counts, tallies and score distributions
 * computed from ProcessingResult, with no individual row ever leaving the
 * server. It is what makes an anonymous survey a real promise rather than a
 * policy note.
 *
 * EXPORT is deliberately separate from FULL. Downloading four thousand
 * responses is the moment data leaves the platform, and it is the event a
 * customer's compliance team will ask about.
 */
export const RESPONSE_LEVELS = ['NONE', 'AGGREGATE', 'REDACTED', 'FULL', 'EXPORT'] as const;

export type ResponseLevel = (typeof RESPONSE_LEVELS)[number];

export const RESPONSE_LEVEL_RANK: Record<ResponseLevel, number> = {
  NONE: 0,
  AGGREGATE: 1,
  REDACTED: 2,
  FULL: 3,
  EXPORT: 4,
};

/** The stronger of two levels. Access resolves to the best grant that applies. */
export function maxResponseLevel(a: ResponseLevel, b: ResponseLevel): ResponseLevel {
  return RESPONSE_LEVEL_RANK[a] >= RESPONSE_LEVEL_RANK[b] ? a : b;
}

export function meetsLevel(held: ResponseLevel, required: ResponseLevel): boolean {
  return RESPONSE_LEVEL_RANK[held] >= RESPONSE_LEVEL_RANK[required];
}

// ---------------------------------------------------------------------------
// Response visibility policy (a property of the form, not of the viewer)
// ---------------------------------------------------------------------------

/**
 * Roles answer "what is this person allowed to do". They cannot answer "this
 * survey promised anonymity" - that belongs to the form, and it has to outrank
 * every role including the owner's.
 */
export const RESPONSE_POLICIES = ['STANDARD', 'ANONYMOUS', 'BLIND_REVIEW', 'RESTRICTED'] as const;

export type ResponsePolicy = (typeof RESPONSE_POLICIES)[number];

/**
 * The most any role may see under each policy. Applied after roles and shares
 * resolve, as a ceiling.
 */
export const POLICY_CEILING: Record<ResponsePolicy, ResponseLevel> = {
  STANDARD: 'EXPORT',
  // Nobody sees an individual response. Not the owner, not the platform admin.
  ANONYMOUS: 'AGGREGATE',
  // Responses are readable, but never attributed to a person.
  BLIND_REVIEW: 'REDACTED',
  // Full access, but only for principals named on the form itself.
  RESTRICTED: 'EXPORT',
};

// ---------------------------------------------------------------------------
// Features and actions
// ---------------------------------------------------------------------------

export const FEATURES = {
  ORGANIZATION: 'Organization',
  TEAM: 'Team',
  FORM: 'Form',
  RESPONSE: 'Response',
} as const;

export const ACTIONS = {
  // Organization
  VIEW_ORG: 'VIEW_ORG',
  MANAGE_ORG: 'MANAGE_ORG',
  DELETE_ORG: 'DELETE_ORG',
  MANAGE_BILLING: 'MANAGE_BILLING',
  INVITE_USER: 'INVITE_USER',
  REMOVE_USER: 'REMOVE_USER',
  ASSIGN_ORG_ROLE: 'ASSIGN_ORG_ROLE',
  MANAGE_ROLES: 'MANAGE_ROLES',
  VIEW_MEMBERS: 'VIEW_MEMBERS',

  // Team
  VIEW_TEAM: 'VIEW_TEAM',
  CREATE_TEAM: 'CREATE_TEAM',
  EDIT_TEAM: 'EDIT_TEAM',
  DELETE_TEAM: 'DELETE_TEAM',
  ADD_TEAM_MEMBER: 'ADD_TEAM_MEMBER',
  REMOVE_TEAM_MEMBER: 'REMOVE_TEAM_MEMBER',
  ASSIGN_TEAM_ROLE: 'ASSIGN_TEAM_ROLE',

  // Form (the Build plane)
  VIEW_FORM: 'VIEW_FORM',
  CREATE_FORM: 'CREATE_FORM',
  EDIT_FORM: 'EDIT_FORM',
  DELETE_FORM: 'DELETE_FORM',
  PUBLISH_FORM: 'PUBLISH_FORM',
  MOVE_FORM: 'MOVE_FORM',
  SHARE_FORM: 'SHARE_FORM',

  // Response (the read-the-data plane)
  VIEW_AGGREGATE: 'VIEW_AGGREGATE',
  VIEW_RESPONSES_REDACTED: 'VIEW_RESPONSES_REDACTED',
  VIEW_RESPONSES_FULL: 'VIEW_RESPONSES_FULL',
  EXPORT_RESPONSES: 'EXPORT_RESPONSES',
  DELETE_RESPONSES: 'DELETE_RESPONSES',
} as const;

export type Action = (typeof ACTIONS)[keyof typeof ACTIONS];

/**
 * Actions that only mean anything when granted organization-wide.
 *
 * Permission checks for these never pass a team, so they resolve against the
 * organization role alone - a team assignment carrying them would be inert.
 * Listing them lets the role editor grey them out for team-only roles rather
 * than offering a tick that does nothing.
 *
 * Note what is NOT here: VIEW_ORG and VIEW_MEMBERS. A team lead needs both to
 * do their job - picking someone to add to the team means reading the
 * organization's member list.
 */
export const ORG_ONLY_ACTIONS: string[] = [
  ACTIONS.MANAGE_ORG,
  ACTIONS.DELETE_ORG,
  ACTIONS.MANAGE_BILLING,
  ACTIONS.INVITE_USER,
  ACTIONS.REMOVE_USER,
  ACTIONS.ASSIGN_ORG_ROLE,
  ACTIONS.MANAGE_ROLES,
];

/** Action lists per feature, used by the seed script. */
export const FEATURE_ACTIONS: Record<string, { key: string; value: string }[]> = {
  [FEATURES.ORGANIZATION]: [
    { key: ACTIONS.VIEW_ORG, value: 'View organization' },
    { key: ACTIONS.MANAGE_ORG, value: 'Edit organization settings' },
    { key: ACTIONS.DELETE_ORG, value: 'Delete organization' },
    { key: ACTIONS.MANAGE_BILLING, value: 'Manage billing' },
    { key: ACTIONS.INVITE_USER, value: 'Invite users' },
    { key: ACTIONS.REMOVE_USER, value: 'Remove users' },
    { key: ACTIONS.ASSIGN_ORG_ROLE, value: 'Change a member organization role' },
    { key: ACTIONS.MANAGE_ROLES, value: 'Create and edit roles' },
    { key: ACTIONS.VIEW_MEMBERS, value: 'View members' },
  ],
  [FEATURES.TEAM]: [
    { key: ACTIONS.VIEW_TEAM, value: 'View team' },
    { key: ACTIONS.CREATE_TEAM, value: 'Create team' },
    { key: ACTIONS.EDIT_TEAM, value: 'Edit team' },
    { key: ACTIONS.DELETE_TEAM, value: 'Delete team' },
    { key: ACTIONS.ADD_TEAM_MEMBER, value: 'Add team member' },
    { key: ACTIONS.REMOVE_TEAM_MEMBER, value: 'Remove team member' },
    { key: ACTIONS.ASSIGN_TEAM_ROLE, value: 'Change a member team role' },
  ],
  [FEATURES.FORM]: [
    { key: ACTIONS.VIEW_FORM, value: 'View form' },
    { key: ACTIONS.CREATE_FORM, value: 'Create form' },
    { key: ACTIONS.EDIT_FORM, value: 'Edit form' },
    { key: ACTIONS.DELETE_FORM, value: 'Delete form' },
    { key: ACTIONS.PUBLISH_FORM, value: 'Publish form' },
    { key: ACTIONS.MOVE_FORM, value: 'Move form to another team' },
    { key: ACTIONS.SHARE_FORM, value: 'Share a form with a person or team' },
  ],
  [FEATURES.RESPONSE]: [
    { key: ACTIONS.VIEW_AGGREGATE, value: 'View aggregate results only' },
    { key: ACTIONS.VIEW_RESPONSES_REDACTED, value: 'View responses with identifying fields masked' },
    { key: ACTIONS.VIEW_RESPONSES_FULL, value: 'View complete responses' },
    { key: ACTIONS.EXPORT_RESPONSES, value: 'Export responses off the platform' },
    { key: ACTIONS.DELETE_RESPONSES, value: 'Delete responses' },
  ],
};

/** The response tier each action corresponds to, for resolving a role's ceiling. */
export const ACTION_TO_LEVEL: Record<string, ResponseLevel> = {
  [ACTIONS.VIEW_AGGREGATE]: 'AGGREGATE',
  [ACTIONS.VIEW_RESPONSES_REDACTED]: 'REDACTED',
  [ACTIONS.VIEW_RESPONSES_FULL]: 'FULL',
  [ACTIONS.EXPORT_RESPONSES]: 'EXPORT',
};

// ---------------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------------

export const ROLES = {
  OWNER: 'OWNER',
  ADMIN: 'ADMIN',
  TEAM_LEAD: 'TEAM_LEAD',
  CREATOR: 'CREATOR',
  ANALYST: 'ANALYST',
  VIEWER: 'VIEWER',
} as const;

export type RoleName = (typeof ROLES)[keyof typeof ROLES];

/**
 * Where a role may be assigned.
 *
 * The RBAC service has no column for this, but its `roles.template` field is
 * free-form and otherwise unused, so the scope rides there as "ORG", "TEAM" or
 * "ORG,TEAM". That keeps custom roles working without touching that service.
 */
export type RoleScopeTag = 'ORG' | 'TEAM';

export function parseRoleScopes(template?: string | null): RoleScopeTag[] {
  const tags = (template ?? '')
    .split(',')
    .map(t => t.trim().toUpperCase())
    .filter((t): t is RoleScopeTag => t === 'ORG' || t === 'TEAM');
  // A role with nothing recorded is assignable anywhere rather than nowhere;
  // refusing every assignment would be a worse failure than being permissive.
  return tags.length ? tags : ['ORG', 'TEAM'];
}

export function formatRoleScopes(scopes: RoleScopeTag[]): string {
  return [...new Set(scopes)].join(',');
}

/**
 * Roles this application depends on. They can have their permissions edited,
 * but not renamed or deactivated: the defaults below name them, and existing
 * membership rows store them.
 */
export const SYSTEM_ROLES: string[] = [
  ROLES.OWNER,
  ROLES.ADMIN,
  ROLES.TEAM_LEAD,
  ROLES.CREATOR,
  ROLES.ANALYST,
  ROLES.VIEWER,
];

export function isSystemRole(name: string): boolean {
  return SYSTEM_ROLES.includes(name);
}

/** Scope tags for the roles this app seeds. */
export const SYSTEM_ROLE_SCOPES: Record<string, RoleScopeTag[]> = {
  [ROLES.OWNER]: ['ORG'],
  [ROLES.ADMIN]: ['ORG'],
  [ROLES.TEAM_LEAD]: ['TEAM'],
  [ROLES.CREATOR]: ['ORG', 'TEAM'],
  [ROLES.ANALYST]: ['ORG', 'TEAM'],
  [ROLES.VIEWER]: ['ORG', 'TEAM'],
};

/**
 * Which roles may be assigned at which level.
 *
 * OWNER and ADMIN are administrative, so organization-only. TEAM_LEAD is
 * meaningless without a team. CREATOR, ANALYST and VIEWER work at both: at
 * organization level they set a person's default posture everywhere, and a team
 * assignment overrides it for that team and everything beneath it.
 */
export const ORG_SCOPE_ROLES: RoleName[] = [
  ROLES.OWNER,
  ROLES.ADMIN,
  ROLES.CREATOR,
  ROLES.ANALYST,
  ROLES.VIEWER,
];

export const TEAM_SCOPE_ROLES: RoleName[] = [
  ROLES.TEAM_LEAD,
  ROLES.CREATOR,
  ROLES.ANALYST,
  ROLES.VIEWER,
];

/** Roles that can administer the organization; used for the last-admin guard. */
export const ORG_ADMIN_ROLES: RoleName[] = [ROLES.OWNER, ROLES.ADMIN];

/** Role given to whoever creates the organization. */
export const DEFAULT_ORG_OWNER_ROLE: RoleName = ROLES.OWNER;
/** Role given to an invited user unless the inviter picks another. */
export const DEFAULT_ORG_MEMBER_ROLE: RoleName = ROLES.CREATOR;
/** Role given to whoever creates a team. */
export const DEFAULT_TEAM_ROLE: RoleName = ROLES.TEAM_LEAD;
/** Role given to someone added to a team without an explicit role. */
export const DEFAULT_TEAM_MEMBER_ROLE: RoleName = ROLES.CREATOR;

interface RoleDefinition {
  description: string;
  privilege: { feature: string; actions: string[] }[];
}

const ALL = (feature: string) => FEATURE_ACTIONS[feature].map(a => a.key);

export const ROLE_DEFINITIONS: Record<RoleName, RoleDefinition> = {
  [ROLES.OWNER]: {
    description: 'Full control of the organization, including billing and deletion',
    privilege: [
      { feature: FEATURES.ORGANIZATION, actions: ALL(FEATURES.ORGANIZATION) },
      { feature: FEATURES.TEAM, actions: ALL(FEATURES.TEAM) },
      { feature: FEATURES.FORM, actions: ALL(FEATURES.FORM) },
      { feature: FEATURES.RESPONSE, actions: ALL(FEATURES.RESPONSE) },
    ],
  },
  [ROLES.ADMIN]: {
    description: 'Runs the organization day to day; cannot touch billing or delete it',
    privilege: [
      {
        feature: FEATURES.ORGANIZATION,
        actions: ALL(FEATURES.ORGANIZATION).filter(
          a => a !== ACTIONS.MANAGE_BILLING && a !== ACTIONS.DELETE_ORG
        ),
      },
      { feature: FEATURES.TEAM, actions: ALL(FEATURES.TEAM) },
      { feature: FEATURES.FORM, actions: ALL(FEATURES.FORM) },
      { feature: FEATURES.RESPONSE, actions: ALL(FEATURES.RESPONSE) },
    ],
  },
  [ROLES.TEAM_LEAD]: {
    description: 'Runs a team: its members, its roles, its sub-teams and its forms',
    privilege: [
      { feature: FEATURES.ORGANIZATION, actions: [ACTIONS.VIEW_ORG, ACTIONS.VIEW_MEMBERS] },
      { feature: FEATURES.TEAM, actions: ALL(FEATURES.TEAM) },
      { feature: FEATURES.FORM, actions: ALL(FEATURES.FORM) },
      { feature: FEATURES.RESPONSE, actions: ALL(FEATURES.RESPONSE) },
    ],
  },
  [ROLES.CREATOR]: {
    // Aggregate rather than full response access is the deliberate choice: it is
    // the safe default, and upgrading is then an explicit, auditable act.
    description: 'Builds and publishes forms; sees results in aggregate, not individual responses',
    privilege: [
      { feature: FEATURES.ORGANIZATION, actions: [ACTIONS.VIEW_ORG, ACTIONS.VIEW_MEMBERS] },
      { feature: FEATURES.TEAM, actions: [ACTIONS.VIEW_TEAM] },
      {
        feature: FEATURES.FORM,
        actions: [
          ACTIONS.VIEW_FORM,
          ACTIONS.CREATE_FORM,
          ACTIONS.EDIT_FORM,
          ACTIONS.DELETE_FORM,
          ACTIONS.PUBLISH_FORM,
        ],
      },
      { feature: FEATURES.RESPONSE, actions: [ACTIONS.VIEW_AGGREGATE] },
    ],
  },
  [ROLES.ANALYST]: {
    description: 'Reads and exports responses; cannot change the questions',
    privilege: [
      { feature: FEATURES.ORGANIZATION, actions: [ACTIONS.VIEW_ORG, ACTIONS.VIEW_MEMBERS] },
      { feature: FEATURES.TEAM, actions: [ACTIONS.VIEW_TEAM] },
      { feature: FEATURES.FORM, actions: [ACTIONS.VIEW_FORM] },
      {
        feature: FEATURES.RESPONSE,
        actions: [
          ACTIONS.VIEW_AGGREGATE,
          ACTIONS.VIEW_RESPONSES_REDACTED,
          ACTIONS.VIEW_RESPONSES_FULL,
          ACTIONS.EXPORT_RESPONSES,
        ],
      },
    ],
  },
  [ROLES.VIEWER]: {
    description: 'Sees which forms exist, and nothing that was submitted to them',
    privilege: [
      { feature: FEATURES.ORGANIZATION, actions: [ACTIONS.VIEW_ORG] },
      { feature: FEATURES.TEAM, actions: [ACTIONS.VIEW_TEAM] },
      { feature: FEATURES.FORM, actions: [ACTIONS.VIEW_FORM] },
      { feature: FEATURES.RESPONSE, actions: [] },
    ],
  },
};
