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

`dev:android` ([scripts/dev-android.mjs](scripts/dev-android.mjs)) checks adb is on PATH, verifies exactly one device is in `device` state, runs `adb reverse tcp:5173 tcp:5173`, spawns Vite, and removes the port mapping on exit. The phone-side URL is `http://localhost:5173`, which counts as a secure context — so camera + HMR both work without HTTPS or tunnels.

There are no tests in this project — the build (`vue-tsc` + Vite) is the primary correctness gate.

## What this app actually does

Despite the package name `cube-scanner` and the `Cube Scanner` PWA manifest, the app shipping today is an **attendance tracking PWA for MEP** (the app bar reads "MEP"). The core flow:

1. User logs in with email + password against `/auth/login` ([LoginView.vue](src/views/LoginView.vue) → [stores/auth.ts](src/stores/auth.ts)).
2. They pick a project ([ProjectsView.vue](src/views/ProjectsView.vue) → `GET /project`).
3. On the project detail page ([AttendanceView.vue](src/views/AttendanceView.vue)) they pick a period (morning/afternoon/OT × in/out) and open the scanner.
4. The scanner ([AttendanceScanView.vue](src/views/AttendanceScanView.vue)) decodes employee QRs (JSON `{id, name}`), persists each scan to IndexedDB, and lets the user batch-submit them to `POST attendance/single`.

Everything else (employee directory, profile, dark mode, offline) supports that flow.

## Architecture

### Auth + axios bridge (the non-obvious part)

[src/http/axios.ts](src/http/axios.ts) and [src/stores/auth.ts](src/stores/auth.ts) need to know about each other — the request interceptor must read the current token, and a 401 response must trigger logout + router redirect. To avoid a circular import, axios.ts exposes **late-bound hooks**:

```ts
// axios.ts owns these slots, defaulting to no-ops.
let hooks: AuthHooks = { getToken: () => null, onUnauthorized: () => {} };
export function configureAuthHooks(next: AuthHooks): void { hooks = next; }
```

[src/main.ts](src/main.ts) wires them up **after** `app.use(pinia)` so `useAuthStore()` is callable, then **awaits `auth.restore()` before `app.mount()`** inside an async IIFE. The restore-before-mount step is load-bearing: the router's `beforeEach` guard checks `auth.isAuthenticated` on first navigation, and without restore the user would bounce to `/login` even with a valid stored token.

When you add another module that needs auth state, follow this pattern instead of importing the store directly into low-level infra. The async IIFE (rather than top-level await) is intentional — keeps the bundle on the `es2020` build target.

### Routing

[src/router/index.ts](src/router/index.ts) uses a single `beforeEach` guard: every route is protected unless it has `meta.public === true` (only `/login` does). Unauthenticated requests redirect to `/login` with `?redirect=<path>`. Authenticated visits to `/login` redirect to `/projects`.

`meta.fullscreen: true` (currently only on `projects.attendance-scan-qr`) tells [AppLayout.vue](src/components/AppLayout.vue) to hide the app bar, the `<v-container>` padding wrapper, **and** the bottom nav — the scanner view paints edge-to-edge over black. Add this flag to any route that needs to take over the viewport.

### State (Pinia)

Five stores in [src/stores/](src/stores/), each `defineStore` with the setup-function form:

- `auth` — token, user, login/logout, `restore()` reads from IndexedDB, `fetchCurrentUser()` validates token via `GET /auth/user`.
- `projects` — list from `GET /project`, response shape is `data.data.projects.data` (deeply nested — keep this in mind when adding endpoints).
- `attendance` — the most logic-heavy store. Owns `selectedPeriod`, the per-project scan list, and `submitAllScans()` (see below).
- `employees`, `profile` — straightforward fetch stores.

**`submitAllScans()` invariants** ([attendance.ts:165](src/stores/attendance.ts#L165)):
- Sorts scans by `PERIOD_ORDER` (p1_in → p1_out → p2_in → … → p3_out) so the user watches periods light up in shift order.
- Each scan is wrapped in **its own try/catch**. A failure never aborts the batch — failed scans get `submitErrorMsg` persisted on the record (via `setAttendanceScanError`), the loop moves on.
- A `SUBMIT_STEP_DELAY_MS = 400` pause sits between iterations so the per-row spinner is actually visible. Don't remove it without replacing the UI feedback.
- `submittingScanId` (in-flight) and `submittingPeriod` (derived) drive the row spinner and the period button highlight respectively. They're distinct from `selectedPeriod`, which is the user's view selection.

### Data layer (IndexedDB)

[src/db/index.ts](src/db/index.ts) — `idb` v8, **DB version 3**, three stores:

| Store | Key | Purpose |
| --- | --- | --- |
| `scans` | autoincrement id | Legacy generic scan history (v1). Still wired but unused by the new flow. |
| `auth` | string `'current'` | Single-row store for the persisted session (`{ token, user }`). |
| `attendance_scans` | autoincrement id | Per-employee scans with `period`, `projectId`, `submitErrorMsg`. Compound index `projectId_createdAt` lets `listAttendanceScans` page newest-first per project without JS filtering. |

When extending the schema, **bump `DB_VERSION` and add a new `if (oldVersion < N)` block** — never rebuild `dbPromise`. All helpers swallow errors and log them; UI code can `await` without try/catch and assume best-effort.

**`setStoredAuth` JSON-roundtrips its input** ([db/index.ts:167](src/db/index.ts#L167)) to strip Vue reactive Proxies, functions, and `undefined` values before `db.put`. Without this, structured clone throws `DataCloneError` on Pinia state. Preserve this when storing other reactive objects.

### QR payload contract

Employee QRs are **`{"id": number, "name": string}` JSON** — `parseEmployeePayload` ([attendance.ts:49](src/stores/attendance.ts#L49)) rejects anything else. If a generic-QR feature comes back, give it its own decode path; don't loosen this parser.

### PWA update flow (three files cooperate)

1. [vite.config.ts](vite.config.ts) configures `vite-plugin-pwa` in `generateSW` / `autoUpdate` mode with explicit Workbox `runtimeCaching` rules (CacheFirst for fonts/images, StaleWhileRevalidate for same-origin `/api/` GETs, NetworkFirst with 3s timeout for navigations).
2. [src/registerSW.ts](src/registerSW.ts) calls `registerSW()` from `virtual:pwa-register` and exposes two reactive refs (`updateAvailable`, `offlineReady`) plus `applyUpdate()` / `dismissOfflineReady()` helpers. **It does not render UI** — it just owns the state and the `updateSW` handle.
3. [src/App.vue](src/App.vue) calls `initServiceWorker()` in `onMounted` and binds the refs to two `<v-snackbar>`s. Adding new SW lifecycle UI means editing App.vue, not registerSW.ts.

The manifest's icons must stay in sync with [public/icons/](public/icons/) — both are wired through `vite.config.ts`. Use the icon script rather than hand-editing.

### Scanner (the load-bearing camera code)

The scanner is split deliberately:

- [src/composables/useQrScanner.ts](src/composables/useQrScanner.ts) owns the `QrScanner` instance, the `MediaStream`, all camera/torch state, and a typed surface (`start`, `stop`, `toggleTorch`, `switchCamera`, plus reactive `videoRef`, `isScanning`, `hasTorch`, `torchOn`, `cameras`, `permissionState`, `error`). It has no Vuetify dependency.
- [src/views/AttendanceScanView.vue](src/views/AttendanceScanView.vue) consumes it, renders the viewfinder + reticle + confirmation card, hands decoded values to the attendance store, and handles UX (vibration, pending-confirmation gate, duplicate throttling within 2s).

**Invariants the composable enforces — preserve these when editing:**

- **Secure context gate.** `start()` early-returns with a friendly error unless `window.isSecureContext || hostname === 'localhost'`. Camera APIs silently fail otherwise. Don't bypass this.
- **Track release on stop.** `stop()` calls both `scanner.destroy()` *and* iterates `videoRef.value.srcObject.getTracks()` to call `track.stop()`, then nulls `srcObject`. `qr-scanner`'s own teardown is not always sufficient to turn off the device camera indicator; hence the explicit track stop. `stop()` also detaches the `track.ended` listener registered during `start()`.
- **Torch capability is checked after `start()`**, via `scanner.hasFlash()` (which reads `MediaStreamTrack.getCapabilities().torch`). It must be re-checked on `switchCamera()` because front cameras typically lack torch. `hasTorch` is reset to `false` whenever the stream is torn down.
- **`AttendanceScanView.vue` calls `stop()` in `onBeforeUnmount`** — leaving the route must release the camera. Verify this still holds after any refactor.
- **Camera enumeration runs only after `start()` resolves**, because `enumerateDevices()` returns blank labels until the user grants camera permission.
- **OverconstrainedError fallback.** If `preferredCamera: 'environment'` fails (front-only laptops, some iPads), `start()` retries once with `'user'` before surfacing the error. Keep this fallback when adding new constraints.
- **`track.ended` listener.** `start()` attaches an `ended` handler to the active video track and surfaces a retry-friendly error if the camera is taken by another app/tab. `switchCamera()` re-attaches it for the new track.
- **Custom `calculateScanRegion`.** The scan region is centered to match the CSS reticle (`min(70vw, 70vh, 320px)`) at 90% of its size. The conversion goes CSS px → video px via the same `object-fit: cover` scale the browser uses — otherwise the bracket can render outside the visible frame in landscape-camera-in-portrait-viewport setups. If you change the reticle size, update both the CSS variable in [AttendanceScanView.vue](src/views/AttendanceScanView.vue) and the calculation in the composable.

### iOS / Android cross-platform handling

Several parts of the scanner exist specifically because of iOS Safari quirks — don't simplify them away:

- **Auto-start with manual fallback.** `AttendanceScanView.vue` calls `start()` on mount, but iOS Safari (especially in PWA standalone mode) sometimes requires `getUserMedia` to be invoked from a user gesture. When `start()` fails, the viewfinder shows a clickable overlay ("Tap to enable camera") and the controls row shows an "Enable camera" / "Try again" button — both routes go through `onEnableCamera()`, which is a real user-gesture click handler.
- **Visibility lifecycle.** A `visibilitychange` listener stops the scanner when the tab is hidden (releases the camera) and auto-resumes only if it was running before. This avoids zombie streams that iOS Safari can leave behind on tab switch.
- **Video element attributes.** The `<video>` carries `muted`, `playsinline`, `autoplay`, `webkit-playsinline="true"`, and `disablepictureinpicture`. Without `playsinline` iOS goes fullscreen; without `muted` iOS blocks autoplay; `webkit-playsinline` covers older iOS WebViews; `disablepictureinpicture` keeps iOS from offering a PiP button on the video.
- **Error mapping.** `describeMediaError()` switches on `DOMException.name` (`NotAllowedError`, `NotReadableError`, `OverconstrainedError`, `SecurityError`, `AbortError`, `NotFoundError`) rather than regex-matching messages. Browser locales translate the message; the name is stable.
- **Permission state.** `useQrScanner.ts` exposes a `permissionState` ref and tries `navigator.permissions.query({ name: 'camera' })` when supported (Chrome, recent Safari). Firefox and some Safari builds reject the query; the code swallows that and leaves `permissionState` at `'unknown'` — the rest of the UI doesn't depend on it being filled in.
- **`navigator.vibrate`** is a no-op on iOS Safari. The decode handler guards with `typeof navigator.vibrate === 'function'` and a try/catch, so this is harmless.
- **Torch is unsupported on iOS Safari at any version** (WebKit doesn't expose the capability). The UI degrades to a disabled button — don't try to "fix" this with polyfills.
- **In-app browsers (Instagram, Facebook, etc.) on iOS** use a WKWebView that often blocks camera access. The "Camera not available" branch covers that case.

### HTTP layer

[src/http/axios.ts](src/http/axios.ts) — single Axios instance, `baseURL` from `import.meta.env.VITE_API_BASE_URL` (omitted entirely if empty). Two interceptors:

- **Request:** short-circuits with a typed `OfflineError` when `navigator.onLine === false`, **before** the request is sent. Otherwise attaches `Authorization: Bearer <token>` if `hooks.getToken()` returns one.
- **Response:** normalizes everything (network errors, HTTP errors, OfflineError) into `{ status, message, data, isOffline? }`. **Callers see this normalized shape on rejection — not raw AxiosErrors.** The `isNormalizedError` typeguard appears in multiple stores; copy that pattern when adding new ones.

A 401 response calls `hooks.onUnauthorized()` (wired in main.ts to `auth.logout()` + `router.replace({ name: 'login' })`) before rejecting, so the redirect happens once even if multiple in-flight requests fail at the same time.

### Theme

[src/plugins/vuetify.ts](src/plugins/vuetify.ts) reads the persisted theme from [src/utils/themeStorage.ts](src/utils/themeStorage.ts) **at module load** and falls back to `prefers-color-scheme`. Theme storage uses **localStorage, not IndexedDB**, because the read is synchronous and runs before first paint — IDB would cause a flash of the wrong theme. AppLayout's toggle calls both `theme.change()` and `writeStoredTheme()`. Both light and dark palettes are derived from the cube icon's blues; Vuetify defaults set `VBtn.variant='flat'`, `VCard.rounded='lg'`, and outlined-comfortable text fields globally — match those defaults instead of overriding per call site.

### Pull-to-refresh

[src/composables/usePullToRefresh.ts](src/composables/usePullToRefresh.ts) is a touch-gesture composable used by list views. It only engages when the page is at scroll-top and uses **non-passive** `touchmove` so it can `preventDefault()` to stop native overscroll bouncing. The threshold/resistance defaults (70px / 2.5×) are tuned to feel native on Android Chrome; change with care.

### Icon pipeline

[src/assets/app-icon.png](src/assets/app-icon.png) is the single source. [scripts/generate-icons.mjs](scripts/generate-icons.mjs) uses `sharp` to emit:

- 8 `purpose: any` PNGs (72/96/128/144/152/192/384/512) into `public/icons/`,
- 2 `purpose: maskable` PNGs (192, 512) — the script pads the source to a ~70% safe zone before centering it on a white canvas, which is required for Android adaptive icons,
- `public/favicon.ico` (a 32×32 PNG written under the .ico filename — accepted by all modern browsers).

The sizes here are mirrored in the `manifest.icons` array in `vite.config.ts`. Adding/removing a size means editing both.

### TypeScript setup

[tsconfig.json](tsconfig.json) covers `src/**` only. `vite.config.ts` and `scripts/**/*.mjs` belong to [tsconfig.node.json](tsconfig.node.json) (referenced from the root). Including `vite.config.ts` in both produces a `TS6305` error — keep them separate. The path alias `@/*` → `src/*` is defined in both `tsconfig.json` and `vite.config.ts`; both must be updated together.

## Caveats inherited from README

- The app **must be served over HTTPS or `localhost`** for camera + service worker. For phone testing on the LAN, use an HTTPS tunnel (ngrok / Cloudflare Tunnel) — plain `http://<lan-ip>` will refuse camera access.
- Replacing the app icon: drop a square PNG (≥512×512 recommended) at `src/assets/app-icon.png`, then `npm run generate:icons`.
