#!/usr/bin/env node
import { mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'src/assets/app-icon.png');
const OUT = resolve(ROOT, 'public/icons');

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];
const MASKABLE = [192, 512];

const BG = { r: 255, g: 255, b: 255, alpha: 1 };

async function ensureDir(dir) {
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

async function generateAny(size) {
  const out = resolve(OUT, `icon-${size}.png`);
  await sharp(SRC)
    .resize(size, size, { fit: 'contain', background: BG })
    .flatten({ background: BG })
    .png()
    .toFile(out);
  return out;
}

async function generateMaskable(size) {
  const out = resolve(OUT, `maskable-${size}.png`);
  // Maskable icons need ~80% safe zone — pad the source.
  const inner = Math.round(size * 0.7);
  const buf = await sharp(SRC)
    .resize(inner, inner, { fit: 'contain', background: BG })
    .png()
    .toBuffer();
  await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: BG,
    },
  })
    .composite([{ input: buf, gravity: 'center' }])
    .png()
    .toFile(out);
  return out;
}

async function generateFavicon() {
  const out = resolve(ROOT, 'public/favicon.ico');
  // .ico isn't directly supported by sharp; emit a 32x32 png renamed as a fallback.
  // (Most browsers accept PNG content under favicon.ico.)
  await sharp(SRC)
    .resize(32, 32, { fit: 'contain', background: BG })
    .flatten({ background: BG })
    .png()
    .toFile(out);
  return out;
}

async function main() {
  if (!existsSync(SRC)) {
    console.error(`Source icon not found at ${SRC}`);
    process.exit(1);
  }
  await ensureDir(OUT);

  const generated = [];
  for (const size of SIZES) {
    generated.push(await generateAny(size));
  }
  for (const size of MASKABLE) {
    generated.push(await generateMaskable(size));
  }
  generated.push(await generateFavicon());

  console.log(`Generated ${generated.length} icon files in ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
