# MEP

An installable Progressive Web App (PWA) for MEP attendance tracking via QR-based check-in, with a torch (flashlight) toggle, built with Vue 3, Vuetify 3, TypeScript, and Vite. Works offline after first load and persists scan history in IndexedDB.

## Features

- Mobile-first Material Design 3 UI (Vuetify 3, light + dark themes derived from the cube icon).
- Live camera QR scanning via [`qr-scanner`](https://github.com/nimiq/qr-scanner) (uses `getUserMedia`, defaults to the rear camera).
- Torch on/off toggle when the device exposes `MediaStreamTrack.getCapabilities().torch`.
- Camera switcher when multiple cameras are detected.
- IndexedDB-backed scan history (last 10) using `idb`, with delete + clear-all.
- Offline support via `vite-plugin-pwa` + Workbox (auto-update SW with reload prompt).
- Online/offline indicator chip in the app bar; vibration feedback on successful scans.
- Axios HTTP client with `OfflineError` short-circuit and normalized error shape.

## Prerequisites

- **Node.js >= 20**
- npm 10+ (bundled with Node 20+)

## Install & run

```bash
npm install
npm run generate:icons   # builds public/icons from src/assets/app-icon.png (run once)
npm run dev              # http://localhost:5173
```

For a production build:

```bash
npm run build
npm run preview          # serves the built app on http://localhost:4173
```

`npm run build` runs `vue-tsc --noEmit` first, so the build will fail on type errors.

## Scripts

| Script                   | Purpose                                            |
| ------------------------ | -------------------------------------------------- |
| `npm run dev`            | Start the Vite dev server                          |
| `npm run dev:android`    | `adb reverse` + Vite for hot reload on a USB phone |
| `npm run build`          | Type-check then produce a production build         |
| `npm run preview`        | Serve the production build locally                 |
| `npm run lint`           | ESLint over `.vue/.ts/.js`                         |
| `npm run format`         | Prettier write over `src/**`                       |
| `npm run type-check`     | `vue-tsc --noEmit`                                 |
| `npm run generate:icons` | Regenerate PWA icons from `src/assets/app-icon.png`|

## Environment

Copy `.env.example` to `.env` and set values as needed:

```
VITE_API_BASE_URL=
```

When `VITE_API_BASE_URL` is empty, the Axios instance has no `baseURL`.

## Regenerating icons

The app icon source lives at `src/assets/app-icon.png` (a blue isometric cube). The icon generator uses `sharp` to emit:

- `public/icons/icon-{72,96,128,144,152,192,384,512}.png` (`purpose: any`)
- `public/icons/maskable-{192,512}.png` (`purpose: maskable`, ~70% safe zone)
- `public/favicon.ico` (PNG content, accepted by all modern browsers)

Replace `src/assets/app-icon.png` with a 1024×1024 source PNG and rerun `npm run generate:icons`.

## Testing PWA install on mobile

The app must be served over **HTTPS** (or `http://localhost`) for the camera and the service worker to work.

### Android via USB (recommended for development)

If you have `adb` (Android platform-tools) installed and USB debugging enabled on the phone:

```bash
npm run dev:android
# then open http://localhost:5173 in Chrome on the phone
```

This script runs `adb reverse tcp:5173 tcp:5173` so the phone's `localhost:5173` tunnels back to your laptop. Because the phone sees the page as `localhost`, it counts as a **secure context** — no HTTPS, no tunnels, and Vite's HMR works as if you were on the laptop. The port forward is removed automatically when you stop the server.

The mapping is reset whenever the phone is unplugged or `adb` restarts; just re-run `npm run dev:android` after replugging.

### LAN / iOS testing

For iOS or anything that needs HTTPS on a real network address:

```bash
npm run build
npm run preview -- --host
# then open https://<your-ip>:4173 from the phone
```

If you need HTTPS on the LAN, use a tunnel such as [ngrok](https://ngrok.com/) or [Cloudflare Tunnel](https://www.cloudflare.com/products/tunnel/) and point your phone at the tunnel URL. On Chrome Android you can then use *Add to Home Screen* / *Install app*.

## Torch / flashlight notes

The torch button is wired to `MediaStreamTrack.getCapabilities().torch`. Support depends on the platform:

- **Chrome on Android (rear camera):** works.
- **iOS Safari (any version):** **not supported** — Safari does not expose the `torch` capability. The torch button stays disabled with an explanation.
- **Front cameras / webcams:** typically have no torch hardware.
- **Some Chromium-on-iOS variants** inherit Safari's WebKit, so the same limitation applies.

The UI gracefully degrades: when `hasFlash()` returns `false`, the torch button is disabled and a tonal alert explains why.

## Acceptance checklist

- `npm install && npm run dev` starts on `localhost:5173`.
- `npm run build && npm run preview` produces a working production build.
- Lighthouse PWA audit passes (installable, offline-capable).
- Camera turns on when the scanner screen mounts; torch toggles where supported.
- Leaving the scanner stops all media tracks (indicator light off).
- App still loads and scan history persists offline.

## Project layout

```
src/
├─ assets/app-icon.png        # Source app icon
├─ components/AppLayout.vue   # v-app shell, app bar, bottom nav, theme + online chip
├─ composables/
│  ├─ useOnline.ts            # ref<boolean> tracking navigator.onLine
│  └─ useQrScanner.ts         # qr-scanner wrapper: stream + torch + camera switching
├─ db/index.ts                # idb schema + addScan/listScans/deleteScan/clearScans
├─ http/axios.ts              # axios instance, OfflineError, normalized errors
├─ plugins/vuetify.ts         # createVuetify with light/dark MD3 theme + MDI
├─ router/index.ts
├─ views/HomeView.vue
├─ views/ScannerView.vue      # camera, torch, history, error states
├─ App.vue
├─ main.ts
└─ registerSW.ts              # PWA update + offline-ready toasts
```
