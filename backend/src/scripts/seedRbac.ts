import dotenv from 'dotenv';

dotenv.config();

import prisma from '../utils/prisma';
import { UMS_APP_ID, UMS_BASE_URL } from '../config/ums.config';
import { hasServiceCredentials } from '../service/ums.client';
import { provisionOrg } from '../service/ums.provisioning';
import { listRoles } from '../service/rbac.client';

/**
 * Materialise this application's features and role definitions in the
 * user-management service, for one organization or for all of them.
 *
 *   npm run rbac:seed                 # every organization in this database
 *   npm run rbac:seed -- --org <id>   # just one
 *
 * Idempotent: an organization that already has its roles is left untouched, so
 * permission edits made by an administrator survive a re-run.
 */

function describe(error: any): string {
  return error?.message ?? String(error);
}

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

async function targets(): Promise<{ id: string; name: string }[]> {
  const only = argValue('--org');
  if (only) {
    const org = await prisma.organization.findUnique({
      where: { id: only },
      select: { id: true, name: true },
    });
    if (!org) throw new Error(`No organization "${only}" in this database`);
    return [org];
  }
  return prisma.organization.findMany({ select: { id: true, name: true } });
}

async function main(): Promise<void> {
  console.log(`Seeding "${UMS_APP_ID}" at ${UMS_BASE_URL}`);
  if (!hasServiceCredentials()) {
    console.log(
      'Note: UMS_SERVICE_USER_EMAIL / UMS_SERVICE_USER_PASSWORD are not set, and there is no\n' +
        '      request in flight to borrow a token from. Writes will be rejected.'
    );
  }

  const orgs = await targets();
  if (orgs.length === 0) {
    console.log('\nNo organizations yet. Create one in the app; it is provisioned automatically.');
    return;
  }

  let failures = 0;
  for (const org of orgs) {
    process.stdout.write(`\n${org.name} (${org.id})\n`);
    try {
      await provisionOrg(org.id, org.name);
      const roles = await listRoles(org.id, true);
      console.log(`  roles: ${roles.map(r => r.name).join(', ') || '(none)'}`);
    } catch (error) {
      failures += 1;
      console.log(`  ! ${describe(error)}`);
    }
  }

  if (failures > 0) {
    throw new Error(`${failures} organization(s) could not be seeded`);
  }
}

main()
  .catch(error => {
    console.error('\nSeed failed:', describe(error));
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
