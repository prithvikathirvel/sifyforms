import axios from 'axios';
import { RemoveItemsFromLocalStorage } from './utils';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:12001';
const KEYCLOAK_URL = import.meta.env.VITE_KEYCLOAK_URL || 'http://localhost:8080';
const APP_ID = import.meta.env.X_APP_ID || 'Form-Builder';

const BASE_URL = import.meta.env.BASE_URL || '/'; // '/form-builder/' in prod, '/' in dev
const LOGIN_PATH = `${BASE_URL}auth/login`.replace('//', '/');

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const keycloakApi = axios.create({
  baseURL: `${KEYCLOAK_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
    'x-app-id': APP_ID,
  },
});

let organizationScopeController = new AbortController();

/** Abort requests issued for the previous organization before switching scope. */
export function rotateOrganizationRequestScope(): void {
  organizationScopeController.abort();
  organizationScopeController = new AbortController();
}

api.interceptors.request.use((config) => {
  config.signal ??= organizationScopeController.signal;
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  const orgId = localStorage.getItem('currentOrgId');
  if (orgId) {
    config.headers['x-org-id'] = orgId;
  }
  return config;
});

keycloakApi.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers['idtoken'] = token;
  }
  return config;
});

// --- Common refresh token handler --------------------------------------------

type AxiosInstance = typeof api | typeof keycloakApi;

let isRefreshing = false;
let pendingRequests: Array<(token: string) => void> = [];

function onTokenRefreshed(newToken: string) {
  pendingRequests.forEach(cb => cb(newToken));
  pendingRequests = [];
}

async function handleTokenRefresh(
  error: any,
  axiosInstance: AxiosInstance,
  setTokenOnRequest: (config: any, token: string) => void
) {
  const originalRequest = error.config;

  // If the failed request was /refresh-token or /user/login ? don't retry, just reject
  if (originalRequest.url?.includes('/refresh-token') || originalRequest.url?.includes('/user/login')) {
    if (originalRequest.url?.includes('/refresh-token')) {
      RemoveItemsFromLocalStorage(true);
      window.location.href = LOGIN_PATH;
    }
    return Promise.reject(error);
  }

  if (error.response?.status !== 401 || originalRequest._retry) {
    return Promise.reject(error);
  }
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) {
    RemoveItemsFromLocalStorage(true);
    window.location.href = LOGIN_PATH;
    return Promise.reject(error);
  }

  if (isRefreshing) {
    return new Promise((resolve) => {
      pendingRequests.push((newToken: string) => {
        setTokenOnRequest(originalRequest, newToken);
        resolve(axiosInstance(originalRequest));
      });
    });
  }

  originalRequest._retry = true;
  isRefreshing = true;

  try {
    const response = await keycloakApi.post('/user/refresh-token', { refreshToken });
    const newAccessToken: string = response.data?.data?.accessToken ?? response.data?.accessToken;
    const newRefreshToken: string = response.data?.data?.refreshToken ?? response.data?.refreshToken;

    localStorage.setItem('token', newAccessToken);
    if (newRefreshToken) localStorage.setItem('refreshToken', newRefreshToken);

    onTokenRefreshed(newAccessToken);
    setTokenOnRequest(originalRequest, newAccessToken);
    return axiosInstance(originalRequest);
  } catch {
    RemoveItemsFromLocalStorage(true);
    window.location.href = LOGIN_PATH;
    return Promise.reject(error);
  } finally {
    isRefreshing = false;
  }
}

api.interceptors.response.use(
  (response) => response,
  (error) => handleTokenRefresh(
    error,
    api,
    (config, token) => { config.headers['Authorization'] = `Bearer ${token}`; }
  )
);

keycloakApi.interceptors.response.use(
  (response) => response,
  (error) => handleTokenRefresh(
    error,
    keycloakApi,
    (config, token) => { config.headers['idtoken'] = token; }
  )
);

export default api;
