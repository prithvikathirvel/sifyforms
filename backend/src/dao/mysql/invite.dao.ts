import prisma from '../../utils/prisma';
import {
  InviteDao,
  InviteRecord,
  InviteStatus,
  InviteWithOrg,
  CreateInviteData,
} from '../interfaces/InviteDao';

const ORG_SUMMARY = {
  select: { id: true, name: true, slug: true, logo: true, industry: true },
} as const;

export class MySQLInviteDao implements InviteDao {
  async upsertInvite(data: CreateInviteData): Promise<InviteRecord> {
    // The (orgId, email) unique key means re-inviting someone whose invite was
    // revoked or rejected reopens that row rather than piling up history.
    return prisma.orgInvite.upsert({
      where: { orgId_email: { orgId: data.orgId, email: data.email } },
      create: {
        email: data.email,
        orgId: data.orgId,
        roleId: data.roleId,
        role: data.role,
        invitedBy: data.invitedBy,
        inviteStatus: 'PENDING',
      },
      update: {
        roleId: data.roleId,
        role: data.role,
        invitedBy: data.invitedBy,
        inviteStatus: 'PENDING',
        respondedAt: null,
        createdAt: new Date(),
      },
    });
  }

  async findInviteById(id: string): Promise<InviteWithOrg | null> {
    return prisma.orgInvite.findUnique({
      where: { id },
      include: { org: ORG_SUMMARY },
    });
  }

  async findInviteByOrgAndEmail(orgId: string, email: string): Promise<InviteRecord | null> {
    return prisma.orgInvite.findUnique({
      where: { orgId_email: { orgId, email } },
    });
  }

  async findInvitesByEmail(email: string, status?: InviteStatus): Promise<InviteWithOrg[]> {
    return prisma.orgInvite.findMany({
      where: { email, ...(status ? { inviteStatus: status } : {}) },
      include: { org: ORG_SUMMARY },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findInvitesByOrg(orgId: string, status?: InviteStatus): Promise<InviteRecord[]> {
    return prisma.orgInvite.findMany({
      where: { orgId, ...(status ? { inviteStatus: status } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateInviteStatus(id: string, status: InviteStatus): Promise<InviteRecord> {
    return prisma.orgInvite.update({
      where: { id },
      data: { inviteStatus: status, respondedAt: new Date() },
    });
  }

  async deleteInvite(id: string): Promise<void> {
    await prisma.orgInvite.delete({ where: { id } });
  }
}
