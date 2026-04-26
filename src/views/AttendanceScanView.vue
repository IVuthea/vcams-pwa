<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { useQrScanner } from '@/composables/useQrScanner';
import type { QrScanResult } from '@/composables/useQrScanner';
import { useAttendanceStore } from '@/stores/attendance';
import { useProjectsStore } from '@/stores/projects';
import { ATTENDANCE_PERIODS } from '@/types/attendance';

const props = defineProps<{
  projectId: string;
}>();

const router = useRouter();
const store = useAttendanceStore();
const projectsStore = useProjectsStore();

// ms to throttle duplicate scans of the same value (matches the prior dialog).
const DUPLICATE_WINDOW_MS = 2000;

const {
  videoRef,
  isStarting,
  isScanning,
  hasTorch,
  torchOn,
  error,
  permissionState,
  start,
  stop,
  toggleTorch,
  isSecureContext,
  isCameraApiAvailable,
} = useQrScanner();

const secure = ref(true);
const cameraApiAvailable = ref(true);
const wasScanningBeforeHidden = ref(false);
const lastSeen = ref<{ value: string; at: number } | null>(null);

const flashOn = ref(false);
let flashTimer: ReturnType<typeof setTimeout> | null = null;
const triggerFlash = (): void => {
  flashOn.value = true;
  if (flashTimer) clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    flashOn.value = false;
    flashTimer = null;
  }, 350);
};

const snackbar = ref<{ show: boolean; text: string; color: string }>({
  show: false,
  text: '',
  color: 'success',
});

const pending = ref<{ rawValue: string; employeeId: number; employeeName: string } | null>(null);
const isSaving = ref(false);

const project = computed(
  () => projectsStore.projects.find((p) => String(p.id) === String(props.projectId)) ?? null,
);

const projectTitle = computed(
  () => project.value?.full_name || project.value?.sort_name || `Project #${props.projectId}`,
);

const selectedMeta = computed(
  () => ATTENDANCE_PERIODS.find((p) => p.key === store.selectedPeriod) ?? ATTENDANCE_PERIODS[0],
);

const headerTitle = computed(
  () => `Scan — ${selectedMeta.value.shiftLabel} ${selectedMeta.value.directionLabel}`,
);

const torchIcon = computed(() => (torchOn.value ? 'mdi-flashlight' : 'mdi-flashlight-off'));

const showEnableButton = computed(
  () => !isScanning.value && !isStarting.value && secure.value && cameraApiAvailable.value,
);

const handleDecode = async (result: QrScanResult): Promise<void> => {
  // While a confirmation is pending, ignore further decodes — the user must
  // save or cancel before we'll act on a new code.
  if (pending.value) return;

  const now = Date.now();
  if (
    lastSeen.value &&
    lastSeen.value.value === result.data &&
    now - lastSeen.value.at < DUPLICATE_WINDOW_MS
  ) {
    return;
  }
  lastSeen.value = { value: result.data, at: now };

  const preview = store.previewScan(result.data);
  if (!preview.ok) {
    snackbar.value = { show: true, text: preview.error, color: 'error' };
    return;
  }

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(60);
    } catch {
      // iOS Safari does not support vibrate
    }
  }

  triggerFlash();

  pending.value = {
    rawValue: result.data,
    employeeId: preview.employeeId,
    employeeName: preview.employeeName,
  };
};

const onSavePending = async (): Promise<void> => {
  if (!pending.value || isSaving.value) return;
  isSaving.value = true;
  try {
    const outcome = await store.recordScan(pending.value.rawValue);
    if (!outcome.ok) {
      snackbar.value = { show: true, text: outcome.error, color: 'error' };
      return;
    }
    const meta = ATTENDANCE_PERIODS.find((p) => p.key === outcome.log.period);
    snackbar.value = {
      show: true,
      text: `${meta?.shiftLabel ?? ''} ${meta?.directionLabel ?? ''} — ${outcome.log.employeeName}`,
      color: 'success',
    };
  } finally {
    pending.value = null;
    // Reset the duplicate guard so the same QR can be re-scanned right after.
    lastSeen.value = null;
    isSaving.value = false;
  }
};

const onCancelPending = (): void => {
  pending.value = null;
  lastSeen.value = null;
};

const onEnableCamera = async (): Promise<void> => {
  error.value = null;
  await start(handleDecode);
};

const onToggleTorch = async (): Promise<void> => {
  if (!hasTorch.value) return;
  await toggleTorch();
};

const onClose = async (): Promise<void> => {
  await stop();
  router.push({ name: 'projects.detail', params: { projectId: props.projectId } });
};

// Tab-hide camera release, mirroring the prior dialog. Resumes only if it
// was scanning before the page was hidden.
const onVisibilityChange = async (): Promise<void> => {
  if (typeof document === 'undefined') return;
  if (document.visibilityState === 'hidden') {
    wasScanningBeforeHidden.value = isScanning.value;
    if (isScanning.value) await stop();
  } else if (document.visibilityState === 'visible' && wasScanningBeforeHidden.value) {
    wasScanningBeforeHidden.value = false;
    await start(handleDecode);
  }
};

watch(
  () => props.projectId,
  (id) => {
    store.setProject(id);
    if (!project.value && !projectsStore.isLoading) {
      void projectsStore.fetchProjects();
    }
  },
  { immediate: true },
);

onMounted(async () => {
  secure.value = isSecureContext();
  cameraApiAvailable.value = isCameraApiAvailable();
  document.addEventListener('visibilitychange', onVisibilityChange);
  if (secure.value && cameraApiAvailable.value) {
    // Wait one tick so the <video> element is mounted before we attach.
    await Promise.resolve();
    await start(handleDecode);
  }
});

onBeforeUnmount(async () => {
  document.removeEventListener('visibilitychange', onVisibilityChange);
  if (flashTimer) {
    clearTimeout(flashTimer);
    flashTimer = null;
  }
  await stop();
});
</script>

<template>
  <div class="scanner-screen">
    <v-toolbar density="comfortable" color="primary">
      <v-btn icon="mdi-arrow-left" variant="text" @click="onClose" />
      <v-toolbar-title class="font-weight-bold">
        <div class="text-truncate">
          {{ headerTitle }}
        </div>
        <div class="text-caption text-truncate text-medium-emphasis">
          {{ projectTitle }}
        </div>
      </v-toolbar-title>
    </v-toolbar>

    <div class="scanner-screen__body">
      <div v-if="!secure" class="text-center pa-6 text-white">
        <v-icon size="56" color="warning" class="mb-2"> mdi-lock-alert </v-icon>
        <h2 class="text-h6 mb-2">Secure context required</h2>
        <p class="text-body-2">
          The camera API only works on <strong>https://</strong> URLs or <strong>localhost</strong>.
        </p>
      </div>

      <div v-else-if="!cameraApiAvailable" class="text-center pa-6 text-white">
        <v-icon size="56" color="warning" class="mb-2"> mdi-camera-off </v-icon>
        <h2 class="text-h6 mb-2">Camera not available</h2>
        <p class="text-body-2">
          This browser does not expose the camera API. On iOS, only Safari can access the camera.
        </p>
      </div>

      <div v-else class="scanner-screen__viewport">
        <video
          ref="videoRef"
          class="scanner-screen__video"
          muted
          playsinline
          autoplay
          webkit-playsinline="true"
          disablepictureinpicture
        />

        <div v-if="isScanning && !isStarting" class="scanner-reticle" aria-hidden="true">
          <div class="scanner-reticle__frame">
            <!-- <span class="scanner-reticle__corner scanner-reticle__corner--tl" /> -->
            <!-- <span class="scanner-reticle__corner scanner-reticle__corner--tr" /> -->
            <!-- <span class="scanner-reticle__corner scanner-reticle__corner--bl" /> -->
            <!-- <span class="scanner-reticle__corner scanner-reticle__corner--br" /> -->
            <span class="scanner-reticle__line" />
          </div>
        </div>

        <div
          v-if="isScanning && !isStarting && !pending"
          class="scanner-reticle__hint"
          aria-hidden="true"
        >
          <v-icon size="20" class="scanner-reticle__hint-icon"> mdi-qrcode-scan </v-icon>
          <span>Point the camera at a QR code</span>
        </div>

        <transition name="flash">
          <div v-if="flashOn" class="scanner-flash" aria-hidden="true" />
        </transition>

        <v-btn
          v-if="isScanning"
          :icon="torchIcon"
          :color="torchOn ? 'amber' : 'grey-darken-3'"
          :disabled="!hasTorch"
          size="large"
          elevation="6"
          class="scanner-fab"
          :title="
            !hasTorch
              ? 'Torch unsupported on this device'
              : torchOn
                ? 'Torch on — tap to turn off'
                : 'Tap to turn torch on'
          "
          @click="onToggleTorch"
        />

        <div v-if="pending" class="scanner-pending" role="dialog" aria-live="polite">
          <div class="scanner-pending__label">Confirm attendance</div>
          <div class="scanner-pending__name">
            {{ pending.employeeName }}
          </div>
          <div class="scanner-pending__actions">
            <v-btn variant="text" color="white" :disabled="isSaving" @click="onCancelPending">
              Cancel
            </v-btn>
            <v-btn
              color="primary"
              prepend-icon="mdi-check"
              :loading="isSaving"
              @click="onSavePending"
            >
              Save
            </v-btn>
          </div>
        </div>

        <div v-if="isStarting" class="scanner-screen__overlay">
          <v-progress-circular indeterminate color="white" />
          <span class="scanner-screen__overlay-text">Starting camera…</span>
        </div>

        <div
          v-else-if="!isScanning"
          class="scanner-screen__overlay scanner-screen__overlay--clickable"
          role="button"
          tabindex="0"
          @click="onEnableCamera"
          @keydown.enter="onEnableCamera"
          @keydown.space.prevent="onEnableCamera"
        >
          <v-icon size="48" color="white">
            {{ permissionState === 'denied' ? 'mdi-camera-off' : 'mdi-camera' }}
          </v-icon>
          <span class="scanner-screen__overlay-text">
            {{
              permissionState === 'denied'
                ? 'Camera blocked — enable it in browser settings, then tap to retry'
                : 'Tap to enable camera'
            }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="showEnableButton || error" class="scanner-screen__controls">
      <v-btn
        v-if="showEnableButton"
        color="primary"
        :prepend-icon="permissionState === 'denied' ? 'mdi-refresh' : 'mdi-camera'"
        @click="onEnableCamera"
      >
        {{ permissionState === 'denied' ? 'Try again' : 'Enable camera' }}
      </v-btn>
    </div>

    <v-alert
      v-if="error"
      type="error"
      variant="tonal"
      density="compact"
      class="ma-3"
      closable
      @click:close="error = null"
    >
      {{ error }}
    </v-alert>

    <v-snackbar v-model="snackbar.show" :color="snackbar.color" location="bottom" :timeout="2000">
      {{ snackbar.text }}
    </v-snackbar>
  </div>
</template>

<style scoped>
.scanner-screen {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #000;
  color: #fff;
  z-index: 1000;
  --reticle-size: min(70vw, 70vh, 320px);
}
.scanner-screen__body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  min-height: 0;
}
.scanner-screen__viewport {
  position: relative;
  flex: 1 1 auto;
  width: 100%;
  background: #000;
  overflow: hidden;
  min-height: 320px;
}
.scanner-screen__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  background: #000;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
}
.scanner-screen__overlay {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  text-align: center;
  padding: 24px;
}
.scanner-screen__overlay--clickable {
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
}
.scanner-screen__overlay-text {
  font-size: 14px;
  letter-spacing: 0.02em;
}
.scanner-screen__controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.85);
  flex-wrap: wrap;
}

.scanner-reticle {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 1;
}
.scanner-reticle__hint {
  position: absolute;
  top: max(24px, env(safe-area-inset-top));
  left: 50%;
  transform: translateX(-50%);
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.02em;
  color: #fff;
  padding: 8px 16px 8px 12px;
  background: rgb(var(--v-theme-primary) / 0.9);
  border: 1px solid rgb(var(--v-theme-primary));
  border-radius: 999px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
  animation: scanner-hint-pulse 2s ease-in-out infinite;
  white-space: nowrap;
  pointer-events: none;
  z-index: 10;
}
.scanner-reticle__frame {
  position: absolute;
  top: 50%;
  left: 50%;
  width: var(--reticle-size);
  aspect-ratio: 1;
  transform: translate(-50%, -50%);
  border-radius: 12px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.45);
}
.scanner-reticle__corner {
  position: absolute;
  width: 28px;
  height: 28px;
  border: 0 solid #fff;
}
.scanner-reticle__corner--tl {
  top: -2px;
  left: -2px;
  border-top-width: 3px;
  border-left-width: 3px;
  border-top-left-radius: 12px;
}
.scanner-reticle__corner--tr {
  top: -2px;
  right: -2px;
  border-top-width: 3px;
  border-right-width: 3px;
  border-top-right-radius: 12px;
}
.scanner-reticle__corner--bl {
  bottom: -2px;
  left: -2px;
  border-bottom-width: 3px;
  border-left-width: 3px;
  border-bottom-left-radius: 12px;
}
.scanner-reticle__corner--br {
  bottom: -2px;
  right: -2px;
  border-bottom-width: 3px;
  border-right-width: 3px;
  border-bottom-right-radius: 12px;
}
.scanner-reticle__line {
  position: absolute;
  left: 8%;
  right: 8%;
  height: 2px;
  background: linear-gradient(
    90deg,
    rgb(var(--v-theme-primary) / 0) 0%,
    rgb(var(--v-theme-primary) / 0.95) 50%,
    rgb(var(--v-theme-primary) / 0) 100%
  );
  box-shadow: 0 0 12px rgb(var(--v-theme-primary) / 0.7);
  border-radius: 2px;
  animation: scanner-reticle-sweep 2.4s ease-in-out infinite;
}
@keyframes scanner-reticle-sweep {
  0%,
  100% {
    top: 8%;
  }
  50% {
    top: 92%;
  }
}
.scanner-reticle__hint-icon {
  color: #fff;
}
@keyframes scanner-hint-pulse {
  0%,
  100% {
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.35),
      0 0 0 0 rgb(var(--v-theme-primary) / 0.55);
  }
  50% {
    box-shadow:
      0 4px 16px rgba(0, 0, 0, 0.35),
      0 0 0 10px rgb(var(--v-theme-primary) / 0);
  }
}
@media (prefers-reduced-motion: reduce) {
  .scanner-reticle__hint {
    animation: none;
  }
  .scanner-reticle__line {
    animation: none;
    top: 50%;
  }
}

.scanner-fab {
  position: absolute;
  left: 50%;
  top: calc(50% + var(--reticle-size) / 2 + 28px);
  transform: translateX(-50%);
  z-index: 3;
}

.scanner-pending {
  position: absolute;
  left: 50%;
  bottom: max(24px, env(safe-area-inset-bottom));
  transform: translateX(-50%);
  width: min(92%, 420px);
  background: rgba(0, 0, 0, 0.78);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 14px;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: #fff;
  text-align: center;
  z-index: 4;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}
.scanner-pending__label {
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.7);
}
.scanner-pending__name {
  font-size: 18px;
  font-weight: 600;
  line-height: 1.2;
  word-break: break-word;
}
.scanner-pending__actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 4px;
}

.scanner-flash {
  position: absolute;
  inset: 0;
  background: rgb(var(--v-theme-primary) / 0.35);
  pointer-events: none;
  z-index: 2;
}

/* qr-scanner library overlays (highlightScanRegion / highlightCodeOutline)
   inject SVGs as siblings of <video>. :deep() reaches past scoped styles. */
.scanner-screen__viewport :deep(.scan-region-highlight-svg),
.scanner-screen__viewport :deep(.code-outline-highlight) {
  stroke: rgb(var(--v-theme-primary)) !important;
}
.flash-enter-active,
.flash-leave-active {
  transition: opacity 0.35s ease-out;
}
.flash-enter-from,
.flash-leave-to {
  opacity: 0;
}
</style>
