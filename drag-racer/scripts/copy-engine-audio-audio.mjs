/**
 * copy-engine-audio-audio.mjs
 *
 * Copies node_modules/engine-audio/public/audio → public/audio
 * so Vite serves the WAV samples at /audio/... in both dev and prod.
 *
 * Run automatically via "copy:engine-audio" npm script before dev/build.
 */

import { cp, mkdir, access } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const src = join(root, 'node_modules', 'engine-audio', 'public', 'audio');
const dest = join(root, 'public', 'audio');

async function exists(p) {
  try {
    await access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(src))) {
    console.warn(
      `[copy-engine-audio] Source not found: ${src}\n` +
      `  Run "npm install" first, or check that engine-audio has a public/audio directory.\n` +
      `  Skipping copy – existing public/audio (if any) will be used.`
    );
    return;
  }

  await mkdir(dest, { recursive: true });

  await cp(src, dest, { recursive: true, force: true });

  console.log(`[copy-engine-audio] Copied  ${src}\n` +
              `                         →  ${dest}`);
}

main().catch((err) => {
  console.error('[copy-engine-audio] Error:', err);
  // Non-fatal: don't fail the build if audio assets can't be copied
});
