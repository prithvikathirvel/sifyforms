import { DraftDao, DraftRecord, UpsertDraftData } from '../interfaces/DraftDao';

export class MongoDraftDao implements DraftDao {
  async findDraftByFormIdAndSession(_formId: string, _sessionId: string): Promise<DraftRecord | null> {
    throw new Error('MongoDraftDao.findDraftByFormIdAndSession not implemented');
  }

  async upsert(_data: UpsertDraftData): Promise<{ id: string; updatedAt: Date }> {
    throw new Error('MongoDraftDao.upsert not implemented');
  }

  async deleteByFormAndSession(_formId: string, _sessionId: string): Promise<void> {
    throw new Error('MongoDraftDao.deleteByFormAndSession not implemented');
  }
}
