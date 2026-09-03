import prisma from '../../utils/prisma';
import {
  OrgDao, OrgRecord, OrgWithCount, MemberEntry,
  OrgDetailRecord, OrgWithUsersRecord, CreateOrgData, UpdateOrgData,
} from '../interfaces/OrgDao';

export class MySQLOrgDao implements OrgDao {
  async findOrgBySlug(slug: string): Promise<OrgRecord | null> {
    return prisma.organization.findUnique({ where: { slug } });
  }

  async createOrg(data: CreateOrgData): Promise<OrgRecord> {
    return prisma.organization.create({ data });
  }

  async findOwnedOrgsByUserId(userId: string): Promise<OrgWithCount[]> {
    return prisma.organization.findMany({
      where: { ownerId: userId },
      include: { _count: { select: { forms: true } } },
    });
  }

  async findMemberOrgsByUserId(userId: string): Promise<MemberEntry[]> {
    return prisma.orgUser.findMany({
      where: { userId },
      include: {
        org: { include: { _count: { select: { forms: true } } } },
      },
    });
  }

  async findOrgById(id: string): Promise<OrgDetailRecord | null> {
    return prisma.organization.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        _count: { select: { forms: true, users: true } },
      },
    });
  }

  async findOrgOwnerById(id: string): Promise<{ id: string; ownerId: string } | null> {
    return prisma.organization.findUnique({
      where: { id },
      select: { id: true, ownerId: true },
    });
  }

  async updateOrg(id: string, data: UpdateOrgData): Promise<OrgRecord> {
    return prisma.organization.update({ where: { id }, data });
  }

  async setOrgProvisioningStatus(id: string, status: string): Promise<void> {
    await prisma.organization.update({
      where: { id },
      data: {
        provisioningStatus: status,
        ...(status === 'ACTIVE' ? { umsSyncedAt: new Date() } : {}),
      },
    });
  }

  async deleteOrg(id: string): Promise<void> {
    await prisma.organization.delete({ where: { id } });
  }

  async findOrgWithUsersById(id: string): Promise<OrgWithUsersRecord | null> {
    return prisma.organization.findUnique({
      where: { id },
      select: {
        id: true,
        ownerId: true,
        owner: { select: { id: true, firstName: true, lastName: true, email: true } },
        users: {
          select: {
            role: true,
            roleId: true,
            joinedAt: true,
            user: { select: { id: true, firstName: true, lastName: true, email: true } },
          },
          orderBy: { joinedAt: 'asc' },
        },
      },
    });
  }

  async findOrgMember(
    orgId: string,
    userId: string
  ): Promise<{ orgId: string; userId: string; role: string; roleId: string | null } | null> {
    return prisma.orgUser.findUnique({
      where: { orgId_userId: { orgId, userId } },
      select: { orgId: true, userId: true, role: true, roleId: true },
    });
  }

  async createOrgMember(
    orgId: string,
    userId: string,
    role: string,
    roleId: string | null = null,
    invitedBy: string | null = null
  ): Promise<void> {
    await prisma.orgUser.create({ data: { orgId, userId, role, roleId, invitedBy } });
  }

  async updateOrgMemberRole(
    orgId: string,
    userId: string,
    role: string,
    roleId: string | null
  ): Promise<void> {
    await prisma.orgUser.update({
      where: { orgId_userId: { orgId, userId } },
      data: { role, roleId },
    });
  }

  async deleteOrgMember(orgId: string, userId: string): Promise<void> {
    await prisma.orgUser.delete({ where: { orgId_userId: { orgId, userId } } });
  }
}
