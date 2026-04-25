<script setup lang="ts">
import { useRouter } from 'vue-router';

const router = useRouter();
const goScan = (): void => {
  router.push({ name: 'scanner' });
};
const goProjects = (): void => {
  router.push({ name: 'projects' });
};
const goEmployees = (): void => {
  router.push({ name: 'employees' });
};
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
        class="pa-6 mt-4 text-center"
        elevation="2"
      >
        <v-avatar
          color="primary"
          size="96"
          class="mb-4"
        >
          <v-icon
            size="56"
            color="white"
          >
            mdi-cube-outline
          </v-icon>
        </v-avatar>
        <h1 class="text-h5 font-weight-bold mb-2">
          Cube scanner
        </h1>
        <p class="text-body-1 text-medium-emphasis mb-6">
          Fast offline-capable QR code scanner with torch toggle.
        </p>
        <v-btn
          color="primary"
          size="large"
          prepend-icon="mdi-qrcode-scan"
          block
          @click="goScan"
        >
          Open scanner
        </v-btn>
        <v-btn
          color="primary"
          size="large"
          variant="tonal"
          prepend-icon="mdi-folder-multiple-outline"
          block
          class="mt-3"
          @click="goProjects"
        >
          Browse projects
        </v-btn>
        <v-btn
          color="primary"
          size="large"
          variant="tonal"
          prepend-icon="mdi-account-group-outline"
          block
          class="mt-3"
          @click="goEmployees"
        >
          Browse employees
        </v-btn>
        <p class="text-caption text-medium-emphasis mt-3 mb-0">
          For attendance, open a project from <a
            href="javascript:void(0)"
            @click="goProjects"
          >Browse projects</a> and tap a project card.
        </p>
      </v-card>

      <v-card
        class="pa-4 mt-4"
        variant="tonal"
      >
        <div class="d-flex align-center">
          <v-icon
            class="mr-3"
            color="primary"
          >
            mdi-information-outline
          </v-icon>
          <div class="text-body-2">
            Install this app from your browser menu to use it like a native app, even offline.
          </div>
        </div>
      </v-card>
    </v-col>
  </v-row>
</template>
