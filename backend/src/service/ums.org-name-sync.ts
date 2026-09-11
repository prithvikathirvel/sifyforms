import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { UMS_ORG_NAME_SYNC_ENABLED } from '../config/ums.config';
import { createError } from '../utils/errors';
import { syncOrganisationName } from './ums.client';

export async function syncLatestOrganizationName(orgId: string): Promise<void> {
  if (!UMS_ORG_NAME_SYNC_ENABLED) throw createError(503, 'Organization name sync is not enabled');
  await prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
    await transaction.$queryRaw`SELECT id FROM Organization WHERE id = ${orgId} FOR UPDATE`;
    const org = await transaction.organization.findUnique({ where: { id: orgId } });
    if (!org || org.provisioningStatus === 'DELETING') return;
    if (org.provisioningStatus !== 'ACTIVE') throw createError(409, 'Organization is not active for name sync');
    await syncOrganisationName(org.id, org.name);
    await transaction.organization.update({ where: { id: org.id }, data: { umsSyncedAt: new Date() } });
  }, { maxWait: 5000, timeout: 60000, isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted });
}