import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import http from '@/http/axios';
import type { NormalizedError } from '@/http/axios';
import { clearStoredAuth, getStoredAuth, setStoredAuth } from '@/db';
import type { AuthUser } from '@/db';

interface LoginResponse {
  token?: string;
  access_token?: string;
  user?: AuthUser;
  data: {
    token?: string;
  };
  [key: string]: unknown;
}

function isNormalizedError(e: unknown): e is NormalizedError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'status' in e &&
    'message' in e &&
    typeof (e as { message: unknown }).message === 'string'
  );
}

export const useAuthStore = defineStore('auth', () => {
  const token = ref<string | null>(null);
  const user = ref<AuthUser | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const isAuthenticated = computed(() => !!token.value);

  async function restore(): Promise<void> {
    const stored = await getStoredAuth();
    if (stored?.token) {
      token.value = stored.token;
      user.value = stored.user ?? null;
    }
  }

  function extractUser(payload: unknown): AuthUser | null {
    if (!payload || typeof payload !== 'object') return null;
    const root = payload as Record<string, unknown>;
    const candidates: unknown[] = [
      root.user,
      root.data,
      (root.data as Record<string, unknown> | undefined)?.user,
      root,
    ];
    for (const c of candidates) {
      if (c && typeof c === 'object' && 'email' in (c as Record<string, unknown>)) {
        return c as AuthUser;
      }
    }
    return null;
  }

  // Validates the persisted token by fetching the current user.
  // Returns true on success, false otherwise. A 401 will already have
  // triggered logout via the axios onUnauthorized hook.
  async function fetchCurrentUser(): Promise<boolean> {
    if (!token.value) return false;
    try {
      const { data } = await http.get('/auth/user');
      const u = extractUser(data);
      if (u) {
        user.value = u;
        await setStoredAuth({ token: token.value, user: u });
      }
      return true;
    } catch (e) {
      if (isNormalizedError(e) && e.status === 401) {
        await logout();
      }
      return false;
    }
  }

  async function login(username: string, password: string): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      const { data } = await http.post<LoginResponse>('/auth/login', {
        email: username,
        password,
      });
      const t = data?.data?.token;
      if (!t) {
        error.value = 'Login response did not include a token.';
        return false;
      }
      token.value = t;
      user.value = data?.user ?? { email: username };
      await setStoredAuth({ token: t, user: user.value ?? undefined });
      return true;
    } catch (e) {
      if (isNormalizedError(e)) {
        error.value = e.isOffline
          ? 'You are offline. Connect to the internet and try again.'
          : e.message;
      } else if (e instanceof Error) {
        error.value = e.message;
      } else {
        error.value = 'Login failed. Please try again.';
      }
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  async function logout(): Promise<void> {
    token.value = null;
    user.value = null;
    error.value = null;
    await clearStoredAuth();
  }

  function clearError(): void {
    error.value = null;
  }

  return {
    token,
    user,
    isLoading,
    error,
    isAuthenticated,
    restore,
    fetchCurrentUser,
    login,
    logout,
    clearError,
  };
});
