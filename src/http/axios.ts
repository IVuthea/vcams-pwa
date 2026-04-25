import axios from 'axios';
import type { AxiosError, AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';

export class OfflineError extends Error {
  readonly isOffline = true;
  constructor(message = 'You are offline. Please check your connection and try again.') {
    super(message);
    this.name = 'OfflineError';
  }
}

export interface NormalizedError {
  status: number;
  message: string;
  data: unknown;
  isOffline?: boolean;
}

export interface AuthHooks {
  getToken: () => string | null;
  onUnauthorized: () => void;
}

// Late-bound auth hooks. main.ts calls configureAuthHooks() after the Pinia
// store is available — this avoids a circular import between axios and the
// auth store, which both need to know about each other.
let hooks: AuthHooks = {
  getToken: () => null,
  onUnauthorized: () => {},
};

export function configureAuthHooks(next: AuthHooks): void {
  hooks = next;
}

const baseURL = (import.meta.env.VITE_API_BASE_URL ?? '').trim();

const http: AxiosInstance = axios.create({
  baseURL: baseURL.length > 0 ? baseURL : undefined,
  timeout: 15_000,
  headers: {
    Accept: 'application/json',
  },
});

http.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return Promise.reject(new OfflineError());
  }
  const token = hooks.getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

http.interceptors.response.use(
  (response: AxiosResponse) => response,
  (error: unknown) => {
    if (error instanceof OfflineError) {
      const normalized: NormalizedError = {
        status: 0,
        message: error.message,
        data: null,
        isOffline: true,
      };
      return Promise.reject(normalized);
    }

    const axErr = error as AxiosError;
    const status = axErr.response?.status ?? 0;
    const data = axErr.response?.data ?? null;
    const message =
      (data && typeof data === 'object' && 'message' in data
        ? String((data as { message: unknown }).message)
        : null) ??
      axErr.message ??
      'Request failed';

    if (status === 401) {
      try {
        hooks.onUnauthorized();
      } catch {
        // ignore — never let an auth-handler throw block the rejection
      }
    }

    const normalized: NormalizedError = { status, message, data };
    return Promise.reject(normalized);
  },
);

export default http;
