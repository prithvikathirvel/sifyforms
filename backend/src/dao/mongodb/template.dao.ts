import { TemplateDao, TemplateRecord, CreateTemplateData } from '../interfaces/TemplateDao';

export class MongoTemplateDao implements TemplateDao {
  async findTemplatesByOrg(_orgId: string): Promise<TemplateRecord[]> {
    throw new Error('MongoTemplateDao.listByOrg not implemented');
  }

  async findTemplateById(_id: string): Promise<TemplateRecord | null> {
    throw new Error('MongoTemplateDao.findTemplateById not implemented');
  }

  async createTemplate(_data: CreateTemplateData): Promise<TemplateRecord> {
    throw new Error('MongoTemplateDao.createTemplate not implemented');
  }
}
