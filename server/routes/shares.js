import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { getGame, getShare, createShare } from '../db.js';
import { buildFrameHtml, FRAME_HEADERS } from '../frame.js';

const router = new Hono();

// Create a share snapshot for a game
router.post('/api/games/:id/share', (c) => {
  const game = getGame(c.req.param('id'));
  if (!game) return c.json({ error: 'Not found' }, 404);

  const slug = nanoid(6);
  createShare(slug, game.id);

  const baseUrl = process.env.BASE_URL ?? `http://localhost:${process.env.PORT ?? 3000}`;
  return c.json({ slug, url: `${baseUrl}/s/${slug}` });
});

// Get share metadata (prompts, platform, model — no code)
router.get('/api/share/:slug', (c) => {
  const share = getShare(c.req.param('slug'));
  if (!share) return c.json({ error: 'Not found' }, 404);

  return c.json({
    slug: share.slug,
    gameId: share.gameId,
    platform: share.platform,
    model: share.model,
    prompts: JSON.parse(share.prompts).filter(p => p.role === 'user'),
    createdAt: share.createdAt,
  });
});

// Render a shared game in an isolated iframe document
router.get('/api/share/:slug/frame', (c) => {
  const share = getShare(c.req.param('slug'));
  if (!share) return c.text('Not found', 404);

  const game = getGame(share.gameId);
  if (!game) return c.text('Not found', 404);

  return c.html(buildFrameHtml(game.code), 200, FRAME_HEADERS);
});

export default router;
