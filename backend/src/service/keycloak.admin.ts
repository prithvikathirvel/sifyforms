import axios from 'axios';

type AxiosInstance = ReturnType<typeof axios.create>;

import {
  KEYCLOAK_ADMIN_CLIENT_ID,
  KEYCLOAK_ADMIN_PASSWORD,
  KEYCLOAK_ADMIN_REALM,
  KEYCLOAK_ADMIN_USERNAME,
  KEYCLOAK_BASE_URL,
  KEYCLOAK_ORG_DOMAIN_SUFFIX,
  KEYCLOAK_REALM,
} from '../config/ums.config';
import { createError } from '../utils/errors';
import logger from '../utils/logger';

/**
 * The one thing this application asks Keycloak for directly: an organization
 * record.
 *
 * The user-management service creates organizations without a domain, which
 * Keycloak 26 refuses. It cannot be changed. It does, however, treat a 409 from
 * Keycloak as "already there" and go on to write its own row - so creating the
 * organization here first, with a domain, makes registration succeed against an
 * unmodified service.
 *
 * Nothing else about identity happens here; users, tokens and roles all stay
 * behind the user-management service.
 */

let client: AxiosInstance | null = null;

function http(): AxiosInstance {
  if (!client) {
    client = axios.create({ baseURL: KEYCLOAK_BASE_URL, timeout: 10_000 });
  }
  return client;
}

export function hasAdminCredentials(): boolean {
  return Boolean(KEYCLOAK_BASE_URL && KEYCLOAK_REALM && KEYCLOAK_ADMIN_USERNAME && KEYCLOAK_ADMIN_PASSWORD);
}

let token: { value: string; expiresAt: number } | null = null;
let inFlight: Promise<string> | null = null;

async function fetchToken(): Promise<string> {
  const body = new URLSearchParams({
    grant_type: 'password',
    client_id: KEYCLOAK_ADMIN_CLIENT_ID,
    username: KEYCLOAK_ADMIN_USERNAME,
    password: KEYCLOAK_ADMIN_PASSWORD,
  });
  const res = await http().post(
    `/realms/${encodeURIComponent(KEYCLOAK_ADMIN_REALM)}/protocol/openid-connect/token`,
    body.toString(),
    { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
  );
  const data = res.data as { access_token?: string; expires_in?: number };
  const value = data?.access_token;
  if (!value) throw createError(502, 'Keycloak returned no admin token');
  const expiresIn = Number(data?.expires_in ?? 60);
  token = { value, expiresAt: Date.now() + Math.max(15, expiresIn - 15) * 1000 };
  return value;
}

async function adminToken(): Promise<string> {
  if (token && Date.now() < token.expiresAt) return token.value;
  if (!inFlight) {
    inFlight = fetchToken().finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}

function describe(error: any): string {
  const body = error?.response?.data;
  return body?.errorMessage ?? body?.error ?? error?.message ?? 'Unknown error';
}

function isConflict(error: any): boolean {
  return error?.response?.status === 409;
}

/**
 * Make sure a Keycloak organization exists for `alias`.
 *
 * `alias` is this application's `Organization.id`, which is also the value
 * carried in `x-org-id`, so both systems agree on one identifier.
 *
 * The Keycloak record is named after the id rather than the workspace, which
 * looks odd but is required: the user-management service locates an
 * organization with `GET /organizations?search=<orgId>`, and Keycloak's search
 * matches name and domain but not alias. Naming it anything else makes member
 * management fail with "organisation not found". The readable name lives in
 * this application and in that service's own row.
 *
 * The domain is derived from the id because Keycloak demands one and demands it
 * be unique within the realm; it is never used for routing or email matching.
 */
export async function ensureOrganization(alias: string, _name: string): Promise<void> {
  if (!hasAdminCredentials()) {
    throw createError(
      503,
      'Keycloak admin credentials are not configured, so organizations cannot be created. ' +
        'Set KEYCLOAK_ADMIN_USERNAME and KEYCLOAK_ADMIN_PASSWORD.'
    );
  }

  const payload = {
    name: alias,
    alias,
    enabled: true,
    domains: [{ name: `${alias}.${KEYCLOAK_ORG_DOMAIN_SUFFIX}`, verified: false }],
  };

  try {
    await http().post(
      `/admin/realms/${encodeURIComponent(KEYCLOAK_REALM)}/organizations`,
      payload,
      { headers: { Authorization: `Bearer ${await adminToken()}` } }
    );
    logger.info('KeycloakAdmin --> organization created', { alias });
  } catch (error: any) {
    if (isConflict(error)) return;
    logger.error(
      `KeycloakAdmin --> ensureOrganization --> ${error?.response?.status} ${describe(error)}`,
      { alias, payload }
    );
    throw createError(502, `Keycloak rejected the organization: ${describe(error)}`);
  }
}
