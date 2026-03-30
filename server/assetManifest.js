import { readFileSync, existsSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const manifestPath = join(__dirname, '../public/assets/manifest.json');

let assetManifest = [];

if (existsSync(manifestPath)) {
  assetManifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
} else {
  console.warn('⚠  Asset manifest not found. Run: node scripts/buildAssetManifest.js');
}

export { assetManifest };
