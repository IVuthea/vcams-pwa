<script setup lang="ts">
import { computed } from 'vue';
import { usePullToRefresh } from '@/composables/usePullToRefresh';

interface Props {
  // Called when the user pulls past the threshold and releases.
  // Return a Promise — the spinner stays visible until it resolves.
  onRefresh: () => Promise<unknown> | unknown;
  // Block the gesture (e.g. while another loading state is active).
  disabled?: boolean;
  // Override the default 70px threshold if you need a longer/shorter pull.
  threshold?: number;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  threshold: 70,
});

const { pullDistance, isPulling, isRefreshing, threshold } = usePullToRefresh(
  () => props.onRefresh(),
  {
    threshold: props.threshold,
    disabled: () => props.disabled,
  },
);

const indicatorStyle = computed(() => {
  const visible = isPulling.value || isRefreshing.value;
  const translate = Math.max(0, pullDistance.value - 24);
  return {
    transform: `translateY(${translate}px)`,
    opacity: visible ? 1 : 0,
  };
});

const indicatorRotation = computed(() => {
  const ratio = Math.min(1, pullDistance.value / threshold);
  return `rotate(${Math.round(ratio * 360)}deg)`;
});

const readyToRelease = computed(() => pullDistance.value >= threshold);
</script>

<template>
  <div class="ptr">
    <div class="ptr__indicator">
      <div
        class="ptr__dot"
        :style="indicatorStyle"
      >
        <slot
          name="indicator"
          :is-refreshing="isRefreshing"
          :is-pulling="isPulling"
          :ready="readyToRelease"
          :pull-distance="pullDistance"
        >
          <v-progress-circular
            v-if="isRefreshing"
            indeterminate
            size="24"
            width="3"
            color="primary"
          />
          <v-icon
            v-else
            :class="['ptr__icon', { 'ptr__icon--ready': readyToRelease }]"
            :style="{ transform: indicatorRotation }"
            color="primary"
          >
            mdi-arrow-down
          </v-icon>
        </slot>
      </div>
    </div>

    <slot />
  </div>
</template>

<style scoped>
.ptr {
  position: relative;
}
.ptr__indicator {
  position: relative;
  height: 0;
  pointer-events: none;
}
.ptr__dot {
  position: absolute;
  top: -56px;
  left: 50%;
  margin-left: -20px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgb(var(--v-theme-surface));
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 180ms ease, transform 180ms ease;
  will-change: transform, opacity;
  z-index: 1;
}
.ptr__icon {
  transition: transform 120ms ease, color 120ms ease;
}
.ptr__icon--ready {
  color: rgb(var(--v-theme-success));
}
</style>
