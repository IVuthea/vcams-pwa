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

const email = ref('');
const password = ref('');
const showPassword = ref(false);
const formRef = ref<VForm | null>(null);

const emailRules = [
  (v: string): true | string => (!!v && v.trim().length > 0) || 'Email is required',
];

const passwordRules = [
  (v: string): true | string => (!!v && v.length > 0) || 'Password is required',
];

const onSubmit = async (): Promise<void> => {
  if (!formRef.value) return;
  const { valid } = await formRef.value.validate();
  if (!valid) return;

  const ok = await auth.login(email.value.trim(), password.value);
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
  <v-row
    justify="center"
    align="center"
    class="ma-0 fill-height"
  >
    <v-col
      cols="12"
      sm="8"
      md="6"
      lg="4"
      class="pa-0"
    >
      <v-card
        class="pa-6"
        elevation="3"
      >
        <div class="text-center mb-4">
          <v-avatar
            color="primary"
            size="72"
            class="mb-3"
          >
            <v-icon
              size="44"
              color="white"
            >
              mdi-cube-outline
            </v-icon>
          </v-avatar>
          <h1 class="text-h5 font-weight-bold">
            Sign in
          </h1>
          <p class="text-body-2 text-medium-emphasis mt-1">
            Enter your credentials to continue.
          </p>
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

        <v-form
          ref="formRef"
          :disabled="auth.isLoading"
          @submit.prevent="onSubmit"
        >
          <v-text-field
            v-model="email"
            label="Email"
            type="email"
            autocomplete="email"
            autocapitalize="none"
            spellcheck="false"
            :rules="emailRules"
            prepend-inner-icon="mdi-email"
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
      </v-card>
    </v-col>
  </v-row>
</template>

<style scoped>
.fill-height {
  min-height: calc(100vh - 64px);
}
</style>
