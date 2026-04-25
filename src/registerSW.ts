import { ref } from 'vue';
import { registerSW } from 'virtual:pwa-register';

export const updateAvailable = ref(false);
export const offlineReady = ref(false);

let updateSWHandle: ((reloadPage?: boolean) => Promise<void>) | null = null;

export function initServiceWorker(): void {
  if (typeof window === 'undefined') return;
  if (!('serviceWorker' in navigator)) return;

  updateSWHandle = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateAvailable.value = true;
    },
    onOfflineReady() {
      offlineReady.value = true;
    },
    onRegisterError(error) {
      console.warn('Service worker registration failed:', error);
    },
  });
}

export async function applyUpdate(): Promise<void> {
  updateAvailable.value = false;
  await updateSWHandle?.(true);
}

export function dismissOfflineReady(): void {
  offlineReady.value = false;
}
