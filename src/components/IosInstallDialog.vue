<script setup lang="ts">
const model = defineModel<boolean>({ required: true });
</script>

<template>
  <v-dialog v-model="model" max-width="380">
    <v-card rounded="lg">
      <v-card-title class="text-h6 d-flex align-center">
        <v-icon class="mr-2" color="primary">mdi-cellphone-arrow-down</v-icon>
        Install MEP
      </v-card-title>

      <v-card-text class="pb-2">
        <p class="text-body-2 mb-4">
          Add MEP to your Home Screen for a full-screen, app-like experience and offline access.
        </p>

        <ol class="ios-steps">
          <li class="d-flex align-center">
            <span class="step-num">1</span>
            <span class="text-body-2">
              Tap the <strong>Share</strong> button
              <v-icon size="18" class="mx-1" color="primary">mdi-export-variant</v-icon>
              in Safari's toolbar.
            </span>
          </li>
          <li class="d-flex align-center">
            <span class="step-num">2</span>
            <span class="text-body-2">
              Choose <strong>Add to Home Screen</strong>
              <v-icon size="18" class="mx-1">mdi-plus-box-outline</v-icon>.
            </span>
          </li>
          <li class="d-flex align-center">
            <span class="step-num">3</span>
            <span class="text-body-2">
              Tap <strong>Add</strong> in the top-right corner.
            </span>
          </li>
        </ol>
      </v-card-text>

      <v-card-actions>
        <v-spacer />
        <v-btn variant="text" @click="model = false">Got it</v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.ios-steps {
  list-style: none;
  padding: 0;
  margin: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.step-num {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: rgb(var(--v-theme-primary));
  color: rgb(var(--v-theme-on-primary));
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 600;
  margin-right: 12px;
}
</style>
