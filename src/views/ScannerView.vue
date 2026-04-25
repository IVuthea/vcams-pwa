<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useQrScanner } from '@/composables/useQrScanner';
import type { QrScanResult } from '@/composables/useQrScanner';
import { addScan, clearScans, deleteScan, listScans } from '@/db';
import type { ScanRecord } from '@/db';

const {
  videoRef,
  isStarting,
  isScanning,
  hasTorch,
  torchOn,
  cameras,
  activeCameraId,
  error,
  permissionState,
  start,
  stop,
  toggleTorch,
  switchCamera,
  isSecureContext,
  isCameraApiAvailable,
} = useQrScanner();

const recent = ref<ScanRecord[]>([]);
const lastSeen = ref<{ value: string; at: number } | null>(null);
const snackbar = ref<{ show: boolean; text: string; color: string }>({
  show: false,
  text: '',
  color: 'info',
});

const secure = ref<boolean>(true);
const cameraApiAvailable = ref<boolean>(true);
const wasScanningBeforeHidden = ref<boolean>(false);

const showSnack = (text: string, color = 'info'): void => {
  snackbar.value = { show: true, text, color };
};

const refreshHistory = async (): Promise<void> => {
  recent.value = await listScans(10);
};

const handleDecode = async (result: QrScanResult): Promise<void> => {
  // Throttle duplicates within 2 seconds.
  const now = Date.now();
  if (
    lastSeen.value &&
    lastSeen.value.value === result.data &&
    now - lastSeen.value.at < 2000
  ) {
    return;
  }
  lastSeen.value = { value: result.data, at: now };

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(60);
    } catch {
      // ignore (iOS Safari does not support vibrate)
    }
  }

  await addScan(result.data);
  await refreshHistory();
  showSnack('Scan saved', 'success');
};

const onToggleTorch = async (): Promise<void> => {
  if (!hasTorch.value) {
    showSnack(
      'Torch is not available on this camera. iOS Safari and most front cameras do not expose it.',
      'warning',
    );
    return;
  }
  const ok = await toggleTorch();
  if (!ok && error.value) {
    showSnack(error.value, 'warning');
  }
};

const onSwitchCamera = async (id: string | null): Promise<void> => {
  if (!id || id === activeCameraId.value) return;
  await switchCamera(id);
};

const onStop = async (): Promise<void> => {
  await stop();
};

// Triggered by an explicit user click — guarantees a user gesture, which iOS
// Safari (especially in PWA standalone mode) sometimes requires for getUserMedia.
const onEnableCamera = async (): Promise<void> => {
  error.value = null;
  await start(handleDecode);
};

const onDelete = async (id?: number): Promise<void> => {
  if (id === undefined) return;
  await deleteScan(id);
  await refreshHistory();
};

const onClearAll = async (): Promise<void> => {
  await clearScans();
  await refreshHistory();
};

const formatTime = (ts: number): string => {
  try {
    return new Date(ts).toLocaleString();
  } catch {
    return String(ts);
  }
};

const torchIcon = computed(() => (torchOn.value ? 'mdi-flashlight' : 'mdi-flashlight-off'));
const torchLabel = computed(() => (torchOn.value ? 'Torch on' : 'Torch off'));

const cameraSelectModel = computed<string | null>({
  get: () => activeCameraId.value,
  set: (v) => {
    void onSwitchCamera(v);
  },
});

const showEnableButton = computed(
  () => !isScanning.value && !isStarting.value && secure.value && cameraApiAvailable.value,
);

watch(error, (msg) => {
  if (msg) showSnack(msg, 'error');
});

// On iOS Safari, backgrounding the tab can invalidate the camera stream.
// Stop on hidden (good citizen — releases hardware) and auto-resume on visible
// only if the user had it running before.
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

onMounted(async () => {
  secure.value = isSecureContext();
  cameraApiAvailable.value = isCameraApiAvailable();
  await refreshHistory();
  if (secure.value && cameraApiAvailable.value) {
    // Auto-start on mount; on iOS this works in Safari (and PWA on iOS 14.3+),
    // but if it fails the user can retry via the Enable camera button.
    await start(handleDecode);
  }
  document.addEventListener('visibilitychange', onVisibilityChange);
});

onBeforeUnmount(async () => {
  document.removeEventListener('visibilitychange', onVisibilityChange);
  await stop();
});
</script>

<template>
  <v-row
    justify="center"
    class="ma-0"
  >
    <v-col
      cols="12"
      sm="10"
      md="8"
      lg="6"
      class="pa-0"
    >
      <v-card
        class="pa-3"
        elevation="2"
      >
        <div
          v-if="!secure"
          class="text-center py-6"
        >
          <v-icon
            size="64"
            color="warning"
            class="mb-2"
          >
            mdi-lock-alert
          </v-icon>
          <h2 class="text-h6 mb-2">
            Secure context required
          </h2>
          <p class="text-body-2 text-medium-emphasis">
            The camera API only works on <strong>https://</strong> URLs or
            <strong>localhost</strong>. Open this site over HTTPS to scan QR codes.
          </p>
        </div>

        <div
          v-else-if="!cameraApiAvailable"
          class="text-center py-6"
        >
          <v-icon
            size="64"
            color="warning"
            class="mb-2"
          >
            mdi-camera-off
          </v-icon>
          <h2 class="text-h6 mb-2">
            Camera not available
          </h2>
          <p class="text-body-2 text-medium-emphasis">
            This browser does not expose the camera API. On iOS, only Safari (and
            apps using its WebKit engine) can access the camera — open this site in Safari.
          </p>
        </div>

        <div v-else>
          <div class="video-wrap">
            <video
              ref="videoRef"
              class="video"
              muted
              playsinline
              autoplay
              webkit-playsinline="true"
              disablepictureinpicture
            />
            <div
              v-if="isStarting"
              class="overlay"
            >
              <v-progress-circular
                indeterminate
                color="white"
              />
              <span class="overlay-text">Starting camera…</span>
            </div>
            <div
              v-else-if="!isScanning"
              class="overlay overlay-clickable"
              role="button"
              tabindex="0"
              @click="onEnableCamera"
              @keydown.enter="onEnableCamera"
              @keydown.space.prevent="onEnableCamera"
            >
              <v-icon
                size="48"
                color="white"
              >
                {{
                  permissionState === 'denied' ? 'mdi-camera-off' : 'mdi-camera'
                }}
              </v-icon>
              <span class="overlay-text">
                {{
                  permissionState === 'denied'
                    ? 'Camera blocked — enable it in browser settings, then tap to retry'
                    : 'Tap to enable camera'
                }}
              </span>
            </div>
          </div>

          <div class="d-flex flex-wrap align-center mt-3 ga-2">
            <v-btn
              v-if="showEnableButton"
              color="primary"
              :prepend-icon="permissionState === 'denied' ? 'mdi-refresh' : 'mdi-camera'"
              @click="onEnableCamera"
            >
              {{ permissionState === 'denied' ? 'Try again' : 'Enable camera' }}
            </v-btn>

            <v-btn
              :color="torchOn ? 'amber' : 'primary'"
              :prepend-icon="torchIcon"
              :disabled="!isScanning || !hasTorch"
              @click="onToggleTorch"
            >
              {{ torchLabel }}
            </v-btn>

            <v-btn
              v-if="isScanning"
              variant="outlined"
              color="error"
              prepend-icon="mdi-stop"
              @click="onStop"
            >
              Stop
            </v-btn>

            <v-spacer />

            <v-select
              v-if="cameras.length > 1 && isScanning"
              v-model="cameraSelectModel"
              :items="cameras"
              item-title="label"
              item-value="id"
              label="Camera"
              hide-details
              density="compact"
              style="max-width: 220px"
            />
          </div>

          <v-alert
            v-if="!hasTorch && isScanning"
            type="info"
            variant="tonal"
            class="mt-3"
            density="compact"
          >
            Torch is not exposed by this camera. iOS Safari and many front cameras do not support it.
          </v-alert>
        </div>
      </v-card>

      <v-card
        v-if="lastSeen"
        class="pa-4 mt-4"
        color="primary"
        variant="tonal"
      >
        <div class="text-caption text-medium-emphasis">
          Last scan
        </div>
        <div class="text-body-1 font-weight-medium scan-value">
          {{ lastSeen.value }}
        </div>
        <div class="text-caption text-medium-emphasis mt-1">
          {{ formatTime(lastSeen.at) }}
        </div>
      </v-card>

      <v-card class="pa-3 mt-4">
        <div class="d-flex align-center mb-2">
          <h2 class="text-subtitle-1 font-weight-bold">
            Recent scans
          </h2>
          <v-spacer />
          <v-btn
            v-if="recent.length > 0"
            size="small"
            variant="text"
            color="error"
            prepend-icon="mdi-delete-sweep"
            @click="onClearAll"
          >
            Clear
          </v-btn>
        </div>

        <v-list
          v-if="recent.length > 0"
          density="compact"
          class="pa-0"
        >
          <v-list-item
            v-for="item in recent"
            :key="item.id"
            class="px-2"
          >
            <v-list-item-title class="scan-value">
              {{ item.value }}
            </v-list-item-title>
            <v-list-item-subtitle>{{ formatTime(item.createdAt) }}</v-list-item-subtitle>
            <template #append>
              <v-btn
                icon="mdi-delete"
                size="small"
                variant="text"
                color="error"
                @click="onDelete(item.id)"
              />
            </template>
          </v-list-item>
        </v-list>

        <div
          v-else
          class="text-body-2 text-medium-emphasis text-center pa-4"
        >
          No scans yet. Point the camera at a QR code.
        </div>
      </v-card>
    </v-col>
  </v-row>

  <v-snackbar
    v-model="snackbar.show"
    :color="snackbar.color"
    location="bottom"
    :timeout="3000"
  >
    {{ snackbar.text }}
  </v-snackbar>
</template>

<style scoped>
.video-wrap {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  background: #000;
  border-radius: 12px;
  overflow: hidden;
}

.video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  /* Hint Safari to use GPU compositing for the video element. */
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
}

.overlay {
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
  padding: 16px;
}

.overlay-clickable {
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
}

.overlay-clickable:focus-visible {
  outline: 2px solid #fff;
  outline-offset: -4px;
}

.overlay-text {
  font-size: 14px;
  letter-spacing: 0.02em;
}

.scan-value {
  word-break: break-all;
  white-space: normal;
}
</style>
