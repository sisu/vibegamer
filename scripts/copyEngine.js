#!/usr/bin/env node
// Copies the Kaplay bundle to public/engine/kaboom.js and strips the
// sourceMappingURL comment so it doesn't trigger CSP violations inside
// the sandboxed game iframe.

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const src  = join(__dirname, '../node_modules/kaplay/dist/kaplay.js');
const dest = join(__dirname, '../public/engine/kaboom.js');

const content = readFileSync(src, 'utf-8')
  .replace(/\/\/# sourceMappingURL=\S+/g, '');

writeFileSync(dest, content);
console.log('Kaplay engine copied to public/engine/kaboom.js (sourceMappingURL stripped)');
