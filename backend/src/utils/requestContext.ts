import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request context, carried implicitly down the async call chain.
 *
 * The RBAC service authenticates callers with a Keycloak JWT verified against
 * JWKS, and requires the token's email to belong to the application. It has no
 * service-account bypass, so when this backend calls it on a user's behalf the
 * only credential that works is that user's own token - which is exactly the
 * one this backend just verified.
 *
 * Threading the token through every service signature would touch code that has
 * no business knowing about it, so it rides here instead. `RBAC_SERVICE_TOKEN`
 * remains the fallback for background work with no request in flight (the seed
 * script, scheduled jobs).
 */

export interface RequestContext {
  /** Raw bearer token as presented by the caller. */
  token?: string;
  userId?: string;
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Run `fn` with `context` visible to everything it awaits. */
export function runWithContext<T>(context: RequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getRequestContext(): RequestContext | undefined {
  return storage.getStore();
}

/** The caller's token, when this code is running inside a request. */
export function getCallerToken(): string | undefined {
  return storage.getStore()?.token;
}
