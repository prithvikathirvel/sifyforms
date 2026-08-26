import {
  ProcessingResultDao, ProcessingResultRecord,
  ProcessingResultWithSubmission, AuditLogRecord,
} from '../interfaces/ProcessingResultDao';

export class MongoProcessingResultDao implements ProcessingResultDao {
  async findResultBySubmissionId(_submissionId: string): Promise<ProcessingResultRecord | null> {
    throw new Error('MongoProcessingResultDao.findResultBySubmissionId not implemented');
  }
  async findAssessmentResultsWithSubmission(_formId: string): Promise<ProcessingResultWithSubmission[]> {
    throw new Error('MongoProcessingResultDao.findAssessmentResultsWithSubmission not implemented');
  }
  async findAssessmentResults(_formId: string): Promise<ProcessingResultRecord[]> {
    throw new Error('MongoProcessingResultDao.findAssessmentResults not implemented');
  }
  async findAuditLogsByFormId(_formId: string): Promise<AuditLogRecord[]> {
    throw new Error('MongoProcessingResultDao.findAuditLogsByFormId not implemented');
  }
}
