/**
 * User-management service (UMS) and Keycloak wiring.
 *
 * UMS is consumed exactly as it ships - it cannot be modified - so every
 * constraint it imposes is absorbed on this side. Two of them shape this file:
 *
 *   - `app_auth_config.usesOrgs = 1` for this application, so `x-org-id` is
 *     mandatory on every /role, /user-app-roles and /feature call, and its role
 *     query filters `AND orgId = ?`. Role definitions are therefore materialised
 *     per organization rather than once per application.
 *   - UMS authenticates a caller by resolving the token's `email` to a row in
 *     its own `users` table. There is no client-credentials path, so background
 *     work needs a real service user rather than a service account.
 */

function trimSlash(value: string): string {
  return value.replace(/\/+$/, '');
}

export const UMS_BASE_URL = trimSlash(
  process.env.UMS_BASE_URL ??
    process.env.RBAC_SERVICE_URL ??
    process.env.USER_MANAGEMENT_URL ??
    'http://localhost:3010'
);

export const UMS_APP_ID = process.env.UMS_APP_ID ?? process.env.RBAC_APP_ID ?? 'Form-Builder';

export const UMS_TIMEOUT_MS = Number(
  process.env.UMS_TIMEOUT_MS ?? process.env.RBAC_TIMEOUT_MS ?? 10_000
);

/**
 * Credentials for the UMS service user (a real Keycloak user registered in
 * `users` and `app_users`). Optional: when unset, calls made inside a request
 * fall back to the caller's own token, which UMS accepts identically. Only
 * background work - the outbox worker and the reconcile scripts - strictly
 * needs these.
 *
 * The service user must never join an organization. That service removes a user
 * from `app_users` as soon as they hold no organizations, so an account that
 * joins one loses its application membership when that organization is deleted,
 * and every later call from it is refused.
 */
export const UMS_SERVICE_USER_EMAIL = process.env.UMS_SERVICE_USER_EMAIL ?? '';
export const UMS_SERVICE_USER_PASSWORD = process.env.UMS_SERVICE_USER_PASSWORD ?? '';

// ---------------------------------------------------------------------------
// Keycloak
// ---------------------------------------------------------------------------

/**
 * The exact `iss` value this application accepts. Built from configuration and
 * never from the token being verified: deriving the JWKS endpoint from an
 * unverified token lets anyone who can stand up an OIDC issuer authenticate as
 * anyone here.
 */
export const KEYCLOAK_ISSUER = trimSlash(process.env.KEYCLOAK_ISSUER ?? '');

export const KEYCLOAK_JWKS_URI =
  process.env.KEYCLOAK_JWKS_URI ||
  (KEYCLOAK_ISSUER ? `${KEYCLOAK_ISSUER}/protocol/openid-connect/certs` : '');

/** Expected `azp` claim. Keycloak access tokens carry `aud: account`, so `azp` is the useful check. */
export const KEYCLOAK_CLIENT_ID = process.env.KEYCLOAK_CLIENT_ID ?? UMS_APP_ID;

/** Set to false only for a realm that issues tokens without `azp`. */
export const KEYCLOAK_VERIFY_AZP = process.env.KEYCLOAK_VERIFY_AZP !== 'false';

// Derived from the issuer, which is the authoritative address: a stale
// KEYCLOAK_BASE_URL pointing somewhere else would otherwise silently win.
const issuerParts = /^(.*)\/realms\/([^/]+)$/.exec(KEYCLOAK_ISSUER);
export const KEYCLOAK_BASE_URL = issuerParts?.[1] ?? process.env.KEYCLOAK_BASE_URL ?? '';
export const KEYCLOAK_REALM = issuerParts?.[2] ?? process.env.KEYCLOAK_REALM ?? '';

/**
 * Admin credentials, used for exactly one thing: creating the Keycloak
 * organization behind an organization here.
 *
 * The user-management service creates organizations without a domain, which
 * Keycloak 26 rejects outright ("You must provide at least one domain"). It
 * cannot be changed, but it does tolerate the organization already existing -
 * it treats Keycloak's 409 as "already there" and writes its own row. So the
 * organization is created here first, with a domain, and registration then
 * succeeds unchanged.
 */
export const KEYCLOAK_ADMIN_REALM = process.env.KEYCLOAK_ADMIN_REALM ?? 'master';
export const KEYCLOAK_ADMIN_CLIENT_ID = process.env.KEYCLOAK_ADMIN_CLIENT_ID ?? 'admin-cli';
export const KEYCLOAK_ADMIN_USERNAME = process.env.KEYCLOAK_ADMIN_USERNAME ?? '';
export const KEYCLOAK_ADMIN_PASSWORD = process.env.KEYCLOAK_ADMIN_PASSWORD ?? '';

/** Organization domains must be unique within a realm, so one is derived per organization. */
export const KEYCLOAK_ORG_DOMAIN_SUFFIX =
  process.env.KEYCLOAK_ORG_DOMAIN_SUFFIX ?? 'forms.internal';

// ---------------------------------------------------------------------------
// Role definition cache and resilience
// ---------------------------------------------------------------------------

export const ROLE_CACHE_TTL_MS = Number(process.env.RBAC_ROLE_CACHE_TTL_MS ?? 60_000);

/** Consecutive failures before the client stops calling UMS for a cooldown. */
export const RBAC_BREAKER_THRESHOLD = Number(process.env.RBAC_BREAKER_THRESHOLD ?? 5);
export const RBAC_BREAKER_COOLDOWN_MS = Number(process.env.RBAC_BREAKER_COOLDOWN_MS ?? 30_000);

// ---------------------------------------------------------------------------
// Feature flags
// ---------------------------------------------------------------------------

function flag(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return fallback;
  return raw === 'true' || raw === '1';
}

/** Register organizations in UMS and materialise their role definitions there. */
export const UMS_ORG_SYNC_ENABLED = flag('UMS_ORG_SYNC_ENABLED', true);

/** Mirror membership changes into `user_app_roles`. */
export const UMS_ROLE_MIRROR_ENABLED = flag('UMS_ROLE_MIRROR_ENABLED', true);

/** Run the outbox worker in this process. Disable on read-only replicas. */
export const UMS_OUTBOX_ENABLED = flag('UMS_OUTBOX_ENABLED', true);
export const UMS_OUTBOX_INTERVAL_MS = Number(process.env.UMS_OUTBOX_INTERVAL_MS ?? 15_000);
export const UMS_OUTBOX_MAX_ATTEMPTS = Number(process.env.UMS_OUTBOX_MAX_ATTEMPTS ?? 8);

// ---------------------------------------------------------------------------
// Session cookie
// ---------------------------------------------------------------------------

export const REFRESH_COOKIE_NAME = process.env.REFRESH_COOKIE_NAME ?? 'fb_rt';
/** Leave unset for host-only cookies; set to `.example.com` to share across subdomains. */
export const REFRESH_COOKIE_DOMAIN = process.env.REFRESH_COOKIE_DOMAIN ?? '';
/** A `Secure` cookie is dropped over plain http, which is what local development uses. */
export const REFRESH_COOKIE_SECURE =
  process.env.REFRESH_COOKIE_SECURE !== undefined
    ? process.env.REFRESH_COOKIE_SECURE === 'true'
    : process.env.NODE_ENV === 'production';
export const REFRESH_COOKIE_MAX_AGE_MS = Number(
  process.env.REFRESH_COOKIE_MAX_AGE_MS ?? 30 * 24 * 60 * 60 * 1000
);

/**
 * `lax` is right when the app and this API share a registrable domain
 * (dev.example.com and api.example.com). Set `none` - which also requires
 * `Secure` - when they do not, or the browser silently drops the cookie and
 * every reload looks like a signed-out session.
 */
export const REFRESH_COOKIE_SAMESITE = ((): 'lax' | 'none' | 'strict' => {
  const raw = (process.env.REFRESH_COOKIE_SAMESITE ?? 'lax').toLowerCase();
  return raw === 'none' || raw === 'strict' ? raw : 'lax';
})();
