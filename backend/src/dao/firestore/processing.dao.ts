import {
  ProcessingResultDao, ProcessingResultRecord,
  ProcessingResultWithSubmission, AuditLogRecord,
} from '../interfaces/ProcessingResultDao';

export class FirestoreProcessingResultDao implements ProcessingResultDao {
  async findResultBySubmissionId(_submissionId: string): Promise<ProcessingResultRecord | null> {
    throw new Error('FirestoreProcessingResultDao.findResultBySubmissionId not implemented');
  }
  async findAssessmentResultsWithSubmission(_formId: string): Promise<ProcessingResultWithSubmission[]> {
    throw new Error('FirestoreProcessingResultDao.findAssessmentResultsWithSubmission not implemented');
  }
  async findAssessmentResults(_formId: string): Promise<ProcessingResultRecord[]> {
    throw new Error('FirestoreProcessingResultDao.findAssessmentResults not implemented');
  }
  async findAuditLogsByFormId(_formId: string): Promise<AuditLogRecord[]> {
    throw new Error('FirestoreProcessingResultDao.findAuditLogsByFormId not implemented');
  }
}
