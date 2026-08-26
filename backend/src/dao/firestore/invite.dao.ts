import {
  InviteDao, InviteRecord, InviteStatus, InviteWithOrg, CreateInviteData,
} from '../interfaces/InviteDao';

export class FirestoreInviteDao implements InviteDao {
  async upsertInvite(_data: CreateInviteData): Promise<InviteRecord> {
    throw new Error('FirestoreInviteDao.upsertInvite not implemented');
  }
  async findInviteById(_id: string): Promise<InviteWithOrg | null> {
    throw new Error('FirestoreInviteDao.findInviteById not implemented');
  }
  async findInviteByOrgAndEmail(_orgId: string, _email: string): Promise<InviteRecord | null> {
    throw new Error('FirestoreInviteDao.findInviteByOrgAndEmail not implemented');
  }
  async findInvitesByEmail(_email: string, _status?: InviteStatus): Promise<InviteWithOrg[]> {
    throw new Error('FirestoreInviteDao.findInvitesByEmail not implemented');
  }
  async findInvitesByOrg(_orgId: string, _status?: InviteStatus): Promise<InviteRecord[]> {
    throw new Error('FirestoreInviteDao.findInvitesByOrg not implemented');
  }
  async updateInviteStatus(_id: string, _status: InviteStatus): Promise<InviteRecord> {
    throw new Error('FirestoreInviteDao.updateInviteStatus not implemented');
  }
  async deleteInvite(_id: string): Promise<void> {
    throw new Error('FirestoreInviteDao.deleteInvite not implemented');
  }
}
