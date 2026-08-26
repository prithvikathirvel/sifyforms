import {
  FormShareDao, FormShareRecord, UpsertFormShareData,
} from '../interfaces/FormShareDao';

export class FirestoreFormShareDao implements FormShareDao {
  async upsertShare(_data: UpsertFormShareData): Promise<FormShareRecord> {
    throw new Error('FirestoreFormShareDao.upsertShare not implemented');
  }
  async findShareById(_id: string): Promise<FormShareRecord | null> {
    throw new Error('FirestoreFormShareDao.findShareById not implemented');
  }
  async findSharesByForm(_formId: string): Promise<FormShareRecord[]> {
    throw new Error('FirestoreFormShareDao.findSharesByForm not implemented');
  }
  async findActiveSharesForPrincipals(_formId: string, _userId: string, _teamIds: string[], _now: Date): Promise<FormShareRecord[]> {
    throw new Error('FirestoreFormShareDao.findActiveSharesForPrincipals not implemented');
  }
  async findFormIdsSharedWith(_userId: string, _teamIds: string[], _now: Date): Promise<string[]> {
    throw new Error('FirestoreFormShareDao.findFormIdsSharedWith not implemented');
  }
  async deleteShare(_id: string): Promise<void> {
    throw new Error('FirestoreFormShareDao.deleteShare not implemented');
  }
}
