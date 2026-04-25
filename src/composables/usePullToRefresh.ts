import { onBeforeUnmount, onMounted, readonly, ref } from 'vue';
import type { Ref } from 'vue';

interface UsePullToRefreshOptions {
  // Pixels of pull required before a release fires onRefresh.
  threshold?: number;
  // Hard cap on how far the indicator can travel.
  maxDistance?: number;
  // Resistance factor: higher = harder to pull. 2.5 feels native.
  resistance?: number;
  // Disable when already refreshing or for any other reason.
  disabled?: () => boolean;
}

interface UsePullToRefreshReturn {
  pullDistance: Readonly<Ref<number>>;
  isPulling: Readonly<Ref<boolean>>;
  isRefreshing: Readonly<Ref<boolean>>;
  threshold: number;
}

// Touch-based pull-to-refresh. Only engages when the page is scrolled to the
// top — otherwise vertical swipes scroll the page as normal. The indicator
// position is exposed as `pullDistance` so the view can render whatever UI it
// wants (spinner, arrow, etc.).
export function usePullToRefresh(
  onRefresh: () => Promise<unknown> | unknown,
  options: UsePullToRefreshOptions = {},
): UsePullToRefreshReturn {
  const threshold = options.threshold ?? 70;
  const maxDistance = options.maxDistance ?? 120;
  const resistance = options.resistance ?? 2.5;
  const disabled = options.disabled ?? (() => false);

  const pullDistance = ref(0);
  const isPulling = ref(false);
  const isRefreshing = ref(false);

  let startY = 0;
  let tracking = false;

  const atTop = (): boolean => {
    const doc = document.scrollingElement ?? document.documentElement;
    return (window.scrollY || doc.scrollTop || 0) <= 0;
  };

  const onTouchStart = (e: TouchEvent): void => {
    if (isRefreshing.value || disabled()) return;
    if (e.touches.length !== 1) return;
    if (!atTop()) return;
    startY = e.touches[0].clientY;
    tracking = true;
    isPulling.value = false;
    pullDistance.value = 0;
  };

  const onTouchMove = (e: TouchEvent): void => {
    if (!tracking) return;
    const dy = e.touches[0].clientY - startY;
    if (dy <= 0) {
      // Pulling up — let the page scroll normally.
      isPulling.value = false;
      pullDistance.value = 0;
      return;
    }
    // Apply resistance for that "rubber band" feel.
    const resisted = Math.min(maxDistance, dy / resistance);
    pullDistance.value = resisted;
    isPulling.value = resisted > 0;
    // Prevent the browser's native overscroll once we're clearly pulling, so
    // the gesture can't bounce the whole page.
    if (resisted > 4 && e.cancelable) {
      e.preventDefault();
    }
  };

  const reset = (): void => {
    isPulling.value = false;
    pullDistance.value = 0;
  };

  const onTouchEnd = async (): Promise<void> => {
    if (!tracking) return;
    tracking = false;
    const shouldRefresh = pullDistance.value >= threshold && !isRefreshing.value && !disabled();
    if (!shouldRefresh) {
      reset();
      return;
    }
    isRefreshing.value = true;
    isPulling.value = false;
    pullDistance.value = threshold;
    try {
      await onRefresh();
    } finally {
      isRefreshing.value = false;
      pullDistance.value = 0;
    }
  };

  const onTouchCancel = (): void => {
    tracking = false;
    reset();
  };

  onMounted(() => {
    window.addEventListener('touchstart', onTouchStart, { passive: true });
    // Must be non-passive so preventDefault() can stop native overscroll.
    window.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: true });
    window.addEventListener('touchcancel', onTouchCancel, { passive: true });
  });

  onBeforeUnmount(() => {
    window.removeEventListener('touchstart', onTouchStart);
    window.removeEventListener('touchmove', onTouchMove);
    window.removeEventListener('touchend', onTouchEnd);
    window.removeEventListener('touchcancel', onTouchCancel);
  });

  return {
    pullDistance: readonly(pullDistance),
    isPulling: readonly(isPulling),
    isRefreshing: readonly(isRefreshing),
    threshold,
  };
}
