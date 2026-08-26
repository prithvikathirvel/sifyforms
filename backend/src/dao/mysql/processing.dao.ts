import prisma from '../../utils/prisma';
import {
  ProcessingResultDao, ProcessingResultRecord,
  ProcessingResultWithSubmission, AuditLogRecord,
} from '../interfaces/ProcessingResultDao';

export class MySQLProcessingResultDao implements ProcessingResultDao {
  async findResultBySubmissionId(submissionId: string): Promise<ProcessingResultRecord | null> {
    return prisma.processingResult.findUnique({ where: { submissionId } });
  }

  async findAssessmentResultsWithSubmission(formId: string): Promise<ProcessingResultWithSubmission[]> {
    return prisma.processingResult.findMany({
      where: { formId, type: 'assessment' },
      orderBy: { processedAt: 'desc' },
      include: {
        submission: { select: { id: true, createdAt: true, data: true } },
      },
    });
  }

  async findAssessmentResults(formId: string): Promise<ProcessingResultRecord[]> {
    return prisma.processingResult.findMany({
      where: { formId, type: 'assessment' },
    });
  }

  async findAuditLogsByFormId(formId: string): Promise<AuditLogRecord[]> {
    return prisma.auditLog.findMany({
      where: { formId },
      orderBy: { createdAt: 'desc' },
      select: { id: true, submissionId: true, identifier: true, createdAt: true },
    });
  }
}
