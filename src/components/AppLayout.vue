<script setup lang="ts">
import { computed } from 'vue';
import { useDisplay, useTheme } from 'vuetify';
import { useRoute, useRouter } from 'vue-router';
import { useOnline } from '@/composables/useOnline';
import { useAuthStore } from '@/stores/auth';
import { writeStoredTheme } from '@/utils/themeStorage';

const theme = useTheme();
const display = useDisplay();
const route = useRoute();
const router = useRouter();
const online = useOnline();
const auth = useAuthStore();

const isDark = computed(() => theme.global.current.value.dark);
const isFullscreen = computed(() => route.meta?.fullscreen === true);

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
    <v-app-bar v-if="!isFullscreen" density="comfortable" color="primary" flat>
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
  </v-app>
</template>
