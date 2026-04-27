<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '@/stores/auth';

interface VForm {
  validate: () => Promise<{ valid: boolean }>;
}

const auth = useAuthStore();
const router = useRouter();
const route = useRoute();

const username = ref('');
const password = ref('');
const showPassword = ref(false);
const formRef = ref<VForm | null>(null);
const appVersion = __APP_VERSION__;

const usernameRules = [
  (v: string): true | string => (!!v && v.trim().length > 0) || 'Username is required',
];

const passwordRules = [
  (v: string): true | string => (!!v && v.length > 0) || 'Password is required',
];

const onSubmit = async (): Promise<void> => {
  if (!formRef.value) return;
  const { valid } = await formRef.value.validate();
  if (!valid) return;

  const ok = await auth.login(username.value.trim(), password.value);
  if (!ok) return;

  password.value = '';
  const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/';
  await router.replace(redirect);
};

const onDismissError = (): void => {
  auth.clearError();
};
</script>

<template>
  <v-row justify="center" align="center" class="ma-0 fill-height">
    <v-col cols="12" sm="8" md="6" lg="4" class="pa-0">
      <v-card class="pa-6" elevation="3">
        <div class="text-center mb-4">
          <v-avatar color="primary" size="72" class="mb-3">
            <v-icon size="44" color="white"> mdi-cube-outline </v-icon>
          </v-avatar>
          <h1 class="text-h5 font-weight-bold">Sign in</h1>
          <p class="text-body-2 text-medium-emphasis mt-1">Enter your credentials to continue.</p>
        </div>

        <v-alert
          v-if="auth.error"
          type="error"
          variant="tonal"
          class="mb-4"
          closable
          @click:close="onDismissError"
        >
          {{ auth.error }}
        </v-alert>

        <v-form ref="formRef" :disabled="auth.isLoading" @submit.prevent="onSubmit">
          <v-text-field
            v-model="username"
            label="Username"
            type="text"
            autocomplete="username"
            autocapitalize="none"
            spellcheck="false"
            :rules="usernameRules"
            prepend-inner-icon="mdi-account"
            required
            autofocus
          />

          <v-text-field
            v-model="password"
            label="Password"
            :type="showPassword ? 'text' : 'password'"
            autocomplete="current-password"
            :rules="passwordRules"
            prepend-inner-icon="mdi-lock"
            :append-inner-icon="showPassword ? 'mdi-eye-off' : 'mdi-eye'"
            required
            @click:append-inner="showPassword = !showPassword"
            @keyup.enter="onSubmit"
          />

          <v-btn
            type="submit"
            color="primary"
            size="large"
            block
            :loading="auth.isLoading"
            :disabled="auth.isLoading"
            class="mt-2"
          >
            Sign in
          </v-btn>
        </v-form>

        <p class="text-caption text-medium-emphasis text-center mt-4 mb-0">v{{ appVersion }}</p>
      </v-card>
    </v-col>
  </v-row>
</template>

<style scoped>
.fill-height {
  min-height: calc(100vh - 64px);
}
</style>
