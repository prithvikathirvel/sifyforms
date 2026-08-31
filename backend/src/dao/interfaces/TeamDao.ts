export interface TeamRecord {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description: string | null;
  isDefault: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamWithCounts extends TeamRecord {
  _count: { members: number };
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
  addedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamMemberWithUser extends TeamMemberRecord {
  user: TeamMemberUser;
}

export interface CreateTeamData {
  orgId: string;
  name: string;
  slug: string;
  description: string | null;
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
  addedBy: string | null;
}

export interface TeamDao {
  createTeam(data: CreateTeamData): Promise<TeamRecord>;
  findTeamById(id: string): Promise<TeamRecord | null>;
  findTeamBySlug(orgId: string, slug: string): Promise<TeamRecord | null>;

  /** The organization's General team - where a form lands when none is named. */
  findDefaultTeam(orgId: string): Promise<TeamRecord | null>;

  /** Every team in the org, as a flat list. */
  findTeamsByOrg(orgId: string): Promise<TeamWithCounts[]>;

  updateTeam(id: string, data: UpdateTeamData): Promise<TeamRecord>;

  deleteTeam(id: string): Promise<void>;

  // --- membership ----------------------------------------------------------

  findMember(teamId: string, userId: string): Promise<TeamMemberRecord | null>;
  findMembers(teamId: string): Promise<TeamMemberWithUser[]>;

  /** Teams a user belongs to within one organization. */
  findTeamsForUser(orgId: string, userId: string): Promise<(TeamMemberRecord & { team: TeamRecord })[]>;

  /** Add the member, or keep the existing row if they are already on the team. */
  upsertMember(data: UpsertTeamMemberData): Promise<TeamMemberRecord>;

  deleteMember(teamId: string, userId: string): Promise<void>;

  /** Drop a user from every team in an org - used when they leave the org. */
  deleteMembershipsForUserInOrg(orgId: string, userId: string): Promise<string[]>;
}
