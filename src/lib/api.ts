import axios from 'axios';
import { RemoveItemsFromLocalStorage } from './utils';

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

/** Abort requests issued for the previous organization before switching scope. */
export function rotateOrganizationRequestScope(): void {
  organizationScopeController.abort();
  organizationScopeController = new AbortController();
}

api.interceptors.request.use((config) => {
  config.signal ??= organizationScopeController.signal;
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

function signOut(): void {
  setAccessToken(null);
  RemoveItemsFromLocalStorage();
  if (!window.location.pathname.startsWith(LOGIN_PATH)) {
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
      return api(originalRequest);
    } catch {
      signOut();
      return Promise.reject(error);
    }
  }
);

export default api;
