import {
  InviteDao, InviteRecord, InviteStatus, InviteWithOrg, CreateInviteData,
} from '../interfaces/InviteDao';

export class MongoInviteDao implements InviteDao {
  async upsertInvite(_data: CreateInviteData): Promise<InviteRecord> {
    throw new Error('MongoInviteDao.upsertInvite not implemented');
  }
  async findInviteById(_id: string): Promise<InviteWithOrg | null> {
    throw new Error('MongoInviteDao.findInviteById not implemented');
  }
  async findInviteByOrgAndEmail(_orgId: string, _email: string): Promise<InviteRecord | null> {
    throw new Error('MongoInviteDao.findInviteByOrgAndEmail not implemented');
  }
  async findInvitesByEmail(_email: string, _status?: InviteStatus): Promise<InviteWithOrg[]> {
    throw new Error('MongoInviteDao.findInvitesByEmail not implemented');
  }
  async findInvitesByOrg(_orgId: string, _status?: InviteStatus): Promise<InviteRecord[]> {
    throw new Error('MongoInviteDao.findInvitesByOrg not implemented');
  }
  async updateInviteStatus(_id: string, _status: InviteStatus): Promise<InviteRecord> {
    throw new Error('MongoInviteDao.updateInviteStatus not implemented');
  }
  async deleteInvite(_id: string): Promise<void> {
    throw new Error('MongoInviteDao.deleteInvite not implemented');
  }
}
