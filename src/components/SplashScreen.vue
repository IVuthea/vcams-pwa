<script setup lang="ts">
import { useTheme } from 'vuetify';

const theme = useTheme();

defineProps<{
  visible: boolean;
}>();
</script>

<template>
  <Transition name="splash-fade">
    <div
      v-if="visible"
      class="splash"
      :class="{ 'splash--dark': theme.global.current.value.dark }"
      role="status"
      aria-live="polite"
    >
      <div class="splash__inner">
        <div class="splash__logo">
          <v-icon
            size="72"
            color="white"
          >
            mdi-cube-outline
          </v-icon>
        </div>
        <h1 class="splash__title">
          Cube Scanner
        </h1>
        <p class="splash__welcome">
          Welcome — fast, offline-capable QR scanning.
        </p>
        <v-progress-circular
          indeterminate
          color="primary"
          size="32"
          width="3"
          class="mt-4"
        />
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.splash {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(160deg, rgb(var(--v-theme-primary)) 0%, rgb(var(--v-theme-secondary)) 100%);
  color: rgb(var(--v-theme-on-primary));
  padding: 24px;
  text-align: center;
}

.splash--dark {
  background: linear-gradient(160deg, rgb(var(--v-theme-surface)) 0%, rgb(var(--v-theme-primary)) 120%);
}

.splash__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  animation: splash-rise 480ms ease-out both;
}

.splash__logo {
  width: 112px;
  height: 112px;
  border-radius: 28px;
  background: rgba(255, 255, 255, 0.14);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
  margin-bottom: 8px;
}

.splash__title {
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  margin: 0;
}

.splash__welcome {
  font-size: 1rem;
  opacity: 0.9;
  max-width: 22rem;
  margin: 0;
}

.splash-fade-leave-active {
  transition: opacity 320ms ease;
}
.splash-fade-leave-to {
  opacity: 0;
}

@keyframes splash-rise {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
