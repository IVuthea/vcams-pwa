# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Vite dev server on :5173 (host=true, exposes on LAN)
npm run dev:android      # adb reverse tcp:5173 + vite — open http://localhost:5173 on a USB-connected phone
npm run build            # vue-tsc --noEmit && vite build  (TS errors fail the build)
npm run preview          # Serve dist/ on :4173 with --host
npm run type-check       # vue-tsc --noEmit only
npm run lint             # eslint .vue/.ts/.js (run with -- --fix to auto-format)
npm run format           # prettier write over src/**
npm run generate:icons   # node scripts/generate-icons.mjs — re-run after replacing src/assets/app-icon.png
```

`dev:android` (in `scripts/dev-android.mjs`) checks adb is on PATH, verifies exactly one device is in `device` state, runs `adb reverse tcp:5173 tcp:5173`, spawns Vite, and removes the port mapping on exit. The phone-side URL is `http://localhost:5173`, which counts as a secure context — so camera + HMR both work without HTTPS or tunnels.

There are no tests in this project — the build (`vue-tsc` + Vite) is the primary correctness gate.

## Architecture

### PWA update flow (three files cooperate)

1. `vite.config.ts` configures `vite-plugin-pwa` in `generateSW` / `autoUpdate` mode with explicit Workbox `runtimeCaching` rules (CacheFirst for fonts/images, StaleWhileRevalidate for same-origin `/api/` GETs, NetworkFirst with 3s timeout for navigations).
2. `src/registerSW.ts` calls `registerSW()` from `virtual:pwa-register` and exposes two reactive refs (`updateAvailable`, `offlineReady`) plus `applyUpdate()` / `dismissOfflineReady()` helpers. **It does not render UI** — it just owns the state and the `updateSW` handle.
3. `src/App.vue` calls `initServiceWorker()` in `onMounted` and binds the refs to two `<v-snackbar>`s. Adding new SW lifecycle UI means editing App.vue, not registerSW.ts.

The manifest's icons must stay in sync with `public/icons/` — both are wired through `vite.config.ts`. Use the icon script rather than hand-editing.

### Scanner (the load-bearing part of the app)

The QR scanner is split deliberately:

- `src/composables/useQrScanner.ts` owns the `QrScanner` instance, the `MediaStream`, all camera/torch state, and a typed surface (`start`, `stop`, `toggleTorch`, `switchCamera`, plus reactive `videoRef`, `isScanning`, `hasTorch`, `torchOn`, `cameras`, `error`). It has no Vuetify dependency.
- `src/views/ScannerView.vue` consumes the composable, renders the viewfinder + controls, persists scans to IndexedDB, and handles UX (vibration, snackbars, duplicate throttling within 2s).

**Invariants the composable enforces — preserve these when editing:**

- **Secure context gate.** `start()` early-returns with a friendly error unless `window.isSecureContext || hostname === 'localhost'`. Camera APIs silently fail otherwise. Don't bypass this.
- **Track release on stop.** `stop()` calls both `scanner.destroy()` *and* iterates `videoRef.value.srcObject.getTracks()` to call `track.stop()`, then nulls `srcObject`. `qr-scanner`'s own teardown is not always sufficient to turn off the device camera indicator; hence the explicit track stop. `stop()` also detaches the `track.ended` listener registered during `start()`.
- **Torch capability is checked after `start()`**, via `scanner.hasFlash()` (which reads `MediaStreamTrack.getCapabilities().torch`). It must be re-checked on `switchCamera()` because front cameras typically lack torch. `hasTorch` is reset to `false` whenever the stream is torn down.
- **`ScannerView.vue` calls `stop()` in `onBeforeUnmount`** — leaving the route must release the camera. Verify this still holds after any refactor.
- **Camera enumeration runs only after `start()` resolves**, because `enumerateDevices()` returns blank labels until the user grants camera permission. The `<v-select>` for switching cameras is bound to the post-permission list.
- **OverconstrainedError fallback.** If `preferredCamera: 'environment'` fails (front-only laptops, some iPads), `start()` retries once with `'user'` before surfacing the error. Keep this fallback when adding new constraints.
- **`track.ended` listener.** `start()` attaches an `ended` handler to the active video track and surfaces a retry-friendly error if the camera is taken by another app/tab. `switchCamera()` re-attaches it for the new track.

### iOS / Android cross-platform handling

Several parts of the scanner exist specifically because of iOS Safari quirks — don't simplify them away:

- **Auto-start with manual fallback.** `ScannerView.vue` calls `start()` on mount, but iOS Safari (especially in PWA standalone mode) sometimes requires `getUserMedia` to be invoked from a user gesture. When `start()` fails, the viewfinder shows a clickable overlay ("Tap to enable camera") and the controls row shows an "Enable camera" / "Try again" button — both routes go through `onEnableCamera()`, which is a real user-gesture click handler.
- **Visibility lifecycle.** A `visibilitychange` listener stops the scanner when the tab is hidden (releases the camera) and auto-resumes only if it was running before. This avoids zombie streams that iOS Safari can leave behind on tab switch.
- **Video element attributes.** The `<video>` carries `muted`, `playsinline`, `autoplay`, `webkit-playsinline="true"`, and `disablepictureinpicture`. Without `playsinline` iOS goes fullscreen; without `muted` iOS blocks autoplay; `webkit-playsinline` covers older iOS WebViews; `disablepictureinpicture` keeps iOS from offering a PiP button on the video.
- **Error mapping.** `describeMediaError()` switches on `DOMException.name` (`NotAllowedError`, `NotReadableError`, `OverconstrainedError`, `SecurityError`, `AbortError`, `NotFoundError`) rather than regex-matching messages. Browser locales translate the message; the name is stable.
- **Permission state.** `useQrScanner.ts` exposes a `permissionState` ref and tries `navigator.permissions.query({ name: 'camera' })` when supported (Chrome, recent Safari). Firefox and some Safari builds reject the query; the code swallows that and leaves `permissionState` at `'unknown'` — the rest of the UI doesn't depend on it being filled in.
- **`navigator.vibrate`** is a no-op on iOS Safari. The decode handler guards with `typeof navigator.vibrate === 'function'` and a try/catch, so this is harmless.
- **Torch is unsupported on iOS Safari at any version** (WebKit doesn't expose the capability). The UI degrades to a disabled button with a tonal alert — don't try to "fix" this with polyfills.
- **In-app browsers (Instagram, Facebook, etc.) on iOS** use a WKWebView that often blocks camera access. The "Camera not available" branch in `ScannerView.vue` covers that case with a "open in Safari" hint.

### Data layer

- `src/db/index.ts` — `idb` v1 schema, single `scans` object store (autoincrement `id`, indexes on `createdAt` and `value`). All four helpers (`addScan`, `listScans`, `deleteScan`, `clearScans`) **swallow errors and log them**; they never throw to callers. UI code can `await` them without try/catch and assumes a "best effort" contract. To add a store, bump `DB_VERSION` and extend the `upgrade` callback — don't recreate `dbPromise`.
- `src/http/axios.ts` — single Axios instance, `baseURL` from `import.meta.env.VITE_API_BASE_URL` (omitted entirely if empty). The request interceptor short-circuits with a typed `OfflineError` when `navigator.onLine === false`, *before* the request is sent. The response interceptor normalizes everything into `{ status, message, data, isOffline? }`. Callers see the normalized shape on rejection — not raw AxiosErrors. There are currently no API consumers in the app; this is scaffolding.

### Theme & layout

- `src/plugins/vuetify.ts` defines both `light` and `dark` themes derived from the cube icon's blues. `defaultTheme` is set from `prefers-color-scheme` at module load; the toggle in `AppLayout.vue` flips `theme.global.name.value`.
- `AppLayout.vue` shows the `<v-bottom-navigation>` only on `useDisplay().smAndDown` — desktop hides it. The online/offline `<v-chip>` is driven by `useOnline()`, which is just a `ref<boolean>` listening to window `online`/`offline` events.

### Icon pipeline

`src/assets/app-icon.png` is the single source. `scripts/generate-icons.mjs` uses `sharp` to emit:

- 8 `purpose: any` PNGs (72/96/128/144/152/192/384/512) into `public/icons/`,
- 2 `purpose: maskable` PNGs (192, 512) — the script pads the source to a ~70% safe zone before centering it on a white canvas, which is required for Android adaptive icons,
- `public/favicon.ico` (a 32×32 PNG written under the .ico filename — accepted by all modern browsers).

The sizes here are mirrored in the `manifest.icons` array in `vite.config.ts`. Adding/removing a size means editing both.

### TypeScript setup

`tsconfig.json` covers `src/**` only. `vite.config.ts` and `scripts/**/*.mjs` belong to `tsconfig.node.json` (referenced from the root). Including `vite.config.ts` in both produces a `TS6305` error — keep them separate. The path alias `@/*` → `src/*` is defined in both `tsconfig.json` and `vite.config.ts`; both must be updated together.

## Caveats inherited from README

- The app **must be served over HTTPS or `localhost`** for camera + service worker. For phone testing on the LAN, use an HTTPS tunnel (ngrok / Cloudflare Tunnel) — plain `http://<lan-ip>` will refuse camera access.
- Replacing the app icon: drop a square PNG (≥512×512 recommended) at `src/assets/app-icon.png`, then `npm run generate:icons`.
