import { DraftDao, DraftRecord, UpsertDraftData } from '../interfaces/DraftDao';

export class MongoDraftDao implements DraftDao {
  async findDraftByFormIdAndIdentity(_formId: string, _identity: string): Promise<DraftRecord | null> {
    throw new Error('MongoDraftDao.findByFormAndIdentity not implemented');
  }

  async upsert(_data: UpsertDraftData): Promise<{ id: string; updatedAt: Date }> {
    throw new Error('MongoDraftDao.upsert not implemented');
  }

  async deleteByFormAndIdentity(_formId: string, _identity: string): Promise<void> {
    throw new Error('MongoDraftDao.deleteByFormAndIdentity not implemented');
  }
}
