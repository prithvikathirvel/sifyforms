import { TemplateDao, TemplateRecord, CreateTemplateData } from '../interfaces/TemplateDao';

export class FirestoreTemplateDao implements TemplateDao {
  async findTemplatesByOrg(_orgId: string): Promise<TemplateRecord[]> {
    throw new Error('FirestoreTemplateDao.listByOrg not implemented');
  }

  async findTemplateById(_id: string): Promise<TemplateRecord | null> {
    throw new Error('FirestoreTemplateDao.findTemplateById not implemented');
  }

  async createTemplate(_data: CreateTemplateData): Promise<TemplateRecord> {
    throw new Error('FirestoreTemplateDao.createTemplate not implemented');
  }
}
