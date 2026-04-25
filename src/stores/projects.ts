import { defineStore } from 'pinia';
import { computed, ref } from 'vue';
import http from '@/http/axios';
import type { NormalizedError } from '@/http/axios';
import type { ProjectModel } from '@/types/project';

function isNormalizedError(e: unknown): e is NormalizedError {
  return (
    typeof e === 'object' &&
    e !== null &&
    'status' in e &&
    'message' in e &&
    typeof (e as { message: unknown }).message === 'string'
  );
}

export const useProjectsStore = defineStore('projects', () => {
  const projects = ref<ProjectModel[]>([]);
  const isLoading = ref(false);
  const error = ref<string | null>(null);
  const isOffline = ref(false);

  const hasProjects = computed(() => projects.value.length > 0);

  async function fetchProjects(): Promise<boolean> {
    isLoading.value = true;
    error.value = null;
    isOffline.value = false;
    try {
      const res = await http.get('/project');
      const list = (res?.data?.data?.projects?.data ?? []) as ProjectModel[];
      projects.value = Array.isArray(list) ? list : [];
      return true;
    } catch (e) {
      if (isNormalizedError(e)) {
        isOffline.value = !!e.isOffline;
        error.value = e.isOffline
          ? 'You are offline. Connect to the internet and try again.'
          : e.message;
      } else if (e instanceof Error) {
        error.value = e.message;
      } else {
        error.value = 'Failed to load projects.';
      }
      return false;
    } finally {
      isLoading.value = false;
    }
  }

  function clearError(): void {
    error.value = null;
  }

  return {
    projects,
    isLoading,
    error,
    isOffline,
    hasProjects,
    fetchProjects,
    clearError,
  };
});
