import prisma from '../../utils/prisma';
import {
  SubmissionDao, SubmissionStatusRecord, SubmissionDataRecord, SubmissionRecord,
  CreateSubmissionData, UpdateSubmissionData, SubmissionListFilter,
} from '../interfaces/SubmissionDao';

export class MySQLSubmissionDao implements SubmissionDao {
  async findSubmissionStatusById(id: string): Promise<SubmissionStatusRecord | null> {
    return prisma.submission.findUnique({
      where: { id },
      select: { processingStatus: true, formId: true },
    });
  }

  async findActiveSubmissionsByFormId(formId: string): Promise<SubmissionDataRecord[]> {
    return prisma.submission.findMany({
      where: { formId, processingStatus: { not: 'failed' } },
      select: { data: true },
    });
  }

  async findSubmissionDataByFormId(formId: string): Promise<SubmissionDataRecord[]> {
    return prisma.submission.findMany({ where: { formId }, select: { data: true } });
  }

  async countSubmissionsByOrg(orgId: string): Promise<number> {
    return prisma.submission.count({ where: { form: { orgId } } });
  }

  async countRecentSubmissionsByOrg(orgId: string, since: Date): Promise<number> {
    return prisma.submission.count({ where: { form: { orgId }, createdAt: { gte: since } } });
  }

  async createSubmission(data: CreateSubmissionData): Promise<SubmissionRecord> {
    return prisma.submission.create({ data });
  }

  private buildWhere(formId: string, filter: SubmissionListFilter): Record<string, unknown> {
    const where: Record<string, unknown> = { formId };
    if (filter.isRead !== undefined) where.isRead = filter.isRead;
    if (filter.createdAtGte || filter.createdAtLte) {
      where.createdAt = {
        ...(filter.createdAtGte && { gte: filter.createdAtGte }),
        ...(filter.createdAtLte && { lte: filter.createdAtLte }),
      };
    }
    return where;
  }

  async findSubmissionsByFormId(formId: string, skip: number, take: number, filter: SubmissionListFilter): Promise<SubmissionRecord[]> {
    return prisma.submission.findMany({
      where: this.buildWhere(formId, filter) as any,
      orderBy: { createdAt: 'desc' },
      skip,
      take,
    });
  }

  async countSubmissionsByFormId(formId: string, filter: SubmissionListFilter): Promise<number> {
    return prisma.submission.count({ where: this.buildWhere(formId, filter) as any });
  }

  async findSubmissionByIdAndForm(id: string, formId: string): Promise<SubmissionRecord | null> {
    return prisma.submission.findFirst({ where: { id, formId } });
  }

  async markSubmissionAsRead(id: string): Promise<void> {
    await prisma.submission.update({ where: { id }, data: { isRead: true } });
  }

  async updateSubmission(id: string, data: UpdateSubmissionData): Promise<SubmissionRecord> {
    return prisma.submission.update({ where: { id }, data });
  }

  async deleteSubmissionById(id: string): Promise<void> {
    await prisma.submission.delete({ where: { id } });
  }

  async findSubmissionsForExport(formId: string, ids?: string[]): Promise<SubmissionRecord[]> {
    const where: Record<string, unknown> = { formId };
    if (ids && ids.length > 0) where.id = { in: ids };
    return prisma.submission.findMany({ where: where as any, orderBy: { createdAt: 'desc' } });
  }

  async bulkDeleteSubmissions(formId: string, ids: string[]): Promise<void> {
    await prisma.submission.deleteMany({ where: { id: { in: ids }, formId } });
  }
}

