import dotenv from 'dotenv';
dotenv.config({ quiet: true });

import { writeFileSync } from 'fs';
import { Prisma } from '@prisma/client';
import prisma from '../utils/prisma';
import { UMS_APP_ID, UMS_ORG_NAME_SYNC_ENABLED, UMS_OUTBOX_ENABLED } from '../config/ums.config';
import { hasServiceCredentials, listOrganisations } from '../service/ums.client';
import { listKeycloakOrganizations } from '../service/keycloak.admin';
import { enqueue } from '../service/ums.outbox';

function normalizedName(name: string): string {
  return name.trim().toLowerCase();
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let apply = false;
  let verify = false;
  let all = false;
  let orgId: string | undefined;
  let reportPath: string | undefined;
  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === '--apply') apply = true;
    else if (argument === '--verify') verify = true;
    else if (argument === '--all') all = true;
    else if (argument === '--org' || argument === '--report') {
      const value = args[++index];
      if (!value || value.startsWith('--')) throw new Error(`Value required for ${argument}`);
      if (argument === '--org') orgId = value;
      else reportPath = value;
    } else throw new Error(`Unknown argument: ${argument}`);
  }
  if (apply && verify) throw new Error('Use --apply or --verify, not both');
  if (orgId && all) throw new Error('Use --org or --all, not both');
  if (apply && (!reportPath || (!orgId && !all))) throw new Error('--apply requires --report <new-file.json> and either --org <id> or --all');
  if (apply && (!UMS_ORG_NAME_SYNC_ENABLED || !UMS_OUTBOX_ENABLED)) throw new Error('Enable UMS_ORG_NAME_SYNC_ENABLED and UMS_OUTBOX_ENABLED after deploying compatible UMS');
  if (!hasServiceCredentials()) throw new Error('UMS service credentials are required; no interactive user token is available');

  const local: { id: string; name: string; provisioningStatus: string }[] = await prisma.organization.findMany({
    where: { provisioningStatus: 'ACTIVE' }, select: { id: true, name: true, provisioningStatus: true }, orderBy: { id: 'asc' },
  });
  if (orgId && !local.some(org => org.id === orgId)) throw new Error('Selected organization does not exist or is not ACTIVE');
  const registry = await listOrganisations();
  const keycloak = await listKeycloakOrganizations();
  const jobs = await prisma.umsOutbox.findMany({
    where: { kind: 'ORG_NAME_SYNC', status: { in: ['PENDING', 'DEAD'] } },
    select: { orgId: true, status: true, attempts: true, lastError: true },
  });
  const rows = local.filter(org => !orgId || org.id === orgId).map(org => {
    const remote = registry.find(row => row.orgId === org.id);
    const matches = keycloak.filter(row => row.alias === org.id);
    const kc = matches.length === 1 ? matches[0] : undefined;
    const blockers: string[] = [];
    if (!remote) blockers.push('Missing UMS registry entry');
    else if (!remote.isActive) blockers.push('UMS organization is inactive');
    if (!kc) blockers.push('Missing or ambiguous Keycloak alias');
    else if (!kc.enabled) blockers.push('Keycloak organization is disabled');
    if (local.some(other => other.id !== org.id && normalizedName(other.name) === normalizedName(org.name))) {
      blockers.push('Duplicate local display name; choose distinct business names before repair');
    }
    if (remote && remote.name !== org.name && registry.some(other => other.id !== remote.id && normalizedName(other.name) === normalizedName(org.name))) {
      blockers.push('Desired name is already used by another UMS organization');
    }
    if (keycloak.some(other => other.id !== kc?.id && normalizedName(other.name) === normalizedName(org.name))) {
      blockers.push('Desired name is already used by another Keycloak organization');
    }
    const drift = remote?.name !== org.name || kc?.name !== org.name;
    return {
      orgId: org.id, desiredName: org.name,
      ums: remote ? { id: remote.id, name: remote.name, isActive: remote.isActive } : null,
      keycloak: kc ? { id: kc.id, alias: kc.alias, name: kc.name, enabled: kc.enabled } : null,
      drift, blockers, jobs: jobs.filter((job: { orgId: string }) => job.orgId === org.id),
    };
  });
  const report = {
    createdAt: new Date().toISOString(), appId: UMS_APP_ID,
    mode: apply ? 'PRE_APPLY' : verify ? 'VERIFY' : 'DRY_RUN',
    nameSyncEnabled: UMS_ORG_NAME_SYNC_ENABLED, rows,
  };
  const json = JSON.stringify(report, null, 2);
  if (reportPath) writeFileSync(reportPath, `${json}\n`, { flag: 'wx', mode: 0o600 });
  console.log(json);

  if (apply) {
    if (rows.some(row => row.blockers.length > 0)) throw new Error('Preflight blocked; no jobs queued. Resolve the reported conflicts or select one unblocked --org');
    for (const row of rows.filter(row => row.drift)) {
      await prisma.$transaction(async (transaction: Prisma.TransactionClient) => {
        await transaction.$queryRaw`SELECT id FROM Organization WHERE id = ${row.orgId} FOR UPDATE`;
        const current = await transaction.organization.findUnique({ where: { id: row.orgId } });
        if (!current || current.provisioningStatus !== 'ACTIVE' || current.name !== row.desiredName) {
          throw new Error(`Organization ${row.orgId} changed during preflight; run a fresh report`);
        }
        await transaction.umsOutbox.updateMany({
          where: { orgId: row.orgId, kind: 'ORG_NAME_SYNC', status: 'DEAD' },
          data: { status: 'PENDING', attempts: 0, lastError: null, nextAttemptAt: new Date() },
        });
        const pending = await transaction.umsOutbox.findFirst({ where: { orgId: row.orgId, kind: 'ORG_NAME_SYNC', status: 'PENDING' } });
        if (!pending) await enqueue(transaction, 'ORG_NAME_SYNC', row.orgId, {});
      });
      console.log(`QUEUED ${row.orgId}: ${row.desiredName} (not yet verified)`);
    }
  }
  if (verify && rows.some(row => row.drift || row.blockers.length > 0)) process.exitCode = 1;
}

main().catch(error => {
  console.error(`Organization name check failed: ${error?.message ?? 'Unknown error'}`);
  process.exitCode = 1;
}).finally(() => prisma.$disconnect());