<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useProfileStore } from '@/stores/profile';
import { useAuthStore } from '@/stores/auth';
import PullToRefresh from '@/components/PullToRefresh.vue';

const profile = useProfileStore();
const auth = useAuthStore();
const router = useRouter();

const employee = computed(() => profile.employee);

const initial = computed(() => {
  const name = employee.value?.name ?? '';
  return (name.trim().charAt(0) || '?').toUpperCase();
});

const wageTypeLabel = computed(() => {
  const v = employee.value?.wage_type;
  if (!v) return null;
  return v.charAt(0).toUpperCase() + v.slice(1).replace(/_/g, ' ');
});

const workingStatusColor = computed(() => {
  const v = (employee.value?.working_status ?? '').toLowerCase();
  if (v === 'active' || v === 'working') return 'success';
  if (v === 'inactive' || v === 'leave' || v === 'on_leave') return 'warning';
  if (v === 'terminated' || v === 'resigned') return 'error';
  return 'primary';
});

const onPullRefresh = (): Promise<boolean> => profile.fetchProfile();

const onLogout = async (): Promise<void> => {
  await auth.logout();
  profile.reset();
  await router.replace({ name: 'login' });
};

onMounted(() => {
  if (!profile.isLoaded) {
    void profile.fetchProfile();
  }
});
</script>

<template>
  <v-row justify="center" class="ma-0">
    <v-col cols="12" sm="10" md="8" lg="6" class="pa-0">
      <PullToRefresh :on-refresh="onPullRefresh" :disabled="profile.isLoading">
        <div class="d-flex align-center mb-3">
          <h1 class="text-h5 font-weight-bold">My profile</h1>
        </div>

        <v-alert
          v-if="profile.error"
          type="error"
          variant="tonal"
          class="mb-3"
          closable
          @click:close="profile.clearError"
        >
          {{ profile.error }}
        </v-alert>

        <v-card v-if="profile.isLoading && !profile.isLoaded" class="pa-4" elevation="1">
          <div class="d-flex flex-column align-center">
            <v-skeleton-loader type="avatar" size="120" class="mb-3" />
            <v-skeleton-loader type="text" width="60%" />
            <v-skeleton-loader type="text" width="40%" />
          </div>
          <v-divider class="my-4" />
          <v-skeleton-loader type="list-item-two-line" />
          <v-skeleton-loader type="list-item-two-line" />
          <v-skeleton-loader type="list-item-two-line" />
        </v-card>

        <template v-else-if="employee">
          <v-card class="profile-hero pa-6 text-center" elevation="2">
            <v-avatar size="120" class="profile-hero__avatar mb-3">
              <v-img
                v-if="employee.profile?.url"
                :src="employee.profile.url"
                :alt="employee.name || 'Profile photo'"
              />
              <span v-else class="text-h2 font-weight-bold text-white">
                {{ initial }}
              </span>
            </v-avatar>

            <h2 class="text-h5 font-weight-bold">
              {{ employee.name || 'Unnamed employee' }}
            </h2>

            <div class="d-flex flex-wrap justify-center align-center mt-2 ga-2">
              <v-chip
                v-if="employee.role?.name"
                color="primary"
                size="small"
                variant="tonal"
                prepend-icon="mdi-shield-account"
              >
                {{ employee.role.name }}
              </v-chip>
              <v-chip
                v-if="employee.working_status"
                :color="workingStatusColor"
                size="small"
                variant="tonal"
                prepend-icon="mdi-circle-medium"
              >
                {{ employee.working_status }}
              </v-chip>
            </div>
          </v-card>

          <v-card class="mt-3" elevation="1">
            <v-list lines="two" density="comfortable">
              <v-list-item v-if="employee.code">
                <template #prepend>
                  <v-icon color="primary"> mdi-identifier </v-icon>
                </template>
                <v-list-item-title>Employee code</v-list-item-title>
                <v-list-item-subtitle>{{ employee.code }}</v-list-item-subtitle>
              </v-list-item>

              <v-divider v-if="employee.code && employee.phone" />

              <v-list-item v-if="employee.phone">
                <template #prepend>
                  <v-icon color="primary"> mdi-phone </v-icon>
                </template>
                <v-list-item-title>Phone</v-list-item-title>
                <v-list-item-subtitle>
                  <a :href="`tel:${employee.phone}`" class="text-decoration-none">{{
                    employee.phone
                  }}</a>
                </v-list-item-subtitle>
              </v-list-item>

              <v-divider v-if="employee.phone && wageTypeLabel" />

              <v-list-item v-if="wageTypeLabel">
                <template #prepend>
                  <v-icon color="primary"> mdi-cash-multiple </v-icon>
                </template>
                <v-list-item-title>Wage type</v-list-item-title>
                <v-list-item-subtitle>{{ wageTypeLabel }}</v-list-item-subtitle>
              </v-list-item>

              <v-divider v-if="wageTypeLabel && employee.nfc" />

              <v-list-item v-if="employee.nfc">
                <template #prepend>
                  <v-icon color="primary"> mdi-nfc-variant </v-icon>
                </template>
                <v-list-item-title>NFC tag</v-list-item-title>
                <v-list-item-subtitle class="font-monospace">
                  {{ employee.nfc }}
                </v-list-item-subtitle>
              </v-list-item>

              <v-divider v-if="employee.nfc && employee.role?.code" />

              <v-list-item v-if="employee.role?.code">
                <template #prepend>
                  <v-icon color="primary"> mdi-key-variant </v-icon>
                </template>
                <v-list-item-title>Role code</v-list-item-title>
                <v-list-item-subtitle>{{ employee.role.code }}</v-list-item-subtitle>
              </v-list-item>
            </v-list>
          </v-card>

          <v-btn
            color="error"
            variant="tonal"
            size="large"
            block
            class="mt-4"
            prepend-icon="mdi-logout"
            @click="onLogout"
          >
            Sign out
          </v-btn>
        </template>

        <v-card v-else class="pa-6 text-center" variant="tonal">
          <v-icon size="48" color="primary" class="mb-2"> mdi-account-question-outline </v-icon>
          <div class="text-body-1 font-weight-medium">Profile not available</div>
          <div class="text-body-2 text-medium-emphasis mt-1">
            Pull down to retry, or sign out and back in.
          </div>
        </v-card>
      </PullToRefresh>
    </v-col>
  </v-row>
</template>

<style scoped>
.profile-hero {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-surface)) 0%,
    rgba(var(--v-theme-primary), 0.06) 100%
  );
}
.profile-hero__avatar {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-secondary)) 100%
  );
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.15);
}
</style>
