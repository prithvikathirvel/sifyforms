import {
  SubmissionDao, SubmissionStatusRecord, SubmissionDataRecord, SubmissionRecord,
  CreateSubmissionData, UpdateSubmissionData, SubmissionListFilter,
} from '../interfaces/SubmissionDao';

export class MongoSubmissionDao implements SubmissionDao {
  async findSubmissionStatusById(_id: string): Promise<SubmissionStatusRecord | null> {
    throw new Error('MongoSubmissionDao.findSubmissionStatusById not implemented');
  }
  async findActiveSubmissionsByFormId(_formId: string): Promise<SubmissionDataRecord[]> {
    throw new Error('MongoSubmissionDao.findActiveSubmissionsByFormId not implemented');
  }
  async findSubmissionDataByFormId(_formId: string): Promise<SubmissionDataRecord[]> {
    throw new Error('MongoSubmissionDao.findSubmissionDataByFormId not implemented');
  }
  async countSubmissionsByOrg(_orgId: string): Promise<number> {
    throw new Error('MongoSubmissionDao.countSubmissionsByOrg not implemented');
  }
  async countRecentSubmissionsByOrg(_orgId: string, _since: Date): Promise<number> {
    throw new Error('MongoSubmissionDao.countRecentSubmissionsByOrg not implemented');
  }
  async createSubmission(_data: CreateSubmissionData): Promise<SubmissionRecord> {
    throw new Error('MongoSubmissionDao.createSubmission not implemented');
  }
  async findSubmissionsByFormId(_formId: string, _skip: number, _take: number, _filter: SubmissionListFilter): Promise<SubmissionRecord[]> {
    throw new Error('MongoSubmissionDao.findSubmissionsByFormId not implemented');
  }
  async countSubmissionsByFormId(_formId: string, _filter: SubmissionListFilter): Promise<number> {
    throw new Error('MongoSubmissionDao.countSubmissionsByFormId not implemented');
  }
  async findSubmissionByIdAndForm(_id: string, _formId: string): Promise<SubmissionRecord | null> {
    throw new Error('MongoSubmissionDao.findSubmissionByIdAndForm not implemented');
  }
  async markSubmissionAsRead(_id: string): Promise<void> {
    throw new Error('MongoSubmissionDao.markSubmissionAsRead not implemented');
  }
  async updateSubmission(_id: string, _data: UpdateSubmissionData): Promise<SubmissionRecord> {
    throw new Error('MongoSubmissionDao.updateSubmission not implemented');
  }
  async deleteSubmissionById(_id: string): Promise<void> {
    throw new Error('MongoSubmissionDao.deleteSubmissionById not implemented');
  }
  async findSubmissionsForExport(_formId: string, _ids?: string[]): Promise<SubmissionRecord[]> {
    throw new Error('MongoSubmissionDao.findSubmissionsForExport not implemented');
  }
  async bulkDeleteSubmissions(_formId: string, _ids: string[]): Promise<void> {
    throw new Error('MongoSubmissionDao.bulkDeleteSubmissions not implemented');
  }
}
