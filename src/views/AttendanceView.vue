<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useAttendanceStore } from '@/stores/attendance';
import type { AttendanceScanLog } from '@/stores/attendance';
import { useProjectsStore } from '@/stores/projects';
import QrScannerDialog from '@/components/QrScannerDialog.vue';
import {
  ATTENDANCE_PERIODS,
  type AttendancePeriod,
  type AttendancePeriodMeta,
} from '@/types/attendance';

const props = defineProps<{
  projectId: string;
}>();

const store = useAttendanceStore();
const projectsStore = useProjectsStore();

const project = computed(() =>
  projectsStore.projects.find((p) => String(p.id) === String(props.projectId)) ?? null,
);

const projectTitle = computed(
  () => project.value?.full_name || project.value?.sort_name || `Project #${props.projectId}`,
);

watch(
  () => props.projectId,
  (id) => {
    store.setProject(id);
    // If the user deep-linked here we won't have the project list loaded yet —
    // fetch in the background so the header can resolve to a name.
    if (!project.value && !projectsStore.isLoading) {
      void projectsStore.fetchProjects();
    }
  },
  { immediate: true },
);

const isOpen = computed<boolean>({
  get: () => store.isScannerOpen,
  set: (v) => (v ? store.openScanner() : store.closeScanner()),
});

const snackbar = ref<{ show: boolean; text: string; color: string }>({
  show: false,
  text: '',
  color: 'success',
});

const confirmClearOpen = ref(false);

const onConfirmClear = async (): Promise<void> => {
  await store.clearScansForCurrentPeriod();
  confirmClearOpen.value = false;
};

const pendingDelete = ref<AttendanceScanLog | null>(null);

const onAskDelete = (item: AttendanceScanLog): void => {
  pendingDelete.value = item;
};

const onConfirmDelete = async (): Promise<void> => {
  const item = pendingDelete.value;
  pendingDelete.value = null;
  if (!item) return;
  await store.removeScan(item.id);
};

// Group the six periods into shift columns so we can render headers above
// each pair of In/Out buttons while keeping the row visually unified.
type ShiftColumn = {
  shift: AttendancePeriodMeta['shift'];
  shiftLabel: string;
  buttons: AttendancePeriodMeta[];
};

const shiftColumns = computed<ShiftColumn[]>(() => {
  const order: AttendancePeriodMeta['shift'][] = ['morning', 'afternoon', 'ot'];
  return order.map((shift) => ({
    shift,
    shiftLabel: ATTENDANCE_PERIODS.find((p) => p.shift === shift)!.shiftLabel,
    buttons: ATTENDANCE_PERIODS.filter((p) => p.shift === shift),
  }));
});

const selectedMeta = computed(() =>
  ATTENDANCE_PERIODS.find((p) => p.key === store.selectedPeriod) ?? ATTENDANCE_PERIODS[0],
);

const periodScans = computed(() =>
  store.scans.filter((s) => s.period === store.selectedPeriod),
);

const directionColor = (meta: AttendancePeriodMeta): string =>
  meta.direction === 'in' ? 'success' : 'warning';

const onSelect = (key: AttendancePeriod): void => {
  store.selectPeriod(key);
};

const onScan = async (value: string): Promise<void> => {
  const result = await store.recordScan(value);
  if (!result.ok) {
    snackbar.value = { show: true, text: result.error, color: 'error' };
    return;
  }
  const meta = ATTENDANCE_PERIODS.find((p) => p.key === result.log.period);
  snackbar.value = {
    show: true,
    text: `${meta?.shiftLabel ?? ''} ${meta?.directionLabel ?? ''} — ${result.log.employeeName}`,
    color: 'success',
  };
};

const formatTime = (ts: number): string => {
  try {
    return new Date(ts).toLocaleTimeString();
  } catch {
    return String(ts);
  }
};
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
      <div class="d-flex align-center mb-3">
        <v-btn
          icon="mdi-arrow-left"
          variant="text"
          size="small"
          class="mr-2"
          :to="{ name: 'projects' }"
          title="Back to projects"
        />
        <div class="flex-grow-1 min-width-0">
          <h1 class="text-h6 font-weight-bold text-truncate">
            {{ projectTitle }}
          </h1>
        </div>
      </div>

      <v-card
        class="pa-3 pa-sm-4"
        elevation="1"
      >
        <div class="text-caption text-medium-emphasis mb-2">
          Select a period, then tap the <v-icon size="14">mdi-qrcode-scan</v-icon> in the header to scan.
        </div>

        <div class="periods-row">
          <div
            v-for="column in shiftColumns"
            :key="column.shift"
            class="period-column"
          >
            <div class="period-column__label">
              {{ column.shiftLabel }}
            </div>
            <div class="period-column__buttons">
              <v-btn
                v-for="meta in column.buttons"
                :key="meta.key"
                :color="directionColor(meta)"
                :variant="store.selectedPeriod === meta.key ? 'flat' : 'tonal'"
                :class="[
                  'period-button',
                  { 'period-button--active': store.selectedPeriod === meta.key },
                ]"
                density="comfortable"
                size="small"
                @click="onSelect(meta.key)"
              >
                {{ meta.directionLabel }}
              </v-btn>
            </div>
          </div>
        </div>

      </v-card>

      <v-card
        class="pa-3 pa-sm-4 mt-4"
        elevation="1"
      >
        <div class="d-flex align-center mb-2 ga-2">
          <h2 class="text-subtitle-1 font-weight-bold">
            {{ selectedMeta.shiftLabel }} · {{ selectedMeta.directionLabel }}
          </h2>
          <v-chip
            v-if="periodScans.length > 0"
            size="x-small"
            :color="directionColor(selectedMeta)"
            variant="tonal"
          >
            {{ periodScans.length }}
          </v-chip>
          <v-spacer />
          <v-btn
            v-if="periodScans.length > 0"
            size="small"
            variant="text"
            color="error"
            prepend-icon="mdi-delete-sweep"
            :title="`Clear ${selectedMeta.shiftLabel} ${selectedMeta.directionLabel} scans`"
            @click="confirmClearOpen = true"
          >
            Clear
          </v-btn>
          <v-btn
            color="primary"
            size="small"
            prepend-icon="mdi-qrcode-scan"
            @click="store.openScanner"
          >
            Scan
          </v-btn>
        </div>

        <v-progress-linear
          v-if="store.isLoading"
          indeterminate
          color="primary"
          class="mb-2"
        />

        <v-list
          v-if="periodScans.length > 0"
          density="compact"
          class="pa-0"
        >
          <template
            v-for="(item, idx) in periodScans"
            :key="item.id"
          >
            <v-divider v-if="idx > 0" />
            <v-list-item class="px-2">
              <template #prepend>
                <v-icon
                  :color="item.period.endsWith('_in') ? 'success' : 'warning'"
                >
                  {{ item.period.endsWith('_in') ? 'mdi-login-variant' : 'mdi-logout-variant' }}
                </v-icon>
              </template>
              <v-list-item-title class="scan-value">
                {{ item.employeeName }}
              </v-list-item-title>
              <v-list-item-subtitle>
                #{{ item.employeeId }} · {{ formatTime(item.createdAt) }}
              </v-list-item-subtitle>
              <template #append>
                <v-btn
                  icon="mdi-close"
                  size="x-small"
                  variant="text"
                  color="medium-emphasis"
                  @click="onAskDelete(item)"
                />
              </template>
            </v-list-item>
          </template>
        </v-list>

        <div
          v-else-if="!store.isLoading"
          class="text-body-2 text-medium-emphasis text-center pa-4"
        >
          No scans for {{ selectedMeta.shiftLabel }} {{ selectedMeta.directionLabel }} yet.
          Tap <v-icon size="14">mdi-qrcode-scan</v-icon> to scan an employee.
        </div>
      </v-card>
    </v-col>
  </v-row>

  <QrScannerDialog
    v-model="isOpen"
    :title="`Scan — ${selectedMeta.shiftLabel} ${selectedMeta.directionLabel}`"
    @scan="onScan"
  />

  <v-dialog
    :model-value="pendingDelete !== null"
    max-width="420"
    @update:model-value="(v) => !v && (pendingDelete = null)"
  >
    <v-card v-if="pendingDelete">
      <v-card-title class="text-h6">
        Delete this scan?
      </v-card-title>
      <v-card-text>
        Remove <strong>{{ pendingDelete.employeeName }}</strong>
        (#{{ pendingDelete.employeeId }}) from
        {{ selectedMeta.shiftLabel }} {{ selectedMeta.directionLabel }}?
        This cannot be undone.
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="pendingDelete = null"
        >
          Cancel
        </v-btn>
        <v-btn
          color="error"
          variant="elevated"
          prepend-icon="mdi-delete"
          @click="onConfirmDelete"
        >
          Delete
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-dialog
    v-model="confirmClearOpen"
    max-width="420"
  >
    <v-card>
      <v-card-title class="text-h6">
        Clear {{ selectedMeta.shiftLabel }} {{ selectedMeta.directionLabel }} scans?
      </v-card-title>
      <v-card-text>
        This will remove {{ periodScans.length }} scan{{ periodScans.length === 1 ? '' : 's' }}
        from this device. The action cannot be undone.
      </v-card-text>
      <v-card-actions>
        <v-spacer />
        <v-btn
          variant="text"
          @click="confirmClearOpen = false"
        >
          Cancel
        </v-btn>
        <v-btn
          color="error"
          variant="elevated"
          prepend-icon="mdi-delete-sweep"
          @click="onConfirmClear"
        >
          Clear
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>

  <v-snackbar
    v-model="snackbar.show"
    :color="snackbar.color"
    location="bottom"
    :timeout="2000"
  >
    {{ snackbar.text }}
  </v-snackbar>
</template>

<style scoped>
.periods-row {
  display: flex;
  align-items: stretch;
  gap: 8px;
  width: 100%;
}
.period-column {
  flex: 1 1 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 6px;
}
.period-column__label {
  text-align: center;
  font-size: 0.75rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.7;
}
.period-column__buttons {
  display: flex;
  gap: 6px;
}
.period-button {
  flex: 1 1 0;
  min-width: 0;
  letter-spacing: 0.05em;
  text-transform: uppercase;
}
.period-button--active {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
}
.scan-value {
  word-break: break-all;
  white-space: normal;
}
.min-width-0 {
  min-width: 0;
}
</style>
