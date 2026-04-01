import 'dotenv/config';
import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import gamesRouter from './routes/games.js';
import sharesRouter from './routes/shares.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const gameHtml = readFileSync(join(__dirname, '../public/game.html'), 'utf-8');

const app = new Hono();

app.use('*', logger());

// API routes
app.route('/', gamesRouter);
app.route('/', sharesRouter);

// Game page
app.get('/game/:id', (c) => c.html(gameHtml));

// Allow null-origin sandboxed iframes to load assets
app.use('/assets/*', (c, next) => {
  c.res.headers.set('Access-Control-Allow-Origin', '*');
  return next();
});

// Static files (served last so API routes take priority)
app.use('/*', serveStatic({ root: './public' }));

// 404 fallback
app.notFound((c) => c.text('Not found', 404));

const PORT = parseInt(process.env.PORT ?? '3000');

serve({ fetch: app.fetch, port: PORT }, () => {
  console.log(`VibeGamer running at http://localhost:${PORT}`);
});
