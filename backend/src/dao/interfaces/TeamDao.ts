export interface TeamRecord {
  id: string;
  orgId: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  path: string;
  depth: number;
  isDefault: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamWithCounts extends TeamRecord {
  _count: { members: number; children: number };
}

export interface TeamMemberUser {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
}

export interface TeamMemberRecord {
  id: string;
  teamId: string;
  userId: string;
  roleId: string | null;
  role: string;
  addedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMemberWithUser extends TeamMemberRecord {
  user: TeamMemberUser;
}

export interface CreateTeamData {
  orgId: string;
  parentId: string | null;
  name: string;
  slug: string;
  description: string | null;
  path: string;
  depth: number;
  isDefault?: boolean;
  createdBy: string;
}

export interface UpdateTeamData {
  name?: string;
  description?: string | null;
}

export interface UpsertTeamMemberData {
  teamId: string;
  userId: string;
  roleId: string | null;
  role: string;
  addedBy: string | null;
}

export interface TeamDao {
  createTeam(data: CreateTeamData): Promise<TeamRecord>;
  findTeamById(id: string): Promise<TeamRecord | null>;
  findTeamBySlug(orgId: string, slug: string): Promise<TeamRecord | null>;

  /** The organization's General team - where a form lands when none is named. */
  findDefaultTeam(orgId: string): Promise<TeamRecord | null>;

  /** Every team in the org, ordered by path so callers can build the tree in one pass. */
  findTeamsByOrg(orgId: string): Promise<TeamWithCounts[]>;

  /**
   * A team and everything nested beneath it, found by materialized-path prefix.
   * Includes the team itself.
   */
  findSubtree(orgId: string, path: string): Promise<TeamRecord[]>;

  /** Direct children only. */
  findChildren(parentId: string): Promise<TeamRecord[]>;

  updateTeam(id: string, data: UpdateTeamData): Promise<TeamRecord>;

  /**
   * Write the materialized path. Separate from updateTeam because `path` is
   * structural: it is set once at creation (when the new id is finally known)
   * and never edited alongside user-facing fields.
   */
  setTeamPath(id: string, path: string, depth: number): Promise<TeamRecord>;
  deleteTeam(id: string): Promise<void>;

  // --- membership ----------------------------------------------------------

  findMember(teamId: string, userId: string): Promise<TeamMemberRecord | null>;
  findMembers(teamId: string): Promise<TeamMemberWithUser[]>;

  /** Teams a user belongs to within one organization. */
  findTeamsForUser(orgId: string, userId: string): Promise<(TeamMemberRecord & { team: TeamRecord })[]>;

  /** Add the member, or change their role if they are already on the team. */
  upsertMember(data: UpsertTeamMemberData): Promise<TeamMemberRecord>;

  deleteMember(teamId: string, userId: string): Promise<void>;

  /** Drop a user from every team in an org - used when they leave the org. */
  deleteMembershipsForUserInOrg(orgId: string, userId: string): Promise<string[]>;
}
