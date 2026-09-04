import axios from 'axios';
import { RemoveItemsFromLocalStorage } from './utils';
import { clearSessionMarker, hadSession, notifySessionEnded } from './session';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:12001';

const BASE_URL = import.meta.env.BASE_URL || '/'; // '/form-builder/' in prod, '/' in dev
const LOGIN_PATH = `${BASE_URL}auth/login`.replace('//', '/');

/**
 * One origin, one client.
 *
 * Authentication is proxied by our own backend rather than called from the
 * browser, so the user-management service's address and application id never
 * reach the page, and the refresh token can live in a cookie the page cannot
 * read.
 */
export const api = axios.create({
  baseURL: `${API_URL}/api`,
  // Carries the refresh cookie on /api/auth/* requests.
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

/**
 * The access token is held in memory only.
 *
 * This application renders form schemas written by its own users, so an XSS is
 * a realistic threat; anything in localStorage is one `document` read away. The
 * session survives a reload through the refresh cookie instead.
 */
let accessToken: string | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

export function getAccessToken(): string | null {
  return accessToken;
}

let organizationScopeController = new AbortController();

/**
 * Paths that belong to the person, not to the organization they are looking at.
 *
 * Switching organizations aborts the previous scope's in-flight requests, which
 * is right for org data and actively harmful for these: an aborted
 * `/auth/session` reads as a failed session, which wipes the signed-in user and
 * can sign someone out for nothing more than switching workspaces quickly.
 */
const SCOPE_EXEMPT_PATHS = ['/auth/'];

/** Abort requests issued for the previous organization before switching scope. */
export function rotateOrganizationRequestScope(): void {
  organizationScopeController.abort();
  organizationScopeController = new AbortController();
}

api.interceptors.request.use((config) => {
  const url = config.url ?? '';
  if (!SCOPE_EXEMPT_PATHS.some((path) => url.startsWith(path))) {
    config.signal ??= organizationScopeController.signal;
  }
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  const orgId = localStorage.getItem('currentOrgId');
  if (orgId) {
    config.headers['x-org-id'] = orgId;
  }
  return config;
});

// --- refresh ------------------------------------------------------------------

/** Endpoints that must never trigger a refresh attempt of their own. */
const CREDENTIAL_PATHS = ['/auth/login', '/auth/refresh', '/auth/register', '/auth/logout'];

let refreshInFlight: Promise<string> | null = null;

/**
 * Exchange the refresh cookie for a new access token. Shared by every caller
 * that races into a 401 at once, so a burst produces one round trip.
 *
 * Sharing is not a nicety here. The server *rotates* the refresh token: the
 * cookie is spent the moment it is exchanged. Two overlapping refreshes means
 * the second one presents a token the server has already retired, which it
 * rightly refuses — and refusing clears the cookie, ending a session that was
 * perfectly healthy a moment earlier.
 */
export function refreshSession(): Promise<string> {
  if (!refreshInFlight) {
    refreshInFlight = api
      .post('/auth/refresh', {}, { signal: undefined })
      .then((response) => {
        const token: string | undefined = response.data?.accessToken;
        if (!token) throw new Error('No access token returned');
        setAccessToken(token);
        return token;
      })
      .finally(() => {
        refreshInFlight = null;
      });
  }
  return refreshInFlight;
}

/**
 * The one refresh a page load is allowed to make.
 *
 * `refreshInFlight` only merges callers that overlap in time. Bootstrap needs
 * more than that: React's StrictMode runs every effect twice in development,
 * and Vite's hot reload remounts the tree whenever a file is saved. Each of
 * those is a *sequential* second call, which `refreshInFlight` has already
 * cleared — so each one spends another refresh token, and any pair that lands
 * out of order kills the session. That is why saving a file, or simply
 * reloading, could drop you at the sign-in screen.
 *
 * Latching the promise for the lifetime of the page makes the exchange happen
 * once, however many times the tree mounts. A genuine re-authentication
 * (signing in again) calls `resetSessionBootstrap` to release the latch.
 */
let bootstrapAttempt: Promise<string> | null = null;

export function bootstrapSession(): Promise<string> {
  if (!bootstrapAttempt) {
    bootstrapAttempt = refreshSession().catch((error) => {
      // Only a refusal is final. A network failure must be retryable, or one
      // dropped packet at load time locks the person out until they reload.
      const status = (error as { response?: { status?: number } })?.response?.status;
      if (status !== 401 && status !== 403) bootstrapAttempt = null;
      throw error;
    });
  }
  return bootstrapAttempt;
}

export function resetSessionBootstrap(): void {
  bootstrapAttempt = null;
}

/**
 * End the session and say why.
 *
 * The redirect is deliberately left to the application: a full page navigation
 * throws away the React tree before it can show anything, which is how someone
 * ends up on the login screen with no idea what happened. `notifySessionEnded`
 * gives the app a chance to explain and route with the client-side router; the
 * hard navigation below is the fallback for when nothing is listening (an
 * expiry during a background request on a page that has already unmounted).
 */
function signOut(reason: 'expired' | 'unauthorized' = 'expired'): void {
  const wasSignedIn = hadSession();
  setAccessToken(null);
  RemoveItemsFromLocalStorage();
  clearSessionMarker();

  notifySessionEnded(reason);

  if (!wasSignedIn && !window.location.pathname.startsWith(LOGIN_PATH)) {
    window.location.href = LOGIN_PATH;
  }
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      CREDENTIAL_PATHS.some((path) => originalRequest.url?.includes(path))
    ) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const token = await refreshSession();
      originalRequest.headers = originalRequest.headers ?? {};
      originalRequest.headers.Authorization = `Bearer ${token}`;
      // The original request may carry an aborted organization scope signal
      // from before the refresh; a retry must not be born cancelled.
      if (originalRequest.signal?.aborted) originalRequest.signal = undefined;
      return api(originalRequest);
    } catch (refreshError) {
      // Only a refusal ends the session. A refresh that could not reach the
      // server says nothing about whether the session is still valid, and
      // signing out on a dropped connection is how a train tunnel becomes a
      // logout.
      const status = (refreshError as { response?: { status?: number } })?.response?.status;
      if (status === 401 || status === 403) {
        signOut(status === 403 ? 'unauthorized' : 'expired');
      }
      return Promise.reject(error);
    }
  }
);

export default api;
