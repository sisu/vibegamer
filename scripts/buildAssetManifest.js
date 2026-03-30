#!/usr/bin/env node
// Scans public/assets/ and writes public/assets/manifest.json.
// Run this before starting the server: node scripts/buildAssetManifest.js

import { readdirSync, statSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const assetsDir = join(__dirname, '../public/assets');
const manifestPath = join(assetsDir, 'manifest.json');

if (!existsSync(assetsDir)) {
  mkdirSync(assetsDir, { recursive: true });
}

function scan(dir, base = '') {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
    if (entry === 'manifest.json') continue;
    const full = join(dir, entry);
    const rel  = base ? `${base}/${entry}` : entry;
    if (statSync(full).isDirectory()) {
      files.push(...scan(full, rel));
    } else {
      files.push(`/assets/${rel}`);
    }
  }
  return files;
}

const manifest = scan(assetsDir);
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log(`Asset manifest written: ${manifest.length} files → ${manifestPath}`);
