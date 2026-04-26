<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useEmployeesStore } from '@/stores/employees';
import PullToRefresh from '@/components/PullToRefresh.vue';
import type { EmployeeModel } from '@/types/employee';

const store = useEmployeesStore();
const search = ref('');

const filtered = computed<EmployeeModel[]>(() => {
  const q = search.value.trim().toLowerCase();
  if (!q) return store.employees;
  return store.employees.filter((e) => {
    const haystack = [e.name, e.code, e.phone, e.nfc, e.role?.name, e.role?.code, e.working_status]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();
    return haystack.includes(q);
  });
});

const initialOf = (e: EmployeeModel): string => {
  const name = e.name ?? '';
  return (name.trim().charAt(0) || '?').toUpperCase();
};

const workingStatusColor = (status?: string): string => {
  const v = (status ?? '').toLowerCase();
  if (v === 'active' || v === 'working') return 'success';
  if (v === 'inactive' || v === 'leave' || v === 'on_leave') return 'warning';
  if (v === 'terminated' || v === 'resigned') return 'error';
  return 'primary';
};

const onPullRefresh = (): Promise<boolean> => store.fetchEmployees();

onMounted(() => {
  if (!store.hasEmployees) {
    void store.fetchEmployees();
  }
});
</script>

<template>
  <v-row justify="center" class="ma-0">
    <v-col cols="12" md="10" lg="8" class="pa-0">
      <PullToRefresh :on-refresh="onPullRefresh" :disabled="store.isLoading">
        <div class="d-flex align-center mb-3">
          <h1 class="text-h5 font-weight-bold">Employees</h1>
          <v-spacer />
          <v-chip v-if="store.hasEmployees" color="primary" size="small" variant="tonal">
            {{ filtered.length }} / {{ store.employees.length }}
          </v-chip>
        </div>

        <v-text-field
          v-model="search"
          prepend-inner-icon="mdi-magnify"
          placeholder="Search by name, code, phone, role…"
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

        <template v-if="store.isLoading && !store.hasEmployees">
          <v-card v-for="n in 5" :key="n" class="mb-3 pa-3" elevation="1">
            <div class="d-flex align-center">
              <v-skeleton-loader type="avatar" class="mr-3" />
              <div class="flex-grow-1">
                <v-skeleton-loader type="text" />
                <v-skeleton-loader type="text" />
              </div>
            </div>
          </v-card>
        </template>

        <template v-else-if="filtered.length === 0">
          <v-card class="pa-6 text-center" variant="tonal">
            <v-icon size="48" color="primary" class="mb-2"> mdi-account-group-outline </v-icon>
            <div class="text-body-1 font-weight-medium">
              {{ search ? 'No matching employees' : 'No employees yet' }}
            </div>
            <div class="text-body-2 text-medium-emphasis mt-1">
              {{ search ? 'Try a different search term.' : 'Pull down to refresh.' }}
            </div>
          </v-card>
        </template>

        <template v-else>
          <v-card
            v-for="employee in filtered"
            :key="employee.id"
            class="mb-3 employee-card"
            elevation="1"
          >
            <v-list-item
              :title="employee.name || `Employee #${employee.id}`"
              :subtitle="employee.role?.name || employee.code || undefined"
              class="py-3"
            >
              <template #prepend>
                <v-avatar size="48" class="employee-avatar">
                  <v-img
                    v-if="employee.profile?.url"
                    :src="employee.profile.url"
                    :alt="employee.name || 'Employee'"
                  />
                  <span v-else class="text-h6 font-weight-bold text-white">
                    {{ initialOf(employee) }}
                  </span>
                </v-avatar>
              </template>

              <template #append>
                <v-chip
                  v-if="employee.working_status"
                  :color="workingStatusColor(employee.working_status)"
                  size="small"
                  variant="tonal"
                >
                  {{ employee.working_status }}
                </v-chip>
              </template>
            </v-list-item>

            <v-divider />

            <div class="px-4 py-3 text-body-2 d-flex flex-column ga-1">
              <div v-if="employee.code" class="d-flex align-center">
                <v-icon size="18" class="mr-2" color="medium-emphasis"> mdi-identifier </v-icon>
                <span class="text-medium-emphasis mr-2">:</span>
                <span>{{ employee.code }}</span>
              </div>
              <div v-if="employee.phone" class="d-flex align-center">
                <v-icon size="18" class="mr-2" color="medium-emphasis"> mdi-phone </v-icon>
                <span class="text-medium-emphasis mr-2">:</span>
                <a :href="`tel:${employee.phone}`" class="text-decoration-none">{{
                  employee.phone
                }}</a>
              </div>
              <div v-if="employee.nfc" class="d-flex align-center">
                <v-icon size="18" class="mr-2" color="medium-emphasis"> mdi-nfc-variant </v-icon>
                <span class="text-medium-emphasis mr-2">NFC:</span>
                <span class="font-monospace">{{ employee.nfc }}</span>
              </div>
            </div>
          </v-card>
        </template>
      </PullToRefresh>
    </v-col>
  </v-row>
</template>

<style scoped>
.employee-card {
  overflow: hidden;
  transition: transform 120ms ease;
}
.employee-card:hover {
  transform: translateY(-1px);
}
.employee-avatar {
  background: linear-gradient(
    135deg,
    rgb(var(--v-theme-primary)) 0%,
    rgb(var(--v-theme-secondary)) 100%
  );
}
</style>
