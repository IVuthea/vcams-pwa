<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import AppLayout from '@/components/AppLayout.vue';
import SplashScreen from '@/components/SplashScreen.vue';
import { useAuthStore } from '@/stores/auth';
import {
  applyUpdate,
  dismissOfflineReady,
  initServiceWorker,
  offlineReady,
  updateAvailable,
} from '@/registerSW';

const MIN_SPLASH_MS = 1200;
const showSplash = ref(true);
const router = useRouter();
const auth = useAuthStore();

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => window.setTimeout(resolve, ms));

onMounted(async () => {
  initServiceWorker();

  const minDelay = wait(MIN_SPLASH_MS);
  const validate = (async () => {
    if (auth.isAuthenticated) {
      await auth.fetchCurrentUser();
    }
  })();

  await Promise.all([minDelay, validate]);

  const currentName = router.currentRoute.value.name;
  if (auth.isAuthenticated) {
    if (currentName === 'login') {
      await router.replace({ name: 'projects' });
    }
  } else if (currentName !== 'login') {
    await router.replace({ name: 'login' });
  }

  showSplash.value = false;
});
</script>

<template>
  <AppLayout>
    <RouterView />
  </AppLayout>

  <v-snackbar
    :model-value="updateAvailable"
    color="primary"
    location="bottom"
    :timeout="-1"
    @update:model-value="(v) => !v && (updateAvailable = false)"
  >
    A new version is available.
    <template #actions>
      <v-btn variant="text" @click="applyUpdate"> Reload </v-btn>
    </template>
  </v-snackbar>

  <v-snackbar
    :model-value="offlineReady"
    color="success"
    location="bottom"
    :timeout="4000"
    @update:model-value="(v) => !v && dismissOfflineReady()"
  >
    App ready to work offline.
  </v-snackbar>

  <SplashScreen :visible="showSplash" />
</template>
