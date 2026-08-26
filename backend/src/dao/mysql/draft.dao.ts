import { randomUUID } from 'crypto';
import prisma from '../../utils/prisma';
import { DraftDao, DraftRecord, UpsertDraftData } from '../interfaces/DraftDao';

export class MySQLDraftDao implements DraftDao {
  async findDraftByFormIdAndIdentity(formId: string, identity: string): Promise<DraftRecord | null> {
    return prisma.draft.findUnique({
      where: { formId_identity: { formId, identity } },
    });
  }

  async upsert(data: UpsertDraftData): Promise<{ id: string; updatedAt: Date }> {
    const { formId, identity, data: draftData, stepIndex } = data;
    const draft = await prisma.draft.upsert({
      where: { formId_identity: { formId, identity } },
      create: {
        id: randomUUID(),
        formId,
        identity,
        data: JSON.stringify(draftData ?? {}),
        stepIndex: stepIndex ?? 0,
      },
      update: {
        data: JSON.stringify(draftData ?? {}),
        stepIndex: stepIndex ?? 0,
        updatedAt: new Date(),
      },
    });
    return { id: draft.id, updatedAt: draft.updatedAt };
  }

  async deleteByFormAndIdentity(formId: string, identity: string): Promise<void> {
    await prisma.draft.deleteMany({ where: { formId, identity } });
  }
}

export const draftDao = new MySQLDraftDao();
