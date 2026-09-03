import {
  OrgDao, OrgRecord, OrgWithCount, MemberEntry,
  OrgDetailRecord, OrgWithUsersRecord, CreateOrgData, UpdateOrgData,
} from '../interfaces/OrgDao';

export class MongoOrgDao implements OrgDao {
  async findOrgBySlug(_slug: string): Promise<OrgRecord | null> {
    throw new Error('MongoOrgDao.findOrgBySlug not implemented');
  }
  async createOrg(_data: CreateOrgData): Promise<OrgRecord> {
    throw new Error('MongoOrgDao.createOrg not implemented');
  }
  async findOwnedOrgsByUserId(_userId: string): Promise<OrgWithCount[]> {
    throw new Error('MongoOrgDao.findOwnedOrgsByUserId not implemented');
  }
  async findMemberOrgsByUserId(_userId: string): Promise<MemberEntry[]> {
    throw new Error('MongoOrgDao.findMemberOrgsByUserId not implemented');
  }
  async findOrgById(_id: string): Promise<OrgDetailRecord | null> {
    throw new Error('MongoOrgDao.findOrgById not implemented');
  }
  async findOrgOwnerById(_id: string): Promise<{ id: string; ownerId: string } | null> {
    throw new Error('MongoOrgDao.findOrgOwnerById not implemented');
  }
  async updateOrg(_id: string, _data: UpdateOrgData): Promise<OrgRecord> {
    throw new Error('MongoOrgDao.updateOrg not implemented');
  }
  async setOrgProvisioningStatus(_id: string, _status: string): Promise<void> {
    throw new Error('MongoOrgDao.setOrgProvisioningStatus not implemented');
  }
  async deleteOrg(_id: string): Promise<void> {
    throw new Error('MongoOrgDao.deleteOrg not implemented');
  }
  async findOrgWithUsersById(_id: string): Promise<OrgWithUsersRecord | null> {
    throw new Error('MongoOrgDao.findOrgWithUsersById not implemented');
  }
  async findOrgMember(_orgId: string, _userId: string): Promise<{ orgId: string; userId: string; role: string; roleId: string | null } | null> {
    throw new Error('MongoOrgDao.findOrgMember not implemented');
  }
  async createOrgMember(_orgId: string, _userId: string, _role: string, _roleId?: string | null, _invitedBy?: string | null): Promise<void> {
    throw new Error('MongoOrgDao.createOrgMember not implemented');
  }
  async updateOrgMemberRole(_orgId: string, _userId: string, _role: string, _roleId: string | null): Promise<void> {
    throw new Error('MongoOrgDao.updateOrgMemberRole not implemented');
  }
  async deleteOrgMember(_orgId: string, _userId: string): Promise<void> {
    throw new Error('MongoOrgDao.deleteOrgMember not implemented');
  }
}
