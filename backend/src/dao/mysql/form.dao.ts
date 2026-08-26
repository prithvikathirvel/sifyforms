import prisma from '../../utils/prisma';
import {
  FormDao,
  FormOwnershipRecord, FormRecord, FullFormRecord, CreateFormData, UpdateFormData,
  FormWithCount, FormWithOrg, FormPublished, PublicFormRecord,
} from '../interfaces/FormDao';

export class MySQLFormDao implements FormDao {
  async findFormById(id: string): Promise<FormRecord | null> {
    return prisma.form.findUnique({
      where: { id },
      select: { id: true, schema: true, settings: true, isPublished: true },
    });
  }

  async findFormByIdAndOrg(id: string, orgId: string): Promise<FullFormRecord | null> {
    return prisma.form.findFirst({ where: { id, orgId } });
  }

  async findFormByIdAndOrgWithOrg(id: string, orgId: string): Promise<FormWithOrg | null> {
    return prisma.form.findFirst({
      where: { id, orgId },
      include: {
        _count: { select: { submissions: true } },
        org: { select: { slug: true, name: true } },
      },
    });
  }

  async findFormBySlugUnique(orgId: string, slug: string): Promise<{ id: string } | null> {
    return prisma.form.findUnique({
      where: { orgId_slug: { orgId, slug } },
      select: { id: true },
    });
  }

  async findFormsByOrg(orgId: string): Promise<FormWithCount[]> {
    return prisma.form.findMany({
      where: { orgId },
      include: { _count: { select: { submissions: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findFormOwnership(id: string): Promise<FormOwnershipRecord | null> {
    return prisma.form.findUnique({
      where: { id },
      select: {
        id: true,
        orgId: true,
        teamId: true,
        responsePolicy: true,
        responsePolicyLockedAt: true,
        createdBy: true,
      },
    });
  }

  async findFormsByTeams(
    orgId: string,
    teamIds: string[],
    includeUnassigned: boolean
  ): Promise<FormWithCount[]> {
    // `teamId: null` covers forms whose team was deleted; they are still the
    // organization's, and admins must be able to find and re-home them.
    const scopes: any[] = [];
    if (teamIds.length > 0) scopes.push({ teamId: { in: teamIds } });
    if (includeUnassigned) scopes.push({ teamId: null });
    if (scopes.length === 0) return [];

    return prisma.form.findMany({
      where: { orgId, OR: scopes },
      include: { _count: { select: { submissions: true } } },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async reassignFormsToTeam(fromTeamId: string, toTeamId: string | null): Promise<number> {
    const result = await prisma.form.updateMany({
      where: { teamId: fromTeamId },
      data: { teamId: toTeamId },
    });
    return result.count;
  }

  async findPublicForm(orgId: string, formSlug: string): Promise<PublicFormRecord | null> {
    return prisma.form.findFirst({
      where: { orgId, slug: formSlug, isPublished: true },
      include: { org: { select: { name: true, slug: true, logo: true } } },
    });
  }

  async createForm(data: CreateFormData): Promise<FullFormRecord> {
    return prisma.form.create({ data });
  }

  async updateForm(id: string, data: UpdateFormData): Promise<FullFormRecord> {
    return prisma.form.update({ where: { id }, data });
  }

  async deleteForm(id: string): Promise<void> {
    await prisma.form.delete({ where: { id } });
  }

  async publishForm(id: string): Promise<FormPublished> {
    return prisma.form.update({
      where: { id },
      data: { isPublished: true },
      include: { org: { select: { slug: true } } },
    });
  }

  async countFormsByOrg(orgId: string): Promise<number> {
    return prisma.form.count({ where: { orgId } });
  }
}

export const formDao = new MySQLFormDao();

