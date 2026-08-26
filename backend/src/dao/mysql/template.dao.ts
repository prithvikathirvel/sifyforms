import prisma from '../../utils/prisma';
import { TemplateDao, TemplateRecord, CreateTemplateData } from '../interfaces/TemplateDao';

export class MySQLTemplateDao implements TemplateDao {
  async findTemplatesByOrg(orgId: string): Promise<TemplateRecord[]> {
    return prisma.template.findMany({
      where: { OR: [{ isStatic: true }, { orgId }] },
      orderBy: [{ isStatic: 'desc' }, { createdAt: 'desc' }],
    });
  }

  async findTemplateById(id: string): Promise<TemplateRecord | null> {
    return prisma.template.findUnique({ where: { id } });
  }

  async createTemplate(data: CreateTemplateData): Promise<TemplateRecord> {
    return prisma.template.create({ data });
  }
}
