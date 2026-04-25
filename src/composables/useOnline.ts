import { onBeforeUnmount, onMounted, ref } from 'vue';
import type { Ref } from 'vue';

export function useOnline(): Ref<boolean> {
  const online = ref(typeof navigator === 'undefined' ? true : navigator.onLine);

  const setOnline = () => (online.value = true);
  const setOffline = () => (online.value = false);

  onMounted(() => {
    window.addEventListener('online', setOnline);
    window.addEventListener('offline', setOffline);
  });

  onBeforeUnmount(() => {
    window.removeEventListener('online', setOnline);
    window.removeEventListener('offline', setOffline);
  });

  return online;
}
