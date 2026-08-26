import prisma from '../../utils/prisma';
import {
  FormShareDao,
  FormShareRecord,
  UpsertFormShareData,
} from '../interfaces/FormShareDao';

export class MySQLFormShareDao implements FormShareDao {
  async upsertShare(data: UpsertFormShareData): Promise<FormShareRecord> {
    const { formId, principalType, principalId, ...terms } = data;
    return prisma.formShare.upsert({
      where: {
        formId_principalType_principalId: { formId, principalType, principalId },
      },
      create: { formId, principalType, principalId, ...terms },
      update: {
        level: terms.level,
        canEdit: terms.canEdit,
        expiresAt: terms.expiresAt,
        createdBy: terms.createdBy,
      },
    });
  }

  async findShareById(id: string): Promise<FormShareRecord | null> {
    return prisma.formShare.findUnique({ where: { id } });
  }

  async findSharesByForm(formId: string): Promise<FormShareRecord[]> {
    return prisma.formShare.findMany({ where: { formId }, orderBy: { createdAt: 'desc' } });
  }

  async findActiveSharesForPrincipals(
    formId: string,
    userId: string,
    teamIds: string[],
    now: Date
  ): Promise<FormShareRecord[]> {
    return prisma.formShare.findMany({
      where: {
        formId,
        // An expiry that is only rendered, never queried, is not an expiry.
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        AND: [
          {
            OR: [
              { principalType: 'USER', principalId: userId },
              ...(teamIds.length ? [{ principalType: 'TEAM', principalId: { in: teamIds } }] : []),
            ],
          },
        ],
      },
    });
  }

  async findFormIdsSharedWith(userId: string, teamIds: string[], now: Date): Promise<string[]> {
    const shares = await prisma.formShare.findMany({
      where: {
        OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
        AND: [
          {
            OR: [
              { principalType: 'USER', principalId: userId },
              ...(teamIds.length ? [{ principalType: 'TEAM', principalId: { in: teamIds } }] : []),
            ],
          },
        ],
      },
      select: { formId: true },
    });
    return [...new Set(shares.map((s: { formId: string }) => s.formId))] as string[];
  }

  async deleteShare(id: string): Promise<void> {
    await prisma.formShare.delete({ where: { id } });
  }
}
