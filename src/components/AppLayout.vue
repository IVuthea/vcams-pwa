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

const toggleTheme = (): void => {
  const next = isDark.value ? 'light' : 'dark';
  theme.change(next);
  writeStoredTheme(next);
};

const navValue = computed<string>({
  get: () => {
    if (route.name === 'scanner') return 'scanner';
    if (route.name === 'projects') return 'projects';
    if (route.name === 'employees') return 'employees';
    if (route.name === 'profile') return 'profile';
    return 'home';
  },
  set: (val: string) => {
    if (val === 'home' && route.name !== 'home') router.push({ name: 'home' });
    if (val === 'scanner' && route.name !== 'scanner') router.push({ name: 'scanner' });
    if (val === 'projects' && route.name !== 'projects') router.push({ name: 'projects' });
    if (val === 'employees' && route.name !== 'employees') router.push({ name: 'employees' });
    if (val === 'profile' && route.name !== 'profile') router.push({ name: 'profile' });
  },
});

const showBottomNav = computed(() => display.smAndDown.value && auth.isAuthenticated);
</script>

<template>
  <v-app>
    <v-app-bar
      density="comfortable"
      color="primary"
      flat
    >
      <v-app-bar-title class="font-weight-bold">
        MEP
      </v-app-bar-title>

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
      <v-container
        fluid
        class="pa-3 pa-sm-4"
      >
        <slot />
      </v-container>
    </v-main>

    <v-bottom-navigation
      v-if="showBottomNav"
      v-model="navValue"
      grow
      color="primary"
    >
      <v-btn value="home">
        <v-icon>mdi-home</v-icon>
        <span>Home</span>
      </v-btn>
      <v-btn value="projects">
        <v-icon>mdi-folder-multiple-outline</v-icon>
        <span>Projects</span>
      </v-btn>
      <v-btn value="employees">
        <v-icon>mdi-account-group-outline</v-icon>
        <span>People</span>
      </v-btn>
      <v-btn value="scanner">
        <v-icon>mdi-qrcode-scan</v-icon>
        <span>Scan</span>
      </v-btn>
      <v-btn value="profile">
        <v-icon>mdi-account-circle-outline</v-icon>
        <span>Profile</span>
      </v-btn>
    </v-bottom-navigation>
  </v-app>
</template>
