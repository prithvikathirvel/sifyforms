import { randomUUID } from 'crypto';
import prisma from '../../utils/prisma';
import { DraftDao, DraftRecord, UpsertDraftData } from '../interfaces/DraftDao';

export class MySQLDraftDao implements DraftDao {
  async findDraftByFormIdAndSession(formId: string, sessionId: string): Promise<DraftRecord | null> {
    return prisma.draft.findUnique({
      where: { formId_sessionId: { formId, sessionId } },
    });
  }

  async upsert(data: UpsertDraftData): Promise<{ id: string; updatedAt: Date }> {
    const { formId, sessionId, identity, data: draftData, stepIndex } = data;
    const draft = await prisma.draft.upsert({
      where: { formId_sessionId: { formId, sessionId } },
      create: {
        id: randomUUID(),
        formId,
        sessionId,
        identity: identity ?? null,
        data: JSON.stringify(draftData ?? {}),
        stepIndex: stepIndex ?? 0,
      },
      update: {
        identity: identity ?? null,
        data: JSON.stringify(draftData ?? {}),
        stepIndex: stepIndex ?? 0,
        updatedAt: new Date(),
      },
    });
    return { id: draft.id, updatedAt: draft.updatedAt };
  }

  async deleteByFormAndSession(formId: string, sessionId: string): Promise<void> {
    await prisma.draft.deleteMany({ where: { formId, sessionId } });
  }
}

export const draftDao = new MySQLDraftDao();
