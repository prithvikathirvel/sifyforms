import prisma from '../../utils/prisma';
import {
  TeamDao,
  TeamRecord,
  TeamWithCounts,
  TeamMemberRecord,
  TeamMemberWithUser,
  CreateTeamData,
  UpdateTeamData,
  UpsertTeamMemberData,
} from '../interfaces/TeamDao';

const MEMBER_USER = {
  select: { id: true, email: true, firstName: true, lastName: true, username: true },
} as const;

export class MySQLTeamDao implements TeamDao {
  async createTeam(data: CreateTeamData): Promise<TeamRecord> {
    return prisma.team.create({ data });
  }

  async findTeamById(id: string): Promise<TeamRecord | null> {
    return prisma.team.findUnique({ where: { id } });
  }

  async findTeamBySlug(orgId: string, slug: string): Promise<TeamRecord | null> {
    return prisma.team.findUnique({ where: { orgId_slug: { orgId, slug } } });
  }

  async findDefaultTeam(orgId: string): Promise<TeamRecord | null> {
    return prisma.team.findFirst({ where: { orgId, isDefault: true } });
  }

  async findTeamsByOrg(orgId: string): Promise<TeamWithCounts[]> {
    // Ordering by path means parents always precede their descendants, so the
    // caller can assemble the tree in a single forward pass.
    return prisma.team.findMany({
      where: { orgId },
      include: { _count: { select: { members: true, children: true } } },
      orderBy: { path: 'asc' },
    });
  }

  async findSubtree(orgId: string, path: string): Promise<TeamRecord[]> {
    // `path` always ends with the team's own id, so `startsWith(path)` matches
    // the team plus everything beneath it and nothing else.
    return prisma.team.findMany({
      where: { orgId, path: { startsWith: path } },
      orderBy: { path: 'asc' },
    });
  }

  async findChildren(parentId: string): Promise<TeamRecord[]> {
    return prisma.team.findMany({ where: { parentId }, orderBy: { name: 'asc' } });
  }

  async updateTeam(id: string, data: UpdateTeamData): Promise<TeamRecord> {
    return prisma.team.update({ where: { id }, data });
  }

  async setTeamPath(id: string, path: string, depth: number): Promise<TeamRecord> {
    return prisma.team.update({ where: { id }, data: { path, depth } });
  }

  async deleteTeam(id: string): Promise<void> {
    await prisma.team.delete({ where: { id } });
  }

  // --- membership ----------------------------------------------------------

  async findMember(teamId: string, userId: string): Promise<TeamMemberRecord | null> {
    return prisma.teamMember.findUnique({ where: { teamId_userId: { teamId, userId } } });
  }

  async findMembers(teamId: string): Promise<TeamMemberWithUser[]> {
    return prisma.teamMember.findMany({
      where: { teamId },
      include: { user: MEMBER_USER },
      orderBy: { createdAt: 'asc' },
    });
  }

  async findTeamsForUser(
    orgId: string,
    userId: string
  ): Promise<(TeamMemberRecord & { team: TeamRecord })[]> {
    return prisma.teamMember.findMany({
      where: { userId, team: { orgId } },
      include: { team: true },
      orderBy: { createdAt: 'asc' },
    });
  }

  async upsertMember(data: UpsertTeamMemberData): Promise<TeamMemberRecord> {
    return prisma.teamMember.upsert({
      where: { teamId_userId: { teamId: data.teamId, userId: data.userId } },
      create: data,
      update: { roleId: data.roleId, role: data.role },
    });
  }

  async deleteMember(teamId: string, userId: string): Promise<void> {
    await prisma.teamMember.delete({ where: { teamId_userId: { teamId, userId } } });
  }

  async deleteMembershipsForUserInOrg(orgId: string, userId: string): Promise<string[]> {
    const memberships = await prisma.teamMember.findMany({
      where: { userId, team: { orgId } },
      select: { teamId: true },
    });
    if (memberships.length === 0) return [];

    const teamIds = memberships.map((m: { teamId: string }) => m.teamId);
    await prisma.teamMember.deleteMany({ where: { userId, teamId: { in: teamIds } } });
    return teamIds;
  }
}
