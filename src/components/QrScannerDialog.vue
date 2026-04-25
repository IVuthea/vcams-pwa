<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { useQrScanner } from '@/composables/useQrScanner';
import type { QrScanResult } from '@/composables/useQrScanner';

interface Props {
  modelValue: boolean;
  title?: string;
  // ms to throttle duplicate scans of the same value. Defaults match ScannerView.
  duplicateWindowMs?: number;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Scan QR code',
  duplicateWindowMs: 2000,
});

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  scan: [value: string];
}>();

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

const torchIcon = computed(() => (torchOn.value ? 'mdi-flashlight' : 'mdi-flashlight-off'));

const showEnableButton = computed(
  () => !isScanning.value && !isStarting.value && secure.value && cameraApiAvailable.value,
);

const handleDecode = (result: QrScanResult): void => {
  const now = Date.now();
  if (
    lastSeen.value &&
    lastSeen.value.value === result.data &&
    now - lastSeen.value.at < props.duplicateWindowMs
  ) {
    return;
  }
  lastSeen.value = { value: result.data, at: now };

  if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(60);
    } catch {
      // iOS Safari does not support vibrate
    }
  }

  emit('scan', result.data);
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
  emit('update:modelValue', false);
};

const onVisibilityChange = async (): Promise<void> => {
  if (typeof document === 'undefined') return;
  if (!props.modelValue) return;
  if (document.visibilityState === 'hidden') {
    wasScanningBeforeHidden.value = isScanning.value;
    if (isScanning.value) await stop();
  } else if (document.visibilityState === 'visible' && wasScanningBeforeHidden.value) {
    wasScanningBeforeHidden.value = false;
    await start(handleDecode);
  }
};

watch(
  () => props.modelValue,
  async (open) => {
    if (open) {
      lastSeen.value = null;
      secure.value = isSecureContext();
      cameraApiAvailable.value = isCameraApiAvailable();
      document.addEventListener('visibilitychange', onVisibilityChange);
      if (secure.value && cameraApiAvailable.value) {
        // Wait one tick so the v-dialog has mounted the <video> element.
        await Promise.resolve();
        await start(handleDecode);
      }
    } else {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      await stop();
    }
  },
);
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    fullscreen
    transition="dialog-bottom-transition"
    :persistent="isScanning"
    @update:model-value="(v) => !v && onClose()"
  >
    <v-card
      class="scanner-dialog"
      tile
    >
      <v-toolbar
        density="comfortable"
        color="primary"
      >
        <v-toolbar-title class="font-weight-bold">
          {{ title }}
        </v-toolbar-title>
        <v-spacer />
        <v-btn
          icon="mdi-close"
          variant="text"
          @click="onClose"
        />
      </v-toolbar>

      <div class="scanner-dialog__body">
        <slot
          name="header"
          :last-seen="lastSeen"
        />

        <div
          v-if="!secure"
          class="text-center pa-6 text-white"
        >
          <v-icon
            size="56"
            color="warning"
            class="mb-2"
          >
            mdi-lock-alert
          </v-icon>
          <h2 class="text-h6 mb-2">
            Secure context required
          </h2>
          <p class="text-body-2">
            The camera API only works on <strong>https://</strong> URLs or
            <strong>localhost</strong>.
          </p>
        </div>

        <div
          v-else-if="!cameraApiAvailable"
          class="text-center pa-6 text-white"
        >
          <v-icon
            size="56"
            color="warning"
            class="mb-2"
          >
            mdi-camera-off
          </v-icon>
          <h2 class="text-h6 mb-2">
            Camera not available
          </h2>
          <p class="text-body-2">
            This browser does not expose the camera API. On iOS, only Safari can access the camera.
          </p>
        </div>

        <div
          v-else
          class="scanner-dialog__viewport"
        >
          <video
            ref="videoRef"
            class="scanner-dialog__video"
            muted
            playsinline
            autoplay
            webkit-playsinline="true"
            disablepictureinpicture
          />

          <div
            v-if="isStarting"
            class="scanner-dialog__overlay"
          >
            <v-progress-circular
              indeterminate
              color="white"
            />
            <span class="scanner-dialog__overlay-text">Starting camera…</span>
          </div>

          <div
            v-else-if="!isScanning"
            class="scanner-dialog__overlay scanner-dialog__overlay--clickable"
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
              {{ permissionState === 'denied' ? 'mdi-camera-off' : 'mdi-camera' }}
            </v-icon>
            <span class="scanner-dialog__overlay-text">
              {{
                permissionState === 'denied'
                  ? 'Camera blocked — enable it in browser settings, then tap to retry'
                  : 'Tap to enable camera'
              }}
            </span>
          </div>
        </div>
      </div>

      <div class="scanner-dialog__controls">
        <v-btn
          v-if="showEnableButton"
          color="primary"
          :prepend-icon="permissionState === 'denied' ? 'mdi-refresh' : 'mdi-camera'"
          @click="onEnableCamera"
        >
          {{ permissionState === 'denied' ? 'Try again' : 'Enable camera' }}
        </v-btn>

        <v-btn
          v-if="isScanning"
          :color="torchOn ? 'amber' : 'grey-lighten-3'"
          :prepend-icon="torchIcon"
          :disabled="!hasTorch"
          variant="elevated"
          @click="onToggleTorch"
        >
          {{ torchOn ? 'Torch on' : 'Torch' }}
        </v-btn>

        <v-spacer />

        <v-btn
          variant="outlined"
          color="white"
          @click="onClose"
        >
          Done
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
    </v-card>
  </v-dialog>
</template>

<style scoped>
.scanner-dialog {
  background: #000;
  color: #fff;
  display: flex;
  flex-direction: column;
}
.scanner-dialog__body {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  min-height: 0;
}
.scanner-dialog__viewport {
  position: relative;
  flex: 1 1 auto;
  width: 100%;
  background: #000;
  overflow: hidden;
  min-height: 320px;
}
.scanner-dialog__video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
}
.scanner-dialog__overlay {
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
.scanner-dialog__overlay--clickable {
  cursor: pointer;
  -webkit-user-select: none;
  user-select: none;
}
.scanner-dialog__overlay-text {
  font-size: 14px;
  letter-spacing: 0.02em;
}
.scanner-dialog__controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: rgba(0, 0, 0, 0.85);
  flex-wrap: wrap;
}
</style>
