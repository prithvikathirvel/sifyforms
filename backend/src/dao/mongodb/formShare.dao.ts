import {
  FormShareDao, FormShareRecord, UpsertFormShareData,
} from '../interfaces/FormShareDao';

export class MongoFormShareDao implements FormShareDao {
  async upsertShare(_data: UpsertFormShareData): Promise<FormShareRecord> {
    throw new Error('MongoFormShareDao.upsertShare not implemented');
  }
  async findShareById(_id: string): Promise<FormShareRecord | null> {
    throw new Error('MongoFormShareDao.findShareById not implemented');
  }
  async findSharesByForm(_formId: string): Promise<FormShareRecord[]> {
    throw new Error('MongoFormShareDao.findSharesByForm not implemented');
  }
  async findActiveSharesForPrincipals(_formId: string, _userId: string, _teamIds: string[], _now: Date): Promise<FormShareRecord[]> {
    throw new Error('MongoFormShareDao.findActiveSharesForPrincipals not implemented');
  }
  async findFormIdsSharedWith(_userId: string, _teamIds: string[], _now: Date): Promise<string[]> {
    throw new Error('MongoFormShareDao.findFormIdsSharedWith not implemented');
  }
  async deleteShare(_id: string): Promise<void> {
    throw new Error('MongoFormShareDao.deleteShare not implemented');
  }
}
