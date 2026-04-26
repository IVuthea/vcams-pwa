import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import http from '@/http/axios';
import type { NormalizedError } from '@/http/axios';
import type { EmployeeModel } from '@/types/employee';

function isNormalizedError(e: unknown): e is NormalizedError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'status' in e &&
    'message' in e &&
    typeof (e as { message: unknown }).message === 'string'
  );
}

// /auth/user may return the employee at the root, under `data`, or under
// `data.user` depending on the backend wrapper. We accept any envelope that
// hands us an object with an `id`.
function extractEmployee(payload: unknown): EmployeeModel | null {
  if (!payload || typeof payload !== 'object') return null;
  const root = payload as Record<string, unknown>;
  const data = root.data as Record<string, unknown> | undefined;
  const candidates: unknown[] = [root.user, root.employee, data?.user, data?.employee, data, root];
  for (const c of candidates) {
    if (c && typeof c === 'object' && 'id' in (c as Record<string, unknown>)) {
      return c as EmployeeModel;
    }
  }
  return null;
}

export const useProfileStore = defineStore('profile', () => {
  const employee = ref<EmployeeModel | null>(null);
  const isLoading = ref(false);
  const error = ref<string | null>(null);

  const isLoaded = computed(() => employee.value !== null);

  async function fetchProfile(): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    try {
      const { data } = await http.get('/auth/user');
      const e = extractEmployee(data);
      if (!e) {
        error.value = 'Unexpected response from /auth/user.';
        return false;
      }
      employee.value = e;
      return true;
    } catch (e) {
      if (isNormalizedError(e)) {
        error.value = e.isOffline
          ? 'You are offline. Connect to the internet and try again.'
          : e.message;
      } else if (e instanceof Error) {
        error.value = e.message;
      } else {
        error.value = 'Failed to load profile.';
      }
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  function clearError(): void {
    error.value = null;
  }

  function reset(): void {
    employee.value = null;
    error.value = null;
  }

  return {
    employee,
    isLoading,
    error,
    isLoaded,
    fetchProfile,
    clearError,
    reset,
  };
});
