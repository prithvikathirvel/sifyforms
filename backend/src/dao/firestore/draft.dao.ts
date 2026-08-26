import { DraftDao, DraftRecord, UpsertDraftData } from '../interfaces/DraftDao';

export class FirestoreDraftDao implements DraftDao {
  async findDraftByFormIdAndIdentity(_formId: string, _identity: string): Promise<DraftRecord | null> {
    throw new Error('FirestoreDraftDao.findByFormAndIdentity not implemented');
  }

  async upsert(_data: UpsertDraftData): Promise<{ id: string; updatedAt: Date }> {
    throw new Error('FirestoreDraftDao.upsert not implemented');
  }

  async deleteByFormAndIdentity(_formId: string, _identity: string): Promise<void> {
    throw new Error('FirestoreDraftDao.deleteByFormAndIdentity not implemented');
  }
}
