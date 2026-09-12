export interface TeamRecord {
  id: string;
  orgId: string;
  name: string;
  slug: string;
  description: string | null;
  isDefault: boolean;
  parentId: string | null;
  depth: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamWithCounts extends TeamRecord {
  _count: { members: number; forms?: number };
}

export interface TeamTreeNode extends TeamWithCounts {
  children: TeamTreeNode[];
}

export interface TeamWithAncestors extends TeamRecord {
  ancestors: TeamRecord[];
  children?: TeamRecord[];
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
  parentId?: string | null;
  depth?: number;
  createdBy: string;
}

export interface UpdateTeamData {
  name?: string;
  description?: string | null;
  parentId?: string | null;
  depth?: number;
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

  /** Every team in the org with parentId/depth for tree building. */
  findAllTeamsByOrg(orgId: string): Promise<TeamWithCounts[]>;

  /** Build a tree structure from flat list. */
  findTeamsTree(orgId: string): Promise<TeamTreeNode[]>;

  /** Direct children of a team. */
  findDirectChildren(teamId: string): Promise<TeamRecord[]>;

  /** All descendants (BFS) of a team. */
  findDescendants(teamId: string): Promise<TeamRecord[]>;

  /** All ancestors walking up parent chain. */
  findAncestors(teamId: string): Promise<TeamRecord[]>;

  /** Max depth in subtree relative to given team. */
  getMaxSubtreeDepth(teamId: string): Promise<number>;

  /** Move a team and update depth of entire subtree by delta. */
  moveTeamSubtree(teamId: string, newParentId: string | null, depthDelta: number): Promise<void>;

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
