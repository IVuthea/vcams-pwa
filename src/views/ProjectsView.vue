<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { useProjectsStore } from '@/stores/projects';
import PullToRefresh from '@/components/PullToRefresh.vue';
import type { ProjectModel } from '@/types/project';

const store = useProjectsStore();
const router = useRouter();
const search = ref('');

const onPullRefresh = (): Promise<boolean> => store.fetchProjects();

const goToAttendance = (project: ProjectModel): void => {
  router.push({ name: 'projects.detail', params: { projectId: String(project.id) } });
};

const filtered = computed<ProjectModel[]>(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return store.projects;
  return store.projects.filter((p) => {
    const haystack = [
      p.full_name,
      p.sort_name,
      p.code,
      p.main_constructor,
      p.visibility_label,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
});

const visibilityColor = (visibility?: string): string => {
  if (visibility) return 'primary';
  return 'grey';
};

const formatDate = (value?: string): string => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

onMounted(() => {
  if (!store.hasProjects) {
    void store.fetchProjects();
  }
});
</script>

<template>
  <v-row
    justify="center"
    class="ma-0"
  >
    <v-col
      cols="12"
      md="10"
      lg="8"
      class="pa-0"
    >
      <PullToRefresh
        :on-refresh="onPullRefresh"
        :disabled="store.isLoading"
      >
        <div class="d-flex align-center mb-3">
          <h1 class="text-h5 font-weight-bold">
            Projects
          </h1>
        </div>

      <v-text-field
        v-model="search"
        prepend-inner-icon="mdi-magnify"
        placeholder="Search by name, code, or constructor"
        variant="outlined"
        density="comfortable"
        hide-details
        clearable
        class="mb-3"
      />

      <v-alert
        v-if="store.error"
        type="error"
        variant="tonal"
        class="mb-3"
        closable
        @click:close="store.clearError"
      >
        {{ store.error }}
      </v-alert>

      <template v-if="store.isLoading && !store.hasProjects">
        <v-card
          v-for="n in 4"
          :key="n"
          class="mb-3 pa-3"
          elevation="1"
        >
          <div class="d-flex align-center">
            <v-skeleton-loader
              type="avatar"
              class="mr-3"
            />
            <div class="flex-grow-1">
              <v-skeleton-loader type="text" />
              <v-skeleton-loader type="text" />
            </div>
          </div>
        </v-card>
      </template>

      <template v-else-if="filtered.length === 0">
        <v-card
          class="pa-6 text-center"
          variant="tonal"
        >
          <v-icon
            size="48"
            color="primary"
            class="mb-2"
          >
            mdi-folder-open-outline
          </v-icon>
          <div class="text-body-1 font-weight-medium">
            {{ search ? 'No matching projects' : 'No projects yet' }}
          </div>
          <div class="text-body-2 text-medium-emphasis mt-1">
            {{ search ? 'Try a different search term.' : 'Pull to refresh once projects are available.' }}
          </div>
        </v-card>
      </template>

      <template v-else>
        <v-card
          v-for="project in filtered"
          :key="project.id"
          class="mb-3 project-card"
          elevation="1"
          role="button"
          tabindex="0"
          @click="goToAttendance(project)"
          @keydown.enter="goToAttendance(project)"
          @keydown.space.prevent="goToAttendance(project)"
        >
          <div class="project-cover">
            <v-img
              v-if="project.profile?.url"
              :src="project.profile.url"
              :alt="project.full_name || project.sort_name || 'Project'"
              :aspect-ratio="16 / 9"
              cover
              class="project-cover__img"
            >
              <template #placeholder>
                <div class="d-flex fill-height align-center justify-center">
                  <v-progress-circular
                    indeterminate
                    color="primary"
                    size="28"
                  />
                </div>
              </template>
              <template #error>
                <div class="project-cover__fallback d-flex fill-height align-center justify-center">
                  <v-icon
                    size="56"
                    color="white"
                  >
                    mdi-image-broken-variant
                  </v-icon>
                </div>
              </template>
            </v-img>
            <div
              v-else
              class="project-cover__fallback d-flex align-center justify-center"
            >
              <span class="text-h3 font-weight-bold text-white">
                {{ (project.sort_name || project.full_name || '?').charAt(0).toUpperCase() }}
              </span>
            </div>

            <v-chip
              v-if="project.visibility_label || project.visibility"
              :color="visibilityColor(project.visibility)"
              size="small"
              variant="elevated"
              class="project-cover__badge"
            >
              {{ project.visibility_label || project.visibility }}
            </v-chip>
          </div>

          <v-card-item class="pb-1">
            <v-card-title class="text-wrap">
              {{ project.full_name || project.sort_name || `Project #${project.id}` }}
            </v-card-title>
            <v-card-subtitle v-if="project.code">
              <v-icon
                size="14"
                class="mr-1"
              >
                mdi-pound
              </v-icon>
              {{ project.code }}
            </v-card-subtitle>
          </v-card-item>

          <v-card-text class="pt-2">
            <div
              v-if="project.main_constructor"
              class="d-flex align-center mb-1 text-body-2"
            >
              <v-icon
                size="18"
                class="mr-2"
                color="medium-emphasis"
              >
                mdi-account-hard-hat
              </v-icon>
              <span class="text-medium-emphasis mr-2">Constructor:</span>
              <span>{{ project.main_constructor }}</span>
            </div>
            <div class="d-flex align-center flex-wrap text-body-2">
              <v-icon
                size="18"
                class="mr-2"
                color="medium-emphasis"
              >
                mdi-calendar-range
              </v-icon>
              <span class="text-medium-emphasis mr-2">Duration:</span>
              <span>{{ formatDate(project.start_date) }} → {{ formatDate(project.end_date) }}</span>
            </div>
          </v-card-text>
        </v-card>
      </template>
      </PullToRefresh>
    </v-col>
  </v-row>
</template>

<style scoped>
.project-card {
  overflow: hidden;
  cursor: pointer;
  transition: transform 120ms ease, box-shadow 120ms ease;
}
.project-card:hover {
  transform: translateY(-1px);
}
.project-card:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.project-cover {
  position: relative;
}
.project-cover__img {
  width: 100%;
}
.project-cover__fallback {
  aspect-ratio: 16 / 9;
  width: 100%;
  background: linear-gradient(135deg, rgb(var(--v-theme-primary)) 0%, rgb(var(--v-theme-secondary)) 100%);
}
.project-cover__badge {
  position: absolute;
  top: 12px;
  right: 12px;
}
</style>
