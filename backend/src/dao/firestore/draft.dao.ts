import { DraftDao, DraftRecord, UpsertDraftData } from '../interfaces/DraftDao';

export class FirestoreDraftDao implements DraftDao {
  async findDraftByFormIdAndSession(_formId: string, _sessionId: string): Promise<DraftRecord | null> {
    throw new Error('FirestoreDraftDao.findDraftByFormIdAndSession not implemented');
  }

  async upsert(_data: UpsertDraftData): Promise<{ id: string; updatedAt: Date }> {
    throw new Error('FirestoreDraftDao.upsert not implemented');
  }

  async deleteByFormAndSession(_formId: string, _sessionId: string): Promise<void> {
    throw new Error('FirestoreDraftDao.deleteByFormAndSession not implemented');
  }
}
