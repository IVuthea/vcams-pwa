import { ref } from 'vue';
import type { Ref } from 'vue';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const canInstall = ref(false);
const isIos = ref(false);
const installed = ref(false);

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  // iOS Safari uses a non-standard `standalone` flag on navigator.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function detectIosSafari(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  // iPadOS 13+ reports as Mac; check touch + platform too.
  const iPadOs =
    ua.includes('Macintosh') && typeof navigator.maxTouchPoints === 'number' && navigator.maxTouchPoints > 1;
  const isIosDevice = /iPad|iPhone|iPod/.test(ua) || iPadOs;
  if (!isIosDevice) return false;
  // Exclude in-app browsers (Chrome iOS, Firefox iOS, FB, Instagram, etc.) — only Safari can install.
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS|FBAN|FBAV|Instagram|Line/.test(ua);
  return isSafari;
}

if (typeof window !== 'undefined') {
  installed.value = isStandalone();
  isIos.value = detectIosSafari() && !installed.value;
  canInstall.value = isIos.value;

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    canInstall.value = !installed.value;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    canInstall.value = false;
    isIos.value = false;
    installed.value = true;
  });
}

export interface UsePwaInstall {
  canInstall: Ref<boolean>;
  isIos: Ref<boolean>;
  installed: Ref<boolean>;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable' | 'ios-instructions'>;
}

export function usePwaInstall(): UsePwaInstall {
  const promptInstall = async (): Promise<
    'accepted' | 'dismissed' | 'unavailable' | 'ios-instructions'
  > => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice;
      deferredPrompt = null;
      canInstall.value = false;
      return choice.outcome;
    }
    if (isIos.value) return 'ios-instructions';
    return 'unavailable';
  };

  return { canInstall, isIos, installed, promptInstall };
}
