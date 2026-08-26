export interface ProcessingResultRecord {
  id: string;
  submissionId: string;
  formId: string;
  type: string;
  result: string; // JSON
  processedAt: Date;
}

export interface ProcessingResultWithSubmission extends ProcessingResultRecord {
  submission: {
    id: string;
    createdAt: Date;
    data: string;
  };
}

export interface AuditLogRecord {
  id: string;
  submissionId: string;
  identifier: string;
  createdAt: Date;
}

export interface ProcessingResultDao {
  findResultBySubmissionId(submissionId: string): Promise<ProcessingResultRecord | null>;
  findAssessmentResultsWithSubmission(formId: string): Promise<ProcessingResultWithSubmission[]>;
  findAssessmentResults(formId: string): Promise<ProcessingResultRecord[]>;
  findAuditLogsByFormId(formId: string): Promise<AuditLogRecord[]>;
}
