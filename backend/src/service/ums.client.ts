import axios from 'axios';

// The repo carries a legacy @types/axios that shadows axios v1's bundled
// typings, so `AxiosInstance` is not importable here. Derive it instead.
type AxiosInstance = ReturnType<typeof axios.create>;

import {
  UMS_APP_ID,
  UMS_BASE_URL,
  UMS_SERVICE_USER_EMAIL,
  UMS_SERVICE_USER_PASSWORD,
  UMS_TIMEOUT_MS,
} from '../config/ums.config';
import { createError } from '../utils/errors';
import { getCallerToken } from '../utils/requestContext';
import logger from '../utils/logger';

/**
 * Client for the user-management service.
 *
 * Everything this application does not own itself goes through here: identity
 * (signup, login, refresh, profile), the organization registry, role
 * definitions and role assignments. UMS cannot be changed, so its quirks are
 * absorbed in this file rather than leaking into the services above it.
 */

let client: AxiosInstance | null = null;

function http(): AxiosInstance {
  if (!client) {
    client = axios.create({
      baseURL: `${UMS_BASE_URL}/api`,
      timeout: UMS_TIMEOUT_MS,
      headers: { 'Content-Type': 'application/json', 'x-app-id': UMS_APP_ID },
    });
  }
  return client;
}

/** UMS reports failures as `{ message }` from controllers and `{ error }` from middleware. */
export function umsMessage(error: any): string {
  const body = error?.response?.data;
  return (
    body?.message ??
    body?.error ??
    (typeof body === 'string' ? body : undefined) ??
    error?.message ??
    'Unknown error'
  );
}

export function umsStatus(error: any): number | undefined {
  return error?.response?.status;
}

export function umsError(operation: string, error: any): Error {
  const status = umsStatus(error);
  const message = umsMessage(error);
  logger.error(`UmsClient --> ${operation} --> Error`, { status, message });
  // A 4xx from UMS is a contract problem on our side, not the caller's fault.
  return createError(status && status < 500 ? status : 502, message);
}

/** Handlers return either `{ code, data }` or the bare value. */
function unwrap<T>(payload: any): T {
  return (payload?.data !== undefined ? payload.data : payload) as T;
}

// ---------------------------------------------------------------------------
// Credentials
// ---------------------------------------------------------------------------

interface CachedToken {
  token: string;
  expiresAt: number;
}

let serviceToken: CachedToken | null = null;
let serviceTokenInFlight: Promise<string> | null = null;
let serviceTokenBlockedUntil = 0;

export function hasServiceCredentials(): boolean {
  return Boolean(UMS_SERVICE_USER_EMAIL && UMS_SERVICE_USER_PASSWORD);
}

async function fetchServiceToken(): Promise<string> {
  const res = await http().post('/user/login', {
    email: UMS_SERVICE_USER_EMAIL,
    password: UMS_SERVICE_USER_PASSWORD,
  });
  const payload = unwrap<any>(res.data);
  const token: string | undefined = payload?.accessToken;
  if (!token) {
    throw createError(502, 'User-management service returned no access token for the service user');
  }
  const expiresIn = Number(payload?.expiresIn ?? 300);
  serviceToken = { token, expiresAt: Date.now() + Math.max(30, expiresIn - 30) * 1000 };
  return token;
}

/**
 * A token for the service user, or undefined when none is configured or the
 * grant is failing. Single-flight, so a burst of concurrent calls shares one
 * login.
 */
export async function getServiceToken(): Promise<string | undefined> {
  if (!hasServiceCredentials()) return undefined;
  if (serviceToken && Date.now() < serviceToken.expiresAt) return serviceToken.token;
  if (Date.now() < serviceTokenBlockedUntil) return undefined;

  if (!serviceTokenInFlight) {
    serviceTokenInFlight = fetchServiceToken().finally(() => {
      serviceTokenInFlight = null;
    });
  }
  try {
    return await serviceTokenInFlight;
  } catch (error) {
    // Do not retry on every request while the credential is wrong.
    serviceTokenBlockedUntil = Date.now() + 60_000;
    logger.error('UmsClient --> service login failed', { message: umsMessage(error) });
    return undefined;
  }
}

/**
 * Credential for a call to UMS.
 *
 * The service user is preferred so a multi-step saga cannot fail halfway
 * because the end user's token expired. Inside a request the caller's own token
 * is an equally valid credential - UMS performs no authorization of its own on
 * these routes - so it is the fallback when no service user is configured.
 */
async function authHeaders(): Promise<Record<string, string>> {
  const token = (await getServiceToken()) ?? getCallerToken();
  if (!token) {
    throw createError(
      503,
      'No credential available for the user-management service. Configure UMS_SERVICE_USER_EMAIL and UMS_SERVICE_USER_PASSWORD.'
    );
  }
  return { authorization: `Bearer ${token}`, idtoken: token };
}

interface CallOptions {
  /** Sent as `x-org-id`. Required by UMS on every role, assignment and feature route. */
  orgId?: string;
  params?: Record<string, unknown>;
  /** Skip auth headers (only the public /user/* routes). */
  anonymous?: boolean;
  /** Extra headers, e.g. a caller-supplied `idtoken` for profile updates. */
  headers?: Record<string, string>;
}

async function call<T>(
  method: 'get' | 'post' | 'put' | 'patch' | 'delete',
  url: string,
  data?: unknown,
  options: CallOptions = {}
): Promise<T> {
  // Set explicitly rather than relying on the instance default: every UMS route
  // resolves the application from this header, and a request that loses it is
  // accepted but silently handled without an application - which is how a new
  // account ends up missing its `app_users` row.
  const headers: Record<string, string> = { 'x-app-id': UMS_APP_ID };
  if (!options.anonymous) Object.assign(headers, await authHeaders());
  if (options.orgId) headers['x-org-id'] = options.orgId;
  Object.assign(headers, options.headers ?? {});

  const res = await http().request({
    method,
    url,
    data,
    params: options.params,
    headers,
  });
  return unwrap<T>(res.data);
}

// ---------------------------------------------------------------------------
// Identity
// ---------------------------------------------------------------------------

export interface UmsTokenSet {
  accessToken: string;
  refreshToken?: string;
  idToken?: string;
  expiresIn?: number;
}

export interface UmsCreateUserInput {
  email: string;
  password: string;
  username: string;
  firstName: string;
  lastName: string;
  phone: string;
  gender?: string;
  address?: string;
  additionalDetails?: Record<string, unknown>;
}

/** Creates the Keycloak user plus the UMS `users` and `app_users` rows. */
export async function createUser(
  input: UmsCreateUserInput
): Promise<{ userId: string; email: string; username?: string }> {
  try {
    // Responds `{ message, code, userDetails }`, where `userDetails.id` is the
    // Keycloak subject - the id this application keys its own `User` on.
    const body = await call<any>('post', '/user/', input, { anonymous: true });
    const details = body?.userDetails ?? body;
    return {
      userId: details?.id ?? details?.userId,
      email: details?.email ?? input.email,
      username: details?.username,
    };
  } catch (error) {
    throw umsError('createUser', error);
  }
}

export async function login(email: string, password: string): Promise<UmsTokenSet> {
  try {
    return await call('post', '/user/login', { email, password }, { anonymous: true });
  } catch (error) {
    throw umsError('login', error);
  }
}

export async function refreshToken(token: string): Promise<UmsTokenSet> {
  try {
    return await call('post', '/user/refresh-token', { refreshToken: token }, { anonymous: true });
  } catch (error) {
    throw umsError('refreshToken', error);
  }
}

export async function logout(accessToken: string, token: string): Promise<void> {
  try {
    await call('post', '/user/logout', { refreshToken: token }, {
      anonymous: true,
      headers: { authorization: `Bearer ${accessToken}`, idtoken: accessToken },
    });
  } catch (error) {
    // Best effort: the cookie is cleared regardless, so a failure here must not
    // leave the user apparently signed in.
    logger.warn('UmsClient --> logout --> ignored', { message: umsMessage(error) });
  }
}

export async function forgotPassword(email: string): Promise<unknown> {
  try {
    return await call('post', '/user/forgot-password', { email }, { anonymous: true });
  } catch (error) {
    throw umsError('forgotPassword', error);
  }
}

export async function confirmForgotPassword(input: {
  email: string;
  confirmationCode: string;
  newPassword: string;
}): Promise<unknown> {
  try {
    return await call('post', '/user/confirm-forgot-password', input, { anonymous: true });
  } catch (error) {
    throw umsError('confirmForgotPassword', error);
  }
}

/** UMS identifies the subject from the `idtoken` header, so the caller's token must be forwarded. */
export async function updateProfile(callerToken: string, input: Record<string, unknown>): Promise<any> {
  try {
    return await call('put', '/user/', input, {
      anonymous: true,
      headers: { idtoken: callerToken, authorization: `Bearer ${callerToken}` },
    });
  } catch (error) {
    throw umsError('updateProfile', error);
  }
}

export async function getUserByEmail(email: string): Promise<any | null> {
  try {
    return await call('get', `/user/${encodeURIComponent(email)}`);
  } catch (error) {
    if (umsStatus(error) === 404) return null;
    throw umsError('getUserByEmail', error);
  }
}

// ---------------------------------------------------------------------------
// Organizations
// ---------------------------------------------------------------------------

function isAlreadyExists(error: any): boolean {
  const status = umsStatus(error);
  const message = umsMessage(error).toLowerCase();
  return (
    status === 409 ||
    message.includes('already exist') ||
    message.includes('duplicate') ||
    message.includes('er_dup_entry')
  );
}

/**
 * Register an organization. `orgId` is this application's `Organization.id`,
 * which is also the value carried in `x-org-id` and the Keycloak org alias.
 *
 * Idempotent: re-registering an existing organization is treated as success so
 * a resumed provisioning saga does not need to know how far it got.
 */
export async function createOrganisation(orgId: string, name: string): Promise<void> {
  try {
    await call('post', '/organisations/', { orgId, appId: UMS_APP_ID, name, isActive: true });
  } catch (error) {
    if (isAlreadyExists(error)) {
      logger.info('UmsClient --> createOrganisation --> already registered', { orgId });
      return;
    }
    throw umsError('createOrganisation', error);
  }
}

export interface UmsOrganisation {
  id: string;
  orgId: string;
  appId: string;
  name: string;
  isActive: boolean;
}

/** The registry row for an organization, or null if it was never registered. */
export async function findOrganisation(orgId: string): Promise<UmsOrganisation | null> {
  try {
    const result = await call<any>('get', `/organisations/${encodeURIComponent(UMS_APP_ID)}`);
    const rows: UmsOrganisation[] = Array.isArray(result) ? result : result?.organisations ?? [];
    return rows.find(o => o.orgId === orgId) ?? null;
  } catch (error) {
    throw umsError('findOrganisation', error);
  }
}

/**
 * Retire an organization.
 *
 * Deletion is addressed by the registry row's own id, not by `orgId`, and is
 * refused while any role or feature row still references the organization -
 * neither of which can be removed through the API. So deletion is attempted and
 * deactivation is the fallback, which is the state that matters: an inactive
 * organization is rejected for every subsequent request.
 */
export async function deleteOrganisation(orgId: string): Promise<void> {
  const row = await findOrganisation(orgId);
  if (!row) return;

  try {
    await call('delete', `/organisations/${encodeURIComponent(row.id)}`);
    return;
  } catch (error) {
    if (umsStatus(error) === 404) return;
    logger.info('UmsClient --> deleteOrganisation --> falling back to deactivation', {
      orgId,
      reason: umsMessage(error),
    });
  }

  if (row.isActive) {
    try {
      // A toggle, not a setter: only send it when the organization is still active.
      await call('patch', `/organisations/${encodeURIComponent(row.id)}`, {});
    } catch (error) {
      throw umsError('deactivateOrganisation', error);
    }
  }
}

export async function addOrgMember(orgId: string, userId: string): Promise<void> {
  try {
    await call('post', `/organisations/${encodeURIComponent(orgId)}/members`, { userId });
  } catch (error) {
    if (isAlreadyExists(error)) return;
    throw umsError('addOrgMember', error);
  }
}

export async function removeOrgMember(orgId: string, userId: string): Promise<void> {
  try {
    await call('delete', `/organisations/${encodeURIComponent(orgId)}/members/${encodeURIComponent(userId)}`);
  } catch (error) {
    if (umsStatus(error) === 404) return;
    throw umsError('removeOrgMember', error);
  }
}

// ---------------------------------------------------------------------------
// Role assignments (`user_app_roles`)
// ---------------------------------------------------------------------------

export interface UmsAssignment {
  userId: string;
  appId: string;
  orgId: string | null;
  roleId: string;
  roleName?: string;
}

export async function getAssignment(userId: string, orgId: string): Promise<UmsAssignment | null> {
  try {
    const result = await call<UmsAssignment | null>(
      'get',
      `/user-app-roles/${encodeURIComponent(userId)}/${encodeURIComponent(UMS_APP_ID)}`,
      undefined,
      { orgId }
    );
    return result && (result as any).roleId ? result : null;
  } catch (error) {
    if (umsStatus(error) === 404) return null;
    throw umsError('getAssignment', error);
  }
}

export async function listAssignments(orgId: string): Promise<UmsAssignment[]> {
  try {
    const result = await call<any>(
      'get',
      `/user-app-roles/users/${encodeURIComponent(UMS_APP_ID)}`,
      undefined,
      { orgId, params: { limit: 500 } }
    );
    return (result?.userAppRoles ?? []).filter((r: any) => r?.roleId);
  } catch (error) {
    throw umsError('listAssignments', error);
  }
}

/**
 * Point a user at a role in an organization.
 *
 * UMS offers a bare INSERT and a bare UPDATE rather than an upsert, so the
 * current state is read first. `uk_user_app_role (userId, appId, orgId)` means
 * there is at most one row to find.
 */
export async function assignRole(userId: string, roleId: string, orgId: string): Promise<void> {
  const existing = await getAssignment(userId, orgId);
  try {
    if (existing) {
      if (existing.roleId === roleId) return;
      await call(
        'put',
        `/user-app-roles/${encodeURIComponent(userId)}/${encodeURIComponent(UMS_APP_ID)}`,
        { roleId },
        { orgId }
      );
      return;
    }
    await call('post', '/user-app-roles/', { userId, appId: UMS_APP_ID, roleId }, { orgId });
  } catch (error) {
    // A concurrent writer won the race; the row now exists with some role.
    if (isAlreadyExists(error)) {
      await call(
        'put',
        `/user-app-roles/${encodeURIComponent(userId)}/${encodeURIComponent(UMS_APP_ID)}`,
        { roleId },
        { orgId }
      );
      return;
    }
    throw umsError('assignRole', error);
  }
}

export async function removeAssignment(userId: string, orgId: string): Promise<void> {
  try {
    await call(
      'delete',
      `/user-app-roles/${encodeURIComponent(userId)}/${encodeURIComponent(UMS_APP_ID)}`,
      undefined,
      { orgId }
    );
  } catch (error) {
    if (umsStatus(error) === 404) return;
    throw umsError('removeAssignment', error);
  }
}

// ---------------------------------------------------------------------------
// Role definitions (`roles`)
// ---------------------------------------------------------------------------

export interface UmsRole {
  id: string;
  name: string;
  appId: string;
  orgId?: string | null;
  description?: string;
  permission?: unknown;
  isActive?: boolean;
}

export interface UmsRolePayload {
  roleName: string;
  description: string;
  permission: { appId: string; privilege: { feature: string; actions: string[] }[] };
}

/**
 * Role definitions for one organization.
 *
 * UMS filters `AND orgId = ?`, which never matches the `orgId IS NULL` rows an
 * application-level role would have, so every organization owns its own copy of
 * the definitions.
 */
export async function listRolesForOrg(orgId: string): Promise<UmsRole[]> {
  try {
    const result = await call<any>('get', `/role/${encodeURIComponent(UMS_APP_ID)}`, undefined, {
      orgId,
      params: { limit: 200 },
    });
    return result?.roles ?? (Array.isArray(result) ? result : []);
  } catch (error) {
    throw umsError('listRolesForOrg', error);
  }
}

export async function createRole(orgId: string, payload: UmsRolePayload): Promise<void> {
  try {
    await call('post', '/role/', { ...payload, appId: UMS_APP_ID }, { orgId });
  } catch (error) {
    if (isAlreadyExists(error)) return;
    throw umsError('createRole', error);
  }
}

export async function updateRole(orgId: string, roleId: string, payload: UmsRolePayload): Promise<void> {
  try {
    await call('put', `/role/${encodeURIComponent(roleId)}`, { ...payload, appId: UMS_APP_ID }, { orgId });
  } catch (error) {
    throw umsError('updateRole', error);
  }
}

/** UMS exposes a toggle rather than a setter, so callers must read the current state first. */
export async function toggleRole(orgId: string, roleId: string): Promise<void> {
  try {
    await call('patch', `/role/${encodeURIComponent(roleId)}`, {}, { orgId });
  } catch (error) {
    throw umsError('toggleRole', error);
  }
}

// ---------------------------------------------------------------------------
// Features
// ---------------------------------------------------------------------------

export async function listFeatures(orgId: string): Promise<any[]> {
  try {
    const result = await call<any>('get', `/feature/app/${encodeURIComponent(UMS_APP_ID)}`, undefined, { orgId });
    return Array.isArray(result) ? result : result?.features ?? [];
  } catch (error) {
    throw umsError('listFeatures', error);
  }
}

export async function createFeature(
  orgId: string,
  feature: string,
  actions: { key: string; value: string }[]
): Promise<void> {
  try {
    await call('post', '/feature/', { appId: UMS_APP_ID, feature, actions }, { orgId });
  } catch (error) {
    if (isAlreadyExists(error)) return;
    throw umsError('createFeature', error);
  }
}
