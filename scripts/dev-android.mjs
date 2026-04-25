#!/usr/bin/env node
import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PORT = 5173;
const here = dirname(fileURLToPath(import.meta.url));
const isWin = process.platform === 'win32';
const viteBin = resolve(here, '..', 'node_modules', '.bin', isWin ? 'vite.cmd' : 'vite');

function fail(msg) {
  console.error(`\n  ✖ ${msg}\n`);
  process.exit(1);
}

const adbVersion = spawnSync('adb', ['version'], { encoding: 'utf8' });
if (adbVersion.error || adbVersion.status !== 0) {
  fail(
    'adb is not on PATH. Install Android platform-tools: https://developer.android.com/tools/releases/platform-tools',
  );
}

const devices = spawnSync('adb', ['devices'], { encoding: 'utf8' });
if (devices.status !== 0) {
  fail(`"adb devices" failed: ${devices.stderr || devices.stdout || 'unknown error'}`);
}

const lines = (devices.stdout || '').trim().split('\n').slice(1).filter(Boolean);
const ready = lines.filter((l) => /\tdevice\b/.test(l));
const unauthorized = lines.filter((l) => /\tunauthorized\b/.test(l));

if (ready.length === 0) {
  if (unauthorized.length) {
    fail(
      'Phone is connected but unauthorized. Accept the USB debugging prompt on the device, then re-run.',
    );
  }
  fail(
    'No Android device detected. Plug in a phone with USB debugging enabled — "adb devices" should list it as "device".',
  );
}

if (ready.length > 1) {
  console.warn(
    `\n  ⚠ ${ready.length} devices connected. "adb reverse" will refuse to choose one — disconnect extras or run it manually with -s <serial>.\n`,
  );
}

console.log(`> adb reverse tcp:${PORT} tcp:${PORT}`);
const reverse = spawnSync('adb', ['reverse', `tcp:${PORT}`, `tcp:${PORT}`], {
  stdio: 'inherit',
});
if (reverse.status !== 0) {
  process.exit(reverse.status ?? 1);
}

console.log(`
  ▶ On the phone, open Chrome and visit:
      http://localhost:${PORT}

  ▶ HMR and camera (localhost = secure context) both work over the USB tunnel.
  ▶ Press Ctrl+C to stop the server and remove the port forward.
`);

const vite = spawn(viteBin, [], { stdio: 'inherit', shell: isWin });

let cleanedUp = false;
function cleanup() {
  if (cleanedUp) return;
  cleanedUp = true;
  console.log(`\n> adb reverse --remove tcp:${PORT}`);
  spawnSync('adb', ['reverse', '--remove', `tcp:${PORT}`], { stdio: 'inherit' });
}

vite.on('exit', (code) => {
  cleanup();
  process.exit(code ?? 0);
});

// On Ctrl+C, propagate so Vite tears down its WebSocket cleanly, then cleanup
// runs in the 'exit' handler above.
for (const sig of ['SIGINT', 'SIGTERM', 'SIGHUP']) {
  process.on(sig, () => {
    if (vite.exitCode === null) vite.kill(sig);
  });
}
