import dotenv from 'dotenv';

dotenv.config();

import prisma from '../utils/prisma';
import { UMS_APP_ID } from '../config/ums.config';
import * as ums from '../service/ums.client';
import { provisionOrg } from '../service/ums.provisioning';
import { resolveRoleId } from '../service/rbac.client';
import { drainOutbox } from '../service/ums.outbox';

/**
 * Repair drift between this database and the user-management service.
 *
 * Mirroring is best-effort by design - a failed remote write never fails a
 * user's request - so something has to close the loop. Run this on a schedule;
 * a repair count that trends upwards means the outbox worker is not running.
 *
 *   npm run ums:reconcile
 */

function describe(error: any): string {
  return error?.message ?? String(error);
}

async function finishProvisioning(): Promise<number> {
  const pending = await prisma.organization.findMany({
    where: { provisioningStatus: { in: ['PROVISIONING', 'FAILED'] } },
    select: { id: true, name: true },
  });

  let fixed = 0;
  for (const org of pending) {
    try {
      await provisionOrg(org.id, org.name);
      await prisma.organization.update({
        where: { id: org.id },
        data: { provisioningStatus: 'ACTIVE', umsSyncedAt: new Date() },
      });
      console.log(`  completed provisioning: ${org.name} (${org.id})`);
      fixed += 1;
    } catch (error) {
      await prisma.organization.update({
        where: { id: org.id },
        data: { provisioningStatus: 'FAILED' },
      });
      console.log(`  ! ${org.name} (${org.id}): ${describe(error)}`);
    }
  }
  return fixed;
}

async function reconcileAssignments(): Promise<number> {
  const orgs = await prisma.organization.findMany({
    where: { provisioningStatus: 'ACTIVE' },
    select: { id: true, name: true, users: { select: { userId: true, role: true } } },
  });

  let repaired = 0;
  for (const org of orgs) {
    let remote: ums.UmsAssignment[];
    try {
      remote = await ums.listAssignments(org.id);
    } catch (error) {
      console.log(`  ! ${org.name}: ${describe(error)}`);
      continue;
    }

    const remoteByUser = new Map(remote.map(r => [r.userId, r]));

    for (const member of org.users) {
      try {
        const expectedRoleId = await resolveRoleId(member.role, org.id);
        const current = remoteByUser.get(member.userId);
        if (current?.roleId === expectedRoleId) continue;

        await ums.addOrgMember(org.id, member.userId);
        await ums.assignRole(member.userId, expectedRoleId, org.id);
        console.log(`  repaired ${member.userId} -> ${member.role} in ${org.name}`);
        repaired += 1;
      } catch (error) {
        console.log(`  ! ${org.name}/${member.userId}: ${describe(error)}`);
      }
    }

    // Present remotely but no longer a member here.
    const localIds = new Set(org.users.map((u: { userId: string }) => u.userId));
    for (const entry of remote) {
      if (localIds.has(entry.userId)) continue;
      try {
        await ums.removeAssignment(entry.userId, org.id);
        await ums.removeOrgMember(org.id, entry.userId);
        console.log(`  removed stale assignment for ${entry.userId} in ${org.name}`);
        repaired += 1;
      } catch (error) {
        console.log(`  ! ${org.name}/${entry.userId}: ${describe(error)}`);
      }
    }
  }
  return repaired;
}

async function main(): Promise<void> {
  console.log(`Reconciling "${UMS_APP_ID}"`);

  console.log('\nOutbox');
  const drained = await drainOutbox(500);
  console.log(`  ${drained} entry(ies) delivered`);
  const stuck = await prisma.umsOutbox.count({ where: { status: 'DEAD' } });
  if (stuck > 0) console.log(`  ${stuck} entry(ies) gave up and need attention`);

  console.log('\nProvisioning');
  const provisioned = await finishProvisioning();
  console.log(`  ${provisioned} organization(s) completed`);

  console.log('\nAssignments');
  const repaired = await reconcileAssignments();
  console.log(`  ${repaired} assignment(s) repaired`);
}

main()
  .catch(error => {
    console.error('\nReconcile failed:', describe(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
