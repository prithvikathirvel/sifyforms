import {
  TeamDao, TeamRecord, TeamWithCounts, TeamMemberRecord, TeamMemberWithUser,
  CreateTeamData, UpdateTeamData, UpsertTeamMemberData,
} from '../interfaces/TeamDao';

export class FirestoreTeamDao implements TeamDao {
  async createTeam(_data: CreateTeamData): Promise<TeamRecord> {
    throw new Error('FirestoreTeamDao.createTeam not implemented');
  }
  async findTeamById(_id: string): Promise<TeamRecord | null> {
    throw new Error('FirestoreTeamDao.findTeamById not implemented');
  }
  async findTeamBySlug(_orgId: string, _slug: string): Promise<TeamRecord | null> {
    throw new Error('FirestoreTeamDao.findTeamBySlug not implemented');
  }
  async findDefaultTeam(_orgId: string): Promise<TeamRecord | null> {
    throw new Error('FirestoreTeamDao.findDefaultTeam not implemented');
  }
  async findTeamsByOrg(_orgId: string): Promise<TeamWithCounts[]> {
    throw new Error('FirestoreTeamDao.findTeamsByOrg not implemented');
  }
  async findSubtree(_orgId: string, _path: string): Promise<TeamRecord[]> {
    throw new Error('FirestoreTeamDao.findSubtree not implemented');
  }
  async findChildren(_parentId: string): Promise<TeamRecord[]> {
    throw new Error('FirestoreTeamDao.findChildren not implemented');
  }
  async updateTeam(_id: string, _data: UpdateTeamData): Promise<TeamRecord> {
    throw new Error('FirestoreTeamDao.updateTeam not implemented');
  }
  async setTeamPath(_id: string, _path: string, _depth: number): Promise<TeamRecord> {
    throw new Error('FirestoreTeamDao.setTeamPath not implemented');
  }
  async deleteTeam(_id: string): Promise<void> {
    throw new Error('FirestoreTeamDao.deleteTeam not implemented');
  }
  async findMember(_teamId: string, _userId: string): Promise<TeamMemberRecord | null> {
    throw new Error('FirestoreTeamDao.findMember not implemented');
  }
  async findMembers(_teamId: string): Promise<TeamMemberWithUser[]> {
    throw new Error('FirestoreTeamDao.findMembers not implemented');
  }
  async findTeamsForUser(_orgId: string, _userId: string): Promise<(TeamMemberRecord & { team: TeamRecord })[]> {
    throw new Error('FirestoreTeamDao.findTeamsForUser not implemented');
  }
  async upsertMember(_data: UpsertTeamMemberData): Promise<TeamMemberRecord> {
    throw new Error('FirestoreTeamDao.upsertMember not implemented');
  }
  async deleteMember(_teamId: string, _userId: string): Promise<void> {
    throw new Error('FirestoreTeamDao.deleteMember not implemented');
  }
  async deleteMembershipsForUserInOrg(_orgId: string, _userId: string): Promise<string[]> {
    throw new Error('FirestoreTeamDao.deleteMembershipsForUserInOrg not implemented');
  }
}
