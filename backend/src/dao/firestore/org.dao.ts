import {
  OrgDao, OrgRecord, OrgWithCount, MemberEntry,
  OrgDetailRecord, OrgWithUsersRecord, CreateOrgData, UpdateOrgData,
} from '../interfaces/OrgDao';

export class FirestoreOrgDao implements OrgDao {
  async findOrgBySlug(_slug: string): Promise<OrgRecord | null> {
    throw new Error('FirestoreOrgDao.findOrgBySlug not implemented');
  }
  async createOrg(_data: CreateOrgData): Promise<OrgRecord> {
    throw new Error('FirestoreOrgDao.createOrg not implemented');
  }
  async findOwnedOrgsByUserId(_userId: string): Promise<OrgWithCount[]> {
    throw new Error('FirestoreOrgDao.findOwnedOrgsByUserId not implemented');
  }
  async findMemberOrgsByUserId(_userId: string): Promise<MemberEntry[]> {
    throw new Error('FirestoreOrgDao.findMemberOrgsByUserId not implemented');
  }
  async findOrgById(_id: string): Promise<OrgDetailRecord | null> {
    throw new Error('FirestoreOrgDao.findOrgById not implemented');
  }
  async findOrgOwnerById(_id: string): Promise<{ id: string; ownerId: string } | null> {
    throw new Error('FirestoreOrgDao.findOrgOwnerById not implemented');
  }
  async updateOrg(_id: string, _data: UpdateOrgData): Promise<OrgRecord> {
    throw new Error('FirestoreOrgDao.updateOrg not implemented');
  }
  async deleteOrg(_id: string): Promise<void> {
    throw new Error('FirestoreOrgDao.deleteOrg not implemented');
  }
  async findOrgWithUsersById(_id: string): Promise<OrgWithUsersRecord | null> {
    throw new Error('FirestoreOrgDao.findOrgWithUsersById not implemented');
  }
  async findOrgMember(_orgId: string, _userId: string): Promise<{ orgId: string; userId: string; role: string; roleId: string | null } | null> {
    throw new Error('FirestoreOrgDao.findOrgMember not implemented');
  }
  async createOrgMember(_orgId: string, _userId: string, _role: string, _roleId?: string | null, _invitedBy?: string | null): Promise<void> {
    throw new Error('FirestoreOrgDao.createOrgMember not implemented');
  }
  async updateOrgMemberRole(_orgId: string, _userId: string, _role: string, _roleId: string | null): Promise<void> {
    throw new Error('FirestoreOrgDao.updateOrgMemberRole not implemented');
  }
  async deleteOrgMember(_orgId: string, _userId: string): Promise<void> {
    throw new Error('FirestoreOrgDao.deleteOrgMember not implemented');
  }
}
