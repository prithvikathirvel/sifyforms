import {
  SubmissionDao, SubmissionStatusRecord, SubmissionDataRecord, SubmissionRecord,
  CreateSubmissionData, UpdateSubmissionData, SubmissionListFilter,
} from '../interfaces/SubmissionDao';

export class FirestoreSubmissionDao implements SubmissionDao {
  async findSubmissionStatusById(_id: string): Promise<SubmissionStatusRecord | null> {
    throw new Error('FirestoreSubmissionDao.findSubmissionStatusById not implemented');
  }
  async findActiveSubmissionsByFormId(_formId: string): Promise<SubmissionDataRecord[]> {
    throw new Error('FirestoreSubmissionDao.findActiveSubmissionsByFormId not implemented');
  }
  async findSubmissionDataByFormId(_formId: string): Promise<SubmissionDataRecord[]> {
    throw new Error('FirestoreSubmissionDao.findSubmissionDataByFormId not implemented');
  }
  async countSubmissionsByOrg(_orgId: string): Promise<number> {
    throw new Error('FirestoreSubmissionDao.countSubmissionsByOrg not implemented');
  }
  async countRecentSubmissionsByOrg(_orgId: string, _since: Date): Promise<number> {
    throw new Error('FirestoreSubmissionDao.countRecentSubmissionsByOrg not implemented');
  }
  async createSubmission(_data: CreateSubmissionData): Promise<SubmissionRecord> {
    throw new Error('FirestoreSubmissionDao.createSubmission not implemented');
  }
  async findSubmissionsByFormId(_formId: string, _skip: number, _take: number, _filter: SubmissionListFilter): Promise<SubmissionRecord[]> {
    throw new Error('FirestoreSubmissionDao.findSubmissionsByFormId not implemented');
  }
  async countSubmissionsByFormId(_formId: string, _filter: SubmissionListFilter): Promise<number> {
    throw new Error('FirestoreSubmissionDao.countSubmissionsByFormId not implemented');
  }
  async findSubmissionByIdAndForm(_id: string, _formId: string): Promise<SubmissionRecord | null> {
    throw new Error('FirestoreSubmissionDao.findSubmissionByIdAndForm not implemented');
  }
  async markSubmissionAsRead(_id: string): Promise<void> {
    throw new Error('FirestoreSubmissionDao.markSubmissionAsRead not implemented');
  }
  async updateSubmission(_id: string, _data: UpdateSubmissionData): Promise<SubmissionRecord> {
    throw new Error('FirestoreSubmissionDao.updateSubmission not implemented');
  }
  async deleteSubmissionById(_id: string): Promise<void> {
    throw new Error('FirestoreSubmissionDao.deleteSubmissionById not implemented');
  }
  async findSubmissionsForExport(_formId: string, _ids?: string[]): Promise<SubmissionRecord[]> {
    throw new Error('FirestoreSubmissionDao.findSubmissionsForExport not implemented');
  }
  async bulkDeleteSubmissions(_formId: string, _ids: string[]): Promise<void> {
    throw new Error('FirestoreSubmissionDao.bulkDeleteSubmissions not implemented');
  }
}
