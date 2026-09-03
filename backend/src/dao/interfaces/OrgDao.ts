export interface OrgRecord {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  industry: string | null;
  ownerId: string;
  provisioningStatus: string;
  umsSyncedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface OrgWithCount extends OrgRecord {
  _count: { forms: number };
}

export interface MemberEntry {
  role: string;
  roleId: string | null;
  org: OrgWithCount;
}

export interface OrgUserInfo {
  id: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
}

export interface OrgDetailRecord extends OrgRecord {
  owner: OrgUserInfo;
  _count: { forms: number; users: number };
}

export interface OrgMember {
  role: string;
  roleId: string | null;
  joinedAt: Date;
  user: OrgUserInfo;
}

export interface OrgWithUsersRecord {
  id: string;
  ownerId: string;
  owner: OrgUserInfo;
  users: OrgMember[];
}

export interface CreateOrgData {
  name: string;
  slug: string;
  logo?: string | null;
  industry?: string | null;
  ownerId: string;
  provisioningStatus?: string;
}

export interface UpdateOrgData {
  name?: string;
  logo?: string | null;
  industry?: string | null;
}

export interface OrgDao {
  findOrgBySlug(slug: string): Promise<OrgRecord | null>;
  createOrg(data: CreateOrgData): Promise<OrgRecord>;
  findOwnedOrgsByUserId(userId: string): Promise<OrgWithCount[]>;
  findMemberOrgsByUserId(userId: string): Promise<MemberEntry[]>;
  findOrgById(id: string): Promise<OrgDetailRecord | null>;
  findOrgOwnerById(id: string): Promise<{ id: string; ownerId: string } | null>;
  updateOrg(id: string, data: UpdateOrgData): Promise<OrgRecord>;
  /** PROVISIONING | ACTIVE | FAILED | DELETING. Stamps `umsSyncedAt` when set to ACTIVE. */
  setOrgProvisioningStatus(id: string, status: string): Promise<void>;
  deleteOrg(id: string): Promise<void>;
  findOrgWithUsersById(id: string): Promise<OrgWithUsersRecord | null>;
  findOrgMember(
    orgId: string,
    userId: string
  ): Promise<{ orgId: string; userId: string; role: string; roleId: string | null } | null>;

  /**
   * `role` is the role NAME, cached here so member listings render without a
   * call per user; `roleId` points at the authoritative role in the RBAC service.
   */
  createOrgMember(
    orgId: string,
    userId: string,
    role: string,
    roleId?: string | null,
    invitedBy?: string | null
  ): Promise<void>;

  updateOrgMemberRole(
    orgId: string,
    userId: string,
    role: string,
    roleId: string | null
  ): Promise<void>;

  deleteOrgMember(orgId: string, userId: string): Promise<void>;
}
