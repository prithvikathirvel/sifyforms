import axios from 'axios';
import dotenv from 'dotenv';
import {
  RBAC_APP_ID,
  RBAC_BASE_URL,
  FEATURE_ACTIONS,
  ROLE_DEFINITIONS,
  ROLES,
  RoleName,
} from '../config/rbac.config';

dotenv.config();

/**
 * Seeds this application's features, actions and roles into the RBAC service.
 *
 * Idempotent: features and roles that already exist are updated rather than
 * duplicated, so it is safe to re-run after changing rbac.config.ts.
 *
 *   npm run rbac:seed
 */

const token = process.env.RBAC_SERVICE_TOKEN;

const http = axios.create({
  baseURL: `${RBAC_BASE_URL}/api`,
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
    'x-app-id': RBAC_APP_ID,
    ...(token ? { authorization: `Bearer ${token}`, idtoken: token } : {}),
  },
});

function describe(error: any): string {
  return error?.response?.data?.message ?? error?.message ?? String(error);
}

async function seedFeatures(): Promise<void> {
  console.log(`\nFeatures for "${RBAC_APP_ID}"`);

  let existing: { name: string; actions?: { key: string; value: string }[] }[] = [];
  try {
    const res = await http.get(`/feature/app/${encodeURIComponent(RBAC_APP_ID)}`);
    existing = (res.data as any)?.features ?? [];
  } catch (error) {
    console.log(`  (could not list existing features: ${describe(error)})`);
  }
  const existingByName = new Map(existing.map(f => [f.name, f]));

  for (const [feature, actions] of Object.entries(FEATURE_ACTIONS)) {
    const current = existingByName.get(feature);

    if (!current) {
      try {
        await http.post('/feature', { appId: RBAC_APP_ID, feature, actions });
        console.log(`  + ${feature} (${actions.length} actions)`);
      } catch (error) {
        console.log(`  ! ${feature}: ${describe(error)}`);
      }
      continue;
    }

    // Feature exists - add only the actions it is missing.
    const have = new Set((current.actions ?? []).map(a => a.key));
    const missing = actions.filter(a => !have.has(a.key));
    if (missing.length === 0) {
      console.log(`  = ${feature} (up to date)`);
      continue;
    }
    for (const action of missing) {
      try {
        await http.post(`/feature/${encodeURIComponent(feature)}/actions`, {
          appId: RBAC_APP_ID,
          ...action,
        });
        console.log(`  + ${feature}.${action.key}`);
      } catch (error) {
        console.log(`  ! ${feature}.${action.key}: ${describe(error)}`);
      }
    }
  }
}

async function seedRoles(): Promise<void> {
  console.log(`\nRoles for "${RBAC_APP_ID}"`);

  let existing: { id: string; name: string }[] = [];
  try {
    const res = await http.get(`/role/${encodeURIComponent(RBAC_APP_ID)}`);
    existing = (res.data as any)?.roles ?? [];
  } catch (error) {
    console.log(`  (could not list existing roles: ${describe(error)})`);
  }
  const existingByName = new Map(existing.map(r => [r.name, r]));

  for (const roleName of Object.values(ROLES) as RoleName[]) {
    const definition = ROLE_DEFINITIONS[roleName];
    const payload = {
      roleName,
      appId: RBAC_APP_ID,
      description: definition.description,
      permission: { appId: RBAC_APP_ID, privilege: definition.privilege },
    };

    const current = existingByName.get(roleName);
    try {
      if (current) {
        await http.put(`/role/${encodeURIComponent(current.id)}`, payload);
        console.log(`  ~ ${roleName} (updated)`);
      } else {
        await http.post('/role', payload);
        console.log(`  + ${roleName}`);
      }
    } catch (error) {
      console.log(`  ! ${roleName}: ${describe(error)}`);
    }
  }
}

async function main(): Promise<void> {
  console.log(`Seeding RBAC at ${RBAC_BASE_URL} for app "${RBAC_APP_ID}"`);
  if (!token) {
    console.log('Note: RBAC_SERVICE_TOKEN is not set. Writes will fail if the service requires auth.');
  }

  await seedFeatures();
  await seedRoles();

  console.log('\nDone. Verify with:');
  console.log(`  curl -H "x-app-id: ${RBAC_APP_ID}" ${RBAC_BASE_URL}/api/role/${RBAC_APP_ID}`);
}

main().catch(error => {
  console.error('Seed failed:', describe(error));
  process.exit(1);
});
