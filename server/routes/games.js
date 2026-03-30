import { Hono } from 'hono';
import { nanoid } from 'nanoid';
import { getGame, createGame } from '../db.js';
import { generateGame, refineGame as refineGameFn } from '../ai/index.js';
import { assetManifest } from '../assetManifest.js';
import { checkRateLimit } from '../rateLimiter.js';
import { getAvailableModels } from '../ai/models.js';
import { buildFrameHtml, FRAME_HEADERS } from '../frame.js';

const router = new Hono();
const MAX_LEN = parseInt(process.env.MAX_DESCRIPTION_LENGTH ?? '500');

function clientIp(c) {
  return c.req.header('x-forwarded-for')?.split(',')[0].trim()
    ?? c.req.header('x-real-ip')
    ?? 'unknown';
}

// List available models (only those whose provider is configured)
router.get('/api/models', (c) => {
  const models = getAvailableModels().map(m => ({
    id: m.id,
    label: m.label,
    provider: m.provider,
    ...(m.default ? { default: true } : {}),
  }));
  return c.json({ models });
});

// Get game metadata (used when loading a forked game)
router.get('/api/games/:id', (c) => {
  const game = getGame(c.req.param('id'));
  if (!game) return c.json({ error: 'Not found' }, 404);
  return c.json({ id: game.id, platform: game.platform, model: game.model });
});

// Generate a new game
router.post('/api/games', async (c) => {
  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const { description, platform = 'desktop', model: modelId } = body;

  if (!description || typeof description !== 'string' || !description.trim()) {
    return c.json({ error: 'description is required' }, 400);
  }
  if (description.length > MAX_LEN) {
    return c.json({ error: `Description must be ${MAX_LEN} characters or fewer` }, 400);
  }

  const { allowed } = await checkRateLimit(clientIp(c));
  if (!allowed) return c.json({ error: 'Rate limit exceeded. Try again in an hour.' }, 429);

  let result;
  try {
    result = await generateGame({ description: description.trim(), platform, assetManifest, modelId });
  } catch (err) {
    console.error('AI generation error:', err);
    return c.json({ error: 'Game generation failed. Check your API key or model availability.' }, 502);
  }

  if (!result.valid) {
    return c.json({ error: `Could not generate a valid game: ${result.reason}` }, 400);
  }

  const id = nanoid(8);
  const prompts = [{ role: 'user', content: description.trim() }];
  createGame({ id, code: result.code, prompts, platform, model: result.modelId });

  return c.json({ id, platform, model: result.modelId });
});

// Refine an existing game
router.post('/api/games/:id/refine', async (c) => {
  const gameId = c.req.param('id');
  const game = getGame(gameId);
  if (!game) return c.json({ error: 'Game not found' }, 404);

  let body;
  try { body = await c.req.json(); } catch { return c.json({ error: 'Invalid JSON' }, 400); }

  const { instruction, model: modelId } = body;

  if (!instruction || typeof instruction !== 'string' || !instruction.trim()) {
    return c.json({ error: 'instruction is required' }, 400);
  }
  if (instruction.length > MAX_LEN) {
    return c.json({ error: `Instruction must be ${MAX_LEN} characters or fewer` }, 400);
  }

  const { allowed } = await checkRateLimit(clientIp(c));
  if (!allowed) return c.json({ error: 'Rate limit exceeded. Try again in an hour.' }, 429);

  const existingPrompts = JSON.parse(game.prompts);
  const refinedModelId = modelId ?? game.model;

  let result;
  try {
    result = await refineGameFn({
      existingCode: game.code,
      promptHistory: existingPrompts,
      instruction: instruction.trim(),
      platform: game.platform,
      assetManifest,
      modelId: refinedModelId,
    });
  } catch (err) {
    console.error('AI refinement error:', err);
    return c.json({ error: 'Refinement failed. Check your API key or model availability.' }, 502);
  }

  if (!result.valid) {
    return c.json({ error: `Could not generate a valid game: ${result.reason}` }, 400);
  }

  const newId = nanoid(8);
  const newPrompts = [...existingPrompts, { role: 'user', content: instruction.trim() }];
  createGame({ id: newId, parentId: gameId, code: result.code, prompts: newPrompts, platform: game.platform, model: result.modelId });

  return c.json({ id: newId, model: result.modelId });
});

// Fork an existing game (create an editable copy)
router.post('/api/games/:id/fork', (c) => {
  const source = getGame(c.req.param('id'));
  if (!source) return c.json({ error: 'Not found' }, 404);

  const newId = nanoid(8);
  createGame({
    id: newId,
    parentId: source.id,
    code: source.code,
    prompts: JSON.parse(source.prompts),
    platform: source.platform,
    model: source.model,
  });

  return c.json({ id: newId });
});

// Render a game in an isolated iframe document
router.get('/api/games/:id/frame', (c) => {
  const game = getGame(c.req.param('id'));
  if (!game) return c.text('Not found', 404);
  return c.html(buildFrameHtml(game.code), 200, FRAME_HEADERS);
});

export default router;
