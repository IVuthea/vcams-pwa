import { ref } from 'vue';
import type { Ref } from 'vue';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>;
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const canInstall = ref(false);
const installed = ref(false);

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.matchMedia?.('(display-mode: standalone)').matches) return true;
  // iOS Safari uses a non-standard `standalone` flag on navigator.
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

if (typeof window !== 'undefined') {
  installed.value = isStandalone();

  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    canInstall.value = !installed.value;
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    canInstall.value = false;
    installed.value = true;
  });
}

export interface UsePwaInstall {
  canInstall: Ref<boolean>;
  installed: Ref<boolean>;
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unavailable'>;
}

export function usePwaInstall(): UsePwaInstall {
  const promptInstall = async (): Promise<'accepted' | 'dismissed' | 'unavailable'> => {
    if (!deferredPrompt) return 'unavailable';
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    deferredPrompt = null;
    canInstall.value = false;
    return choice.outcome;
  };

  return { canInstall, installed, promptInstall };
}
