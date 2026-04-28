<script setup lang="ts">
import { computed, ref } from 'vue';
import { useDisplay, useTheme } from 'vuetify';
import { useRoute, useRouter } from 'vue-router';
import IosInstallDialog from '@/components/IosInstallDialog.vue';
import { useOnline } from '@/composables/useOnline';
import { usePwaInstall } from '@/composables/usePwaInstall';
import { useAuthStore } from '@/stores/auth';
import { writeStoredTheme } from '@/utils/themeStorage';

const theme = useTheme();
const display = useDisplay();
const route = useRoute();
const router = useRouter();
const online = useOnline();
const auth = useAuthStore();
const { canInstall, promptInstall } = usePwaInstall();

const showIosInstall = ref(false);

const onInstallClick = async (): Promise<void> => {
  const outcome = await promptInstall();
  if (outcome === 'ios-instructions') showIosInstall.value = true;
};

const isDark = computed(() => theme.global.current.value.dark);
const isFullscreen = computed(() => route.meta?.fullscreen === true);
const isLogin = computed(() => route.name === 'login');
const showAppBar = computed(() => !isFullscreen.value && !isLogin.value);

const toggleTheme = (): void => {
  const next = isDark.value ? 'light' : 'dark';
  theme.change(next);
  writeStoredTheme(next);
};

const navValue = computed<string>({
  get: () => {
    if (route.name === 'employees') return 'employees';
    if (route.name === 'profile') return 'profile';
    return 'projects';
  },
  set: (val: string) => {
    if (val === 'projects' && route.name !== 'projects') router.push({ name: 'projects' });
    if (val === 'employees' && route.name !== 'employees') router.push({ name: 'employees' });
    if (val === 'profile' && route.name !== 'profile') router.push({ name: 'profile' });
  },
});

const showBottomNav = computed(
  () => display.smAndDown.value && auth.isAuthenticated && !isFullscreen.value,
);
</script>

<template>
  <v-app>
    <v-app-bar v-if="showAppBar" density="comfortable" color="primary" flat>
      <v-app-bar-title class="font-weight-bold"> MEP </v-app-bar-title>

      <v-spacer />

      <v-chip
        :color="online ? 'success' : 'grey-darken-1'"
        size="small"
        variant="elevated"
        class="mr-2"
        :prepend-icon="online ? 'mdi-wifi' : 'mdi-wifi-off'"
      >
        {{ online ? 'Online' : 'Offline' }}
      </v-chip>

      <v-btn
        v-if="canInstall"
        prepend-icon="mdi-download"
        variant="tonal"
        size="small"
        class="mr-2"
        @click="onInstallClick"
      >
        Install
      </v-btn>

      <v-btn
        :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
        variant="text"
        @click="toggleTheme"
      />
    </v-app-bar>

    <v-main>
      <v-container v-if="!isFullscreen" fluid class="pa-3 pa-sm-4">
        <slot />
      </v-container>
      <slot v-else />
    </v-main>

    <v-bottom-navigation v-if="showBottomNav" v-model="navValue" grow color="primary">
      <v-btn value="projects">
        <v-icon>mdi-folder-multiple-outline</v-icon>
        <span>Projects</span>
      </v-btn>
      <v-btn value="employees">
        <v-icon>mdi-account-group-outline</v-icon>
        <span>Employee</span>
      </v-btn>
      <v-btn value="profile">
        <v-icon>mdi-account-circle-outline</v-icon>
        <span>Profile</span>
      </v-btn>
    </v-bottom-navigation>

    <IosInstallDialog v-model="showIosInstall" />
  </v-app>
</template>
