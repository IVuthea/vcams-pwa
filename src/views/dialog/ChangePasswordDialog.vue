<script setup lang="ts">
import { reactive, ref, watch } from 'vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();

const props = defineProps<{ modelValue: boolean }>();
const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  success: [];
}>();

const form = reactive({
  old_password: '',
  new_password: '',
});
const showOld = ref(false);
const showNew = ref(false);
const submitting = ref(false);
const errorMsg = ref<string | null>(null);

const requiredRule = (v: string): true | string => !!v || 'This field is required.';
const minLengthRule = (v: string): true | string =>
  (v?.length ?? 0) >= 6 || 'Must be at least 6 characters.';

const reset = (): void => {
  form.old_password = '';
  form.new_password = '';
  showOld.value = false;
  showNew.value = false;
  errorMsg.value = null;
};

watch(
  () => props.modelValue,
  (open) => {
    if (open) reset();
  },
);

const onUpdate = (value: boolean): void => {
  emit('update:modelValue', value);
};

const onClose = (): void => {
  if (submitting.value) return;
  emit('update:modelValue', false);
};

const onSubmit = async (): Promise<void> => {
  errorMsg.value = null;
  if (!form.old_password || !form.new_password || form.new_password.length < 6) {
    return;
  }
  submitting.value = true;
  const err = await auth.changePassword(form.old_password, form.new_password);
  submitting.value = false;
  if (err) {
    errorMsg.value = err;
    return;
  }
  emit('success');
  emit('update:modelValue', false);
};
</script>

<template>
  <v-dialog
    :model-value="modelValue"
    max-width="440"
    persistent
    @update:model-value="onUpdate"
  >
    <v-card rounded="lg">
      <v-card-title class="d-flex align-center pa-4">
        <v-icon class="me-2" color="primary">mdi-lock-reset</v-icon>
        <span class="text-h6 font-weight-bold">Change password</span>
      </v-card-title>
      <v-divider />
      <v-form @submit.prevent="onSubmit">
        <v-card-text class="pa-4">
          <v-alert
            v-if="errorMsg"
            type="error"
            variant="tonal"
            class="mb-3"
            density="compact"
          >
            {{ errorMsg }}
          </v-alert>

          <v-text-field
            v-model="form.old_password"
            label="Current password"
            :type="showOld ? 'text' : 'password'"
            :append-inner-icon="showOld ? 'mdi-eye-off' : 'mdi-eye'"
            autocomplete="current-password"
            :disabled="submitting"
            :rules="[requiredRule]"
            required
            @click:append-inner="showOld = !showOld"
          />

          <v-text-field
            v-model="form.new_password"
            label="New password"
            :type="showNew ? 'text' : 'password'"
            :append-inner-icon="showNew ? 'mdi-eye-off' : 'mdi-eye'"
            autocomplete="new-password"
            :disabled="submitting"
            :rules="[requiredRule, minLengthRule]"
            required
            @click:append-inner="showNew = !showNew"
          />

        </v-card-text>
        <v-divider />
        <v-card-actions class="pa-3">
          <v-spacer />
          <v-btn variant="text" :disabled="submitting" @click="onClose">Cancel</v-btn>
          <v-btn
            color="primary"
            type="submit"
            :loading="submitting"
            :disabled="submitting"
          >
            Update
          </v-btn>
        </v-card-actions>
      </v-form>
    </v-card>
  </v-dialog>
</template>
