#!/usr/bin/env node
// Creates minimal placeholder PNG and WAV files so the server and AI prompt
// work out of the box without downloading real asset packs.
// Replace these with real Kenney.nl (CC0) assets for a better experience.

import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, '../public/assets');

// 1×1 transparent PNG (68 bytes)
const PNG = Buffer.from(
  '89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c489' +
  '0000000a4944415478016360000000020001e221bc330000000049454e44ae426082',
  'hex'
);

// Minimal silent WAV (PCM 16-bit mono 44100 Hz, 1 sample)
function makeSilentWav() {
  const buf = Buffer.alloc(46);
  buf.write('RIFF',   0, 'ascii');
  buf.writeUInt32LE(38,    4);
  buf.write('WAVE',   8, 'ascii');
  buf.write('fmt ',  12, 'ascii');
  buf.writeUInt32LE(16,   16);
  buf.writeUInt16LE(1,    20);  // PCM
  buf.writeUInt16LE(1,    22);  // mono
  buf.writeUInt32LE(44100, 24);
  buf.writeUInt32LE(88200, 28);
  buf.writeUInt16LE(2,    32);
  buf.writeUInt16LE(16,   34);
  buf.write('data',  36, 'ascii');
  buf.writeUInt32LE(2,    40);
  buf.writeInt16LE(0,     44);
  return buf;
}

const WAV = makeSilentWav();

const SPRITES = [
  'player.png', 'enemy-slime.png', 'enemy-bat.png',
  'coin.png', 'gem.png', 'heart.png', 'bullet.png', 'explosion.png',
];
const TILES = [
  'grass.png', 'dirt.png', 'stone.png',
  'water.png', 'wall-brick.png', 'platform.png',
];
const ICONS = [
  'star.png', 'arrow-up.png', 'arrow-down.png',
  'arrow-left.png', 'arrow-right.png', 'x-mark.png', 'check.png',
];
const SOUNDS = [
  'jump.wav', 'coin.wav', 'hit.wav',
  'gameover.wav', 'win.wav', 'shoot.wav',
];

function ensureDir(p) { mkdirSync(p, { recursive: true }); }

function writeIfMissing(path, data) {
  if (!existsSync(path)) {
    writeFileSync(path, data);
    return true;
  }
  return false;
}

let created = 0;

for (const name of SPRITES) {
  ensureDir(join(assetsDir, 'sprites'));
  if (writeIfMissing(join(assetsDir, 'sprites', name), PNG)) created++;
}
for (const name of TILES) {
  ensureDir(join(assetsDir, 'tiles'));
  if (writeIfMissing(join(assetsDir, 'tiles', name), PNG)) created++;
}
for (const name of ICONS) {
  ensureDir(join(assetsDir, 'icons'));
  if (writeIfMissing(join(assetsDir, 'icons', name), PNG)) created++;
}
for (const name of SOUNDS) {
  ensureDir(join(assetsDir, 'sounds'));
  if (writeIfMissing(join(assetsDir, 'sounds', name), WAV)) created++;
}

if (created > 0) {
  console.log(`Created ${created} placeholder assets in public/assets/`);
  console.log('Tip: replace these with real Kenney.nl (CC0) assets for best results.');
} else {
  console.log('All placeholder assets already exist — skipped.');
}
