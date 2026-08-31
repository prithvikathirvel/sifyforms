import {
  TeamDao, TeamRecord, TeamWithCounts, TeamMemberRecord, TeamMemberWithUser,
  CreateTeamData, UpdateTeamData, UpsertTeamMemberData,
} from '../interfaces/TeamDao';

export class MongoTeamDao implements TeamDao {
  async createTeam(_data: CreateTeamData): Promise<TeamRecord> {
    throw new Error('MongoTeamDao.createTeam not implemented');
  }
  async findTeamById(_id: string): Promise<TeamRecord | null> {
    throw new Error('MongoTeamDao.findTeamById not implemented');
  }
  async findTeamBySlug(_orgId: string, _slug: string): Promise<TeamRecord | null> {
    throw new Error('MongoTeamDao.findTeamBySlug not implemented');
  }
  async findDefaultTeam(_orgId: string): Promise<TeamRecord | null> {
    throw new Error('MongoTeamDao.findDefaultTeam not implemented');
  }
  async findTeamsByOrg(_orgId: string): Promise<TeamWithCounts[]> {
    throw new Error('MongoTeamDao.findTeamsByOrg not implemented');
  }
  async updateTeam(_id: string, _data: UpdateTeamData): Promise<TeamRecord> {
    throw new Error('MongoTeamDao.updateTeam not implemented');
  }
  async deleteTeam(_id: string): Promise<void> {
    throw new Error('MongoTeamDao.deleteTeam not implemented');
  }
  async findMember(_teamId: string, _userId: string): Promise<TeamMemberRecord | null> {
    throw new Error('MongoTeamDao.findMember not implemented');
  }
  async findMembers(_teamId: string): Promise<TeamMemberWithUser[]> {
    throw new Error('MongoTeamDao.findMembers not implemented');
  }
  async findTeamsForUser(_orgId: string, _userId: string): Promise<(TeamMemberRecord & { team: TeamRecord })[]> {
    throw new Error('MongoTeamDao.findTeamsForUser not implemented');
  }
  async upsertMember(_data: UpsertTeamMemberData): Promise<TeamMemberRecord> {
    throw new Error('MongoTeamDao.upsertMember not implemented');
  }
  async deleteMember(_teamId: string, _userId: string): Promise<void> {
    throw new Error('MongoTeamDao.deleteMember not implemented');
  }
  async deleteMembershipsForUserInOrg(_orgId: string, _userId: string): Promise<string[]> {
    throw new Error('MongoTeamDao.deleteMembershipsForUserInOrg not implemented');
  }
}
