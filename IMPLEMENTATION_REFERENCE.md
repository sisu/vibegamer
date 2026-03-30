# Game Prototyping Website — Implementation Reference

## Table of Contents

1. [Project Structure](#1-project-structure)
2. [Tech Stack](#2-tech-stack)
3. [Database Schema](#3-database-schema)
4. [API Routes](#4-api-routes)
5. [Multi-Provider AI Architecture](#5-multi-provider-ai-architecture)
6. [Game Engine Setup (Kaplay)](#6-game-engine-setup-kaplay)
7. [Asset Library](#7-asset-library)
8. [Sandboxed Game Rendering](#8-sandboxed-game-rendering)
9. [Share & Fork System](#9-share--fork-system)
10. [Platform Detection](#10-platform-detection)
11. [Rate Limiting & Cost Control](#11-rate-limiting--cost-control)
12. [Security Checklist](#12-security-checklist)
13. [Frontend UI Flow](#13-frontend-ui-flow)
14. [Environment Variables](#14-environment-variables)
15. [Deployment](#15-deployment)

---

## 1. Project Structure

```
/
├── server/
│   ├── index.js              # Hono app entry point
│   ├── db.js                 # SQLite setup & queries
│   ├── ai/
│   │   ├── index.js          # Provider router — picks adapter by model string
│   │   ├── prompt.js         # Shared system prompt builder
│   │   ├── validate.js       # Output safety validation (shared)
│   │   ├── adapters/
│   │   │   ├── anthropic.js  # Claude (Haiku, Sonnet, Opus)
│   │   │   ├── openai.js     # GPT-4o, GPT-4o-mini, o1-mini
│   │   │   ├── google.js     # Gemini 1.5 Flash, Gemini 1.5 Pro
│   │   │   └── ollama.js     # Local models via Ollama (Llama, Mistral, etc.)
│   │   └── models.js         # Registry of available models + metadata
│   ├── rateLimiter.js        # Per-IP rate limiting
│   ├── assetManifest.js      # Auto-generated asset list
│   └── routes/
│       ├── games.js          # POST /api/games, POST /api/games/:id/refine
│       └── shares.js         # POST /api/games/:id/share, GET /api/share/:slug
├── public/
│   ├── index.html            # Main editor UI
│   ├── share.html            # Shared game viewer UI
│   ├── style.css
│   ├── app.js                # Editor frontend logic
│   ├── share.js              # Share page frontend logic
│   ├── engine/
│   │   └── kaboom.js         # Self-hosted Kaplay bundle
│   └── assets/
│       ├── sprites/          # player.png, enemy.png, coin.png …
│       ├── tiles/            # grass.png, wall.png, water.png …
│       ├── icons/            # star.png, heart.png, arrow-up.png …
│       └── sounds/           # jump.wav, coin.wav, hit.wav …
├── scripts/
│   └── buildAssetManifest.js # Scans /public/assets/, outputs manifest.json
├── data/
│   └── games.db              # SQLite database file (gitignored)
├── .env
└── package.json
```

---

## 2. Tech Stack

| Layer | Technology | Reason |
|---|---|---|
| Runtime | Node.js 20+ | Stable, broad ecosystem |
| Web framework | **Hono** | Lightweight, fast, clean middleware API |
| AI — default model | **claude-haiku-4-5** | Cheapest + fastest for prototypes; swap via model registry |
| AI — provider SDKs | `@anthropic-ai/sdk`, `openai`, `@google/generative-ai` | One SDK per cloud provider |
| AI — local models | **Ollama** (HTTP API) | Runs Llama, Mistral, Phi locally; no SDK needed |
| Database | **SQLite** via `better-sqlite3` | Zero-ops; a single file; synchronous API |
| Rate limiting | `node-rate-limiter-flexible` (in-memory) | No external dependency needed at small scale |
| Frontend | Vanilla HTML/CSS/JS | No build step; simpler security surface |
| Game engine | **Kaplay (Kaboom.js)** | Minimal code for 2D games; great for codegen prompts |

**Install dependencies:**
```bash
npm install hono @hono/node-server better-sqlite3 nanoid \
            @anthropic-ai/sdk openai @google/generative-ai \
            rate-limiter-flexible dotenv
```

> **Ollama** is a local process, not an npm package. Install it separately from [ollama.com](https://ollama.com) and run `ollama serve`. Your server communicates with it over `http://localhost:11434`.

---

## 3. Database Schema

```sql
-- games: stores every version of every game
CREATE TABLE IF NOT EXISTS games (
  id          TEXT PRIMARY KEY,           -- nanoid (8 chars), e.g. "x7k2m9pq"
  parent_id   TEXT REFERENCES games(id),  -- NULL for originals; set when forked
  code        TEXT NOT NULL,              -- raw JS game code
  prompts     TEXT NOT NULL,              -- JSON array: [{role, content}, ...]
  platform    TEXT NOT NULL DEFAULT 'desktop', -- "desktop" | "mobile"
  model       TEXT NOT NULL DEFAULT 'claude-haiku-4-5', -- model used to generate
  created_at  INTEGER NOT NULL            -- Unix timestamp (Date.now())
);

-- shares: immutable snapshots pointing to a game version
CREATE TABLE IF NOT EXISTS shares (
  slug        TEXT PRIMARY KEY,           -- short random slug, e.g. "abc123"
  game_id     TEXT NOT NULL REFERENCES games(id),
  created_at  INTEGER NOT NULL
);
```

**Key design decisions:**
- `games.model` records which model generated each version. This lets the share page display which model was used, and lets you compare outputs across models for the same prompt.
- `shares.game_id` points to a specific `games` row. If the user later refines their game, a new `games` row is created; the share still points to the old one — it is effectively a frozen snapshot.
- Forked games set `parent_id` to the source game's id, enabling lineage tracking. The share that was used as the fork source is not modified.

---

## 4. API Routes

### `POST /api/games`
Create a new game from a description.

**Request body:**
```json
{
  "description": "A simple platformer with a bouncing ball",
  "platform": "desktop",
  "model": "claude-haiku-4-5"
}
```

The `model` field is optional; if omitted the server uses the configured default. The server validates that the supplied model string exists in the model registry before calling the AI — clients cannot pass arbitrary strings through to the provider SDKs.

**Response:**
```json
{
  "id": "x7k2m9pq",
  "platform": "desktop",
  "model": "claude-haiku-4-5"
}
```

The client stores this `id` locally (e.g. in a JS variable or `sessionStorage`) and uses it for refinements. The code itself is **never sent to the client** — it stays on the server.

---

### `POST /api/games/:id/refine`
Refine an existing game. The server looks up the current code and prompt history by `id`, appends the new user message, and calls the AI.

**Request body:**
```json
{
  "instruction": "Make the enemies move faster and add a score counter",
  "model": "gemini-1.5-flash"
}
```

The `model` field is optional; if omitted the server reuses the model stored on the parent game row. Switching models mid-session is allowed — the new model receives the full prompt history regardless of which model generated the previous versions.

**Response:**
```json
{
  "id": "y8n3p1qz",
  "model": "gemini-1.5-flash"
}
```

Each refinement creates a **new `games` row** (with `parent_id` set to the previous id) rather than mutating the existing row. This means every version is preserved and shares are always stable.

---

### `GET /api/models`
Returns the list of available models for the model picker in the UI. Only models whose API key (or local endpoint) is configured in the server's environment are included.

**Response:**
```json
{
  "models": [
    { "id": "claude-haiku-4-5",    "label": "Claude Haiku 4.5",    "provider": "anthropic", "default": true },
    { "id": "claude-sonnet-4-5",   "label": "Claude Sonnet 4.5",   "provider": "anthropic" },
    { "id": "gpt-4o-mini",         "label": "GPT-4o mini",          "provider": "openai" },
    { "id": "gpt-4o",              "label": "GPT-4o",               "provider": "openai" },
    { "id": "gemini-1.5-flash",    "label": "Gemini 1.5 Flash",    "provider": "google" },
    { "id": "gemini-1.5-pro",      "label": "Gemini 1.5 Pro",      "provider": "google" },
    { "id": "llama3.2",            "label": "Llama 3.2 (local)",   "provider": "ollama" },
    { "id": "mistral",             "label": "Mistral (local)",      "provider": "ollama" }
  ]
}
```

---

### `GET /api/games/:id/frame`
Returns a complete, self-contained HTML document that runs the game. This is loaded into the sandbox iframe using `src` (not `srcdoc`) so the sandbox `origin` is isolated.

The server injects:
- The Kaplay engine script tag (pointing to `/engine/kaboom.js`)
- The game code wrapped in a `<script>` tag
- A strict CSP header on the response

The client never sees the raw JS code — only this opaque iframe URL.

---

### `POST /api/games/:id/share`
Creates a share snapshot.

**Response:**
```json
{
  "slug": "abc123",
  "url": "https://yoursite.com/s/abc123"
}
```

---

### `GET /api/share/:slug`
Returns share metadata for the share page (no code).

**Response:**
```json
{
  "slug": "abc123",
  "gameId": "x7k2m9pq",
  "platform": "desktop",
  "model": "gemini-1.5-flash",
  "prompts": [
    { "role": "user", "content": "A simple platformer with coins" },
    { "role": "user", "content": "Add a lives counter" }
  ],
  "createdAt": 1712345678000
}
```

---

### `GET /api/share/:slug/frame`
Same as `GET /api/games/:id/frame` but accessed via slug. Used when the user clicks "Play" on the share page.

---

## 5. Multi-Provider AI Architecture

The AI layer is structured as a **provider adapter pattern**: a shared interface that each provider implements, with a central router that picks the right adapter based on the model string. All prompt-building and output validation logic is shared across providers.

### Model Registry (`server/ai/models.js`)

The registry is the single source of truth for which models exist and which adapter handles them. The `GET /api/models` route reads from this file. Models are only surfaced to the UI if their required env var is set.

```js
// server/ai/models.js
export const MODEL_REGISTRY = [
  // Anthropic
  { id: 'claude-haiku-4-5',  label: 'Claude Haiku 4.5',  provider: 'anthropic', envKey: 'ANTHROPIC_API_KEY', default: true },
  { id: 'claude-sonnet-4-5', label: 'Claude Sonnet 4.5', provider: 'anthropic', envKey: 'ANTHROPIC_API_KEY' },
  // OpenAI
  { id: 'gpt-4o-mini',       label: 'GPT-4o mini',        provider: 'openai',    envKey: 'OPENAI_API_KEY' },
  { id: 'gpt-4o',            label: 'GPT-4o',             provider: 'openai',    envKey: 'OPENAI_API_KEY' },
  // Google
  { id: 'gemini-1.5-flash',  label: 'Gemini 1.5 Flash',  provider: 'google',    envKey: 'GOOGLE_API_KEY' },
  { id: 'gemini-1.5-pro',    label: 'Gemini 1.5 Pro',    provider: 'google',    envKey: 'GOOGLE_API_KEY' },
  // Ollama (local) — no API key required; check if OLLAMA_HOST is reachable
  { id: 'llama3.2',          label: 'Llama 3.2 (local)',  provider: 'ollama',    envKey: null },
  { id: 'mistral',           label: 'Mistral (local)',    provider: 'ollama',    envKey: null },
];

export function getModel(id) {
  return MODEL_REGISTRY.find(m => m.id === id) ?? null;
}

export function getDefaultModel() {
  return MODEL_REGISTRY.find(m => m.default);
}

// Only return models whose provider is configured
export function getAvailableModels() {
  return MODEL_REGISTRY.filter(m =>
    m.envKey === null || process.env[m.envKey]
  );
}
```

---

### Shared Interface (`server/ai/index.js`)

The router validates the model, picks the adapter, and calls it. All callers use this single entry point — routes never import adapters directly.

```js
// server/ai/index.js
import { getModel, getDefaultModel } from './models.js';
import { buildSystemPrompt } from './prompt.js';
import { validateCode } from './validate.js';
import * as anthropic from './adapters/anthropic.js';
import * as openai    from './adapters/openai.js';
import * as google    from './adapters/google.js';
import * as ollama    from './adapters/ollama.js';

const ADAPTERS = { anthropic, openai, google, ollama };

export async function generateGame({ description, platform, assetManifest, modelId }) {
  const model = resolveModel(modelId);
  const systemPrompt = buildSystemPrompt(platform, assetManifest);
  const messages = [{ role: 'user', content: description }];

  const code = await ADAPTERS[model.provider].complete({ model, systemPrompt, messages });
  return { code, modelId: model.id, ...validateCode(code) };
}

export async function refineGame({ existingCode, promptHistory, instruction, platform, assetManifest, modelId }) {
  const model = resolveModel(modelId);
  const systemPrompt = buildSystemPrompt(platform, assetManifest);

  // Full conversation history — model-agnostic format
  const messages = [
    ...promptHistory.map(p => ({ role: p.role, content: p.content })),
    { role: 'assistant', content: existingCode },
    { role: 'user', content: instruction },
  ];

  const code = await ADAPTERS[model.provider].complete({ model, systemPrompt, messages });
  return { code, modelId: model.id, ...validateCode(code) };
}

function resolveModel(modelId) {
  const model = modelId ? getModel(modelId) : getDefaultModel();
  if (!model) throw new Error(`Unknown model: ${modelId}`);
  return model;
}
```

---

### Shared System Prompt (`server/ai/prompt.js`)

One prompt used by all providers. The instructions are written to be model-agnostic — every provider's model is capable of following them.

```js
// server/ai/prompt.js
export function buildSystemPrompt(platform, assetManifest) {
  const platformInstructions = platform === 'mobile'
    ? `Platform: Mobile browser (390×844 canvas, portrait).
Use touch controls only. Add large on-screen buttons for movement.
Use onTouchStart / onTouchEnd. Never use keyboard input.`
    : `Platform: Desktop browser (800×600 canvas).
Use keyboard (WASD/arrow keys) and mouse controls.`;

  return `You are a game code generator for a browser-based prototyping tool.

${platformInstructions}

Rules (strictly follow all of them):
1. Output ONLY valid JavaScript. No markdown, no backticks, no explanation, no comments.
2. Do not use fetch(), XMLHttpRequest, import(), or eval().
3. Do not reference any URL that does not start with /assets/ or /engine/.
4. Do not access document.cookie, localStorage, sessionStorage, window.parent, or window.top.
5. Always call kaboom() first to initialize the Kaplay engine.
6. Only use assets from the asset manifest below. Do not invent asset paths.
7. If the request is not about making a game, output exactly: // INVALID REQUEST

${KAPLAY_CHEATSHEET}

Available assets (use ONLY these paths):
${assetManifest.join('\n')}`;
}
```

---

### Output Validation (`server/ai/validate.js`)

Shared across all providers. Run this before storing any generated code.

```js
// server/ai/validate.js
const BLOCKED_PATTERNS = [
  /fetch\s*\(/,
  /XMLHttpRequest/,
  /import\s*\(/,
  /\beval\s*\(/,
  /document\.cookie/,
  /localStorage/,
  /sessionStorage/,
  /window\.parent/,
  /window\.top/,
  /https?:\/\//,        // no absolute URLs at all
];

export function validateCode(code) {
  if (code.trim() === '// INVALID REQUEST') {
    return { valid: false, reason: 'off-topic' };
  }
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(code)) {
      return { valid: false, reason: `blocked pattern: ${pattern}` };
    }
  }
  return { valid: true };
}
```

---

### Provider Adapters

Each adapter exposes a single `complete({ model, systemPrompt, messages })` function and returns a plain string (the generated code). All provider-specific SDK details are contained within the adapter.

#### Anthropic (`server/ai/adapters/anthropic.js`)

```js
import Anthropic from '@anthropic-ai/sdk';
const client = new Anthropic(); // reads ANTHROPIC_API_KEY

export async function complete({ model, systemPrompt, messages }) {
  const res = await client.messages.create({
    model: model.id,
    max_tokens: 2000,
    system: systemPrompt,
    messages,
  });
  return res.content[0].text;
}
```

#### OpenAI (`server/ai/adapters/openai.js`)

```js
import OpenAI from 'openai';
const client = new OpenAI(); // reads OPENAI_API_KEY

export async function complete({ model, systemPrompt, messages }) {
  const res = await client.chat.completions.create({
    model: model.id,
    max_tokens: 2000,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ],
  });
  return res.choices[0].message.content;
}
```

#### Google Gemini (`server/ai/adapters/google.js`)

Gemini's SDK uses a different conversation format. The adapter normalizes the shared message array into Gemini's `contents` structure.

```js
import { GoogleGenerativeAI } from '@google/generative-ai';
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

export async function complete({ model, systemPrompt, messages }) {
  const geminiModel = genAI.getGenerativeModel({
    model: model.id,
    systemInstruction: systemPrompt,
  });

  // Gemini uses "model" instead of "assistant" for the role
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const result = await geminiModel.generateContent({
    contents,
    generationConfig: { maxOutputTokens: 2000 },
  });

  return result.response.text();
}
```

#### Ollama / Local Models (`server/ai/adapters/ollama.js`)

Ollama exposes an OpenAI-compatible `/v1/chat/completions` endpoint, so the adapter is nearly identical to the OpenAI one — just pointed at localhost.

```js
export async function complete({ model, systemPrompt, messages }) {
  const host = process.env.OLLAMA_HOST ?? 'http://localhost:11434';

  const res = await fetch(`${host}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: model.id,
      max_tokens: 2000,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    }),
  });

  if (!res.ok) throw new Error(`Ollama error: ${res.status}`);
  const data = await res.json();
  return data.choices[0].message.content;
}
```

> **Note:** Fetch is used here inside the server-side adapter, not in game code. The output validation blocklist applies only to user-generated game code.

---

### Model Picker in the UI

On page load, `app.js` fetches `GET /api/models` and populates a `<select>` dropdown. The selected model id is included in every `POST /api/games` and `POST /api/games/:id/refine` request.

```js
// app.js
async function loadModels() {
  const { models } = await fetch('/api/models').then(r => r.json());
  const select = document.getElementById('model-select');
  for (const m of models) {
    const opt = document.createElement('option');
    opt.value = m.id;
    opt.textContent = m.label;
    if (m.default) opt.selected = true;
    select.appendChild(opt);
  }
}
```

The share page displays the model name stored in the `games` row alongside the prompt history, so viewers know which model generated the game they're looking at.

---

### Provider Comparison

| Provider | Best for | Relative cost | Requires |
|---|---|---|---|
| `claude-haiku-4-5` | Fast, cheap, reliable default | $ | `ANTHROPIC_API_KEY` |
| `claude-sonnet-4-5` | Higher quality generation | $$$ | `ANTHROPIC_API_KEY` |
| `gpt-4o-mini` | Good quality, low cost | $ | `OPENAI_API_KEY` |
| `gpt-4o` | High quality | $$$$ | `OPENAI_API_KEY` |
| `gemini-1.5-flash` | Fast, cheap, generous limits | $ | `GOOGLE_API_KEY` |
| `gemini-1.5-pro` | High quality | $$$ | `GOOGLE_API_KEY` |
| `llama3.2` (local) | Free, private, offline testing | Free | Ollama running locally |
| `mistral` (local) | Free, private, offline testing | Free | Ollama running locally |



---

## 6. Game Engine Setup (Kaplay)

### Self-Hosting

Download the Kaplay UMD bundle and place it at `/public/engine/kaboom.js`. Do **not** load it from a CDN — it must stay within your origin so CSP `script-src 'self'` covers it.

```bash
# Example: copy from node_modules after install
npm install kaplay
cp node_modules/kaplay/dist/kaplay.js public/engine/kaboom.js
```

### Kaplay Cheat Sheet for the System Prompt

Include a condensed version of this in the AI system prompt so the model knows the API without hallucinating:

```
Kaplay Quick Reference (always call kaboom() first):

kaboom({ width: 800, height: 600, background: [0,0,0] });

loadSprite("player", "/assets/sprites/player.png");
loadSound("jump", "/assets/sounds/jump.wav");

scene("main", () => {
  const player = add([ sprite("player"), pos(80, 80), area(), body() ]);
  add([ rect(800, 16), pos(0, 400), area(), body({ isStatic: true }), color(0,200,0) ]);

  onKeyDown("left",  () => player.move(-160, 0));
  onKeyDown("right", () => player.move(160,  0));
  onKeyPress("space", () => player.jump());

  // Mobile touch: use onTouchStart / onTouchEnd
  // Score label:
  const score = add([ text("0"), pos(12, 12), fixed() ]);
  let count = 0;
  // score.text = String(++count);
});

go("main");
```

---

## 7. Asset Library

### Sourcing Assets

Use **Kenney.nl** assets (public domain CC0). Recommended packs:
- Kenney Tiny Town / Platformer / Space / Dungeon

### Directory Layout

```
public/assets/
  sprites/
    player.png
    enemy-slime.png
    enemy-bat.png
    coin.png
    gem.png
    heart.png
    bullet.png
    explosion.png
  tiles/
    grass.png
    dirt.png
    stone.png
    water.png
    wall-brick.png
    platform.png
  icons/
    star.png
    arrow-up.png
    arrow-down.png
    arrow-left.png
    arrow-right.png
    x-mark.png
    check.png
  sounds/
    jump.wav
    coin.wav
    hit.wav
    gameover.wav
    win.wav
    shoot.wav
```

### Asset Manifest Generation

Run `scripts/buildAssetManifest.js` as part of the server startup to scan the assets directory and produce a manifest that is injected into the AI system prompt.

```js
// scripts/buildAssetManifest.js
import { readdirSync, statSync, writeFileSync } from 'fs';
import { join } from 'path';

function scan(dir, base = '') {
  const entries = readdirSync(dir);
  const files = [];
  for (const entry of entries) {
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

const manifest = scan('public/assets');
writeFileSync('public/assets/manifest.json', JSON.stringify(manifest, null, 2));
console.log(`Asset manifest: ${manifest.length} files`);
```

The manifest is embedded in the system prompt as:
```
Available assets (use ONLY these paths):
/assets/sprites/player.png
/assets/sprites/coin.png
... (full list)
```

---

## 8. Sandboxed Game Rendering

### The Iframe Approach

The game runs inside an iframe served from a dedicated route (`/api/games/:id/frame`). This endpoint returns a **complete HTML page** with strict headers. The client-side `<iframe>` element points to this URL.

```html
<!-- In index.html -->
<iframe
  id="game-frame"
  sandbox="allow-scripts"
  style="width:800px; height:600px; border:none;"
></iframe>
```

```js
// In app.js — after game is generated
document.getElementById('game-frame').src = `/api/games/${gameId}/frame`;
```

### Frame Route Response (`server/routes/games.js`)

```js
app.get('/api/games/:id/frame', (c) => {
  const game = db.getGame(c.req.param('id'));
  if (!game) return c.text('Not found', 404);

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>body { margin:0; overflow:hidden; }</style>
  <script src="/engine/kaboom.js"></script>
</head>
<body>
  <script>
${game.code}
  </script>
</body>
</html>`;

  return c.html(html, 200, {
    'Content-Security-Policy':
      "default-src 'self'; script-src 'self' 'unsafe-inline'; img-src 'self'; connect-src 'none'; frame-ancestors 'self'",
    'X-Frame-Options': 'SAMEORIGIN',
    'Cache-Control': 'no-store',
  });
});
```

### Why `sandbox="allow-scripts"` without `allow-same-origin`

This is the critical security choice. Without `allow-same-origin`:
- The iframe has a **null origin** — it cannot access `localStorage`, cookies, or the parent page's DOM.
- `document.cookie` returns an empty string.
- `window.parent.postMessage` can be sent but the parent can validate the origin.
- XSS from within a game cannot escape the sandbox.

Combined with `connect-src 'none'` in the CSP, the game cannot make any network requests at all.

---

## 9. Share & Fork System

### Creating a Share

```js
// server/routes/shares.js
app.post('/api/games/:id/share', (c) => {
  const game = db.getGame(c.req.param('id'));
  if (!game) return c.json({ error: 'Not found' }, 404);

  const slug = nanoid(6); // e.g. "abc123"
  db.createShare(slug, game.id);
  return c.json({ slug, url: `${BASE_URL}/s/${slug}` });
});
```

### Share Page Behavior (`share.html` / `share.js`)

The share page:
1. Calls `GET /api/share/:slug` to fetch metadata (prompts, platform).
2. Displays the prompt history in a read-only list.
3. Shows a **"▶ Play Game"** button — game does **not** autostart.
4. On click, sets `iframe.src = /api/share/${slug}/frame`.
5. Shows a **"Fork & Edit"** button that POSTs to `/api/games/:id/fork` (creates a new game row with `parent_id` set) and redirects the user to the editor with the new game id.

### Fork Route

```js
app.post('/api/games/:id/fork', (c) => {
  const source = db.getGame(c.req.param('id'));
  if (!source) return c.json({ error: 'Not found' }, 404);

  const newId = nanoid(8);
  db.createGame({
    id: newId,
    parentId: source.id,
    code: source.code,
    prompts: source.prompts,
    platform: source.platform,
  });

  return c.json({ id: newId });
});
```

---

## 10. Platform Detection

### Client-Side Detection

On page load in `app.js`, detect the platform and send it with the generation request:

```js
function detectPlatform() {
  const ua = navigator.userAgent;
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua)
                || window.innerWidth < 768;
  return isMobile ? 'mobile' : 'desktop';
}

const platform = detectPlatform();
```

### System Prompt Injection

The server injects different platform instructions:

**Desktop:**
```
Platform: Desktop browser (800×600 canvas).
Use keyboard (WASD/arrow keys) and mouse controls.
```

**Mobile:**
```
Platform: Mobile browser (390×844 canvas, portrait).
Use touch controls only. Add large on-screen buttons for movement.
Use onTouchStart / onTouchEnd. Never use keyboard input.
```

---

## 11. Rate Limiting & Cost Control

### Per-IP Rate Limit

```js
// server/rateLimiter.js
import { RateLimiterMemory } from 'rate-limiter-flexible';

const limiter = new RateLimiterMemory({
  points: 5,          // 5 generation requests
  duration: 3600,     // per hour
});

export async function checkRateLimit(ip) {
  try {
    await limiter.consume(ip);
    return { allowed: true };
  } catch {
    return { allowed: false };
  }
}
```

Apply in the generation route before calling the AI:
```js
const { allowed } = await checkRateLimit(c.req.header('x-forwarded-for') ?? 'unknown');
if (!allowed) return c.json({ error: 'Rate limit exceeded. Try again in an hour.' }, 429);
```

### Additional Cost Controls

- **`max_tokens: 2000`** — hard cap per AI call applied uniformly across all adapters; a simple game rarely needs more.
- **User input length limit:** Reject description strings over 500 characters at the route level, before any provider is called.
- **Monthly budget caps:** Set hard spend limits in each provider's dashboard independently — Anthropic Console, OpenAI Platform, Google AI Studio.
- **Expose only cheap models in production:** The model registry lets you comment out expensive models (GPT-4o, Claude Sonnet, Gemini Pro) so they never appear in the UI unless you explicitly enable them.
- **Ollama for development:** Use local models during development to avoid any cloud spend while iterating on the prompt and UI.
- **Optional CAPTCHA:** Add hCaptcha (free tier) on the "Generate" button if abuse is detected. Verify the token server-side before calling the AI.

---

## 12. Security Checklist

| Threat | Mitigation |
|---|---|
| Prompt injection via game description | User input is a `user`-role message only; system prompt is server-side and never exposed |
| Client supplying arbitrary model string | Server validates model id against registry before passing to any adapter |
| AI generating malicious code | Output validated with shared regex blocklist before storage, regardless of provider |
| Game code calling external URLs | CSP `connect-src 'none'` inside iframe + `img-src 'self'` blocks all external network |
| Game code escaping the iframe | `sandbox="allow-scripts"` (no `allow-same-origin`) gives a null origin |
| Game code accessing parent page DOM | Null origin prevents cross-frame DOM access |
| External assets referenced in game | Asset manifest enforced in prompt + CSP `img-src 'self'` |
| User exceeding AI spend limits | Per-IP rate limiting + `max_tokens` cap + per-provider dashboard budget caps |
| Shared link to malicious game | User must click "Play" button; sandbox still applies when they do |
| Share page XSS from prompt content | Prompts are displayed as text content (escaped), never as `innerHTML` |
| Forged game IDs | IDs are opaque nanoids; no sequential enumeration; server validates existence |
| Clickjacking the editor | `X-Frame-Options: DENY` on main pages; `frame-ancestors 'self'` on game frames |
| Ollama SSRF (server fetching internal URLs) | Validate `OLLAMA_HOST` is a known safe address at startup; never let client supply the host |

---

## 13. Frontend UI Flow

### Editor Page (`index.html`)

```
┌─────────────────────────────────────────────┐
│  🎮 Game Prototyper                         │
│                                             │
│  Model: [Claude Haiku 4.5        ▼]         │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │ Describe your game…                  │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│  [▶ Generate Game]                          │
│                                             │
│  ┌──────────────────────────────────────┐   │
│  │                                      │   │
│  │          GAME IFRAME                 │   │
│  │                                      │   │
│  └──────────────────────────────────────┘   │
│                                             │
│  Model: [Gemini 1.5 Flash        ▼]         │
│  Refine: ┌──────────────────────────────┐   │
│           │ Make enemies faster…         │   │
│           └──────────────────────────────┘   │
│  [🔄 Refine]   [🔗 Share]                   │
└─────────────────────────────────────────────┘
```

The model picker appears both at the top (for initial generation) and above the refinement input (allowing model switching between iterations). State held in JS variables:

```js
let currentGameId = null;  // set after generation or refinement
let currentModel  = null;  // set from model picker; falls back to server default
```

### Share Page (`share.html` at `/s/:slug`)

```
┌─────────────────────────────────────────────┐
│  🎮 Shared Game                             │
│                                             │
│  Prompts used:                              │
│  1. "A platformer with coins"               │
│  2. "Add a lives counter"                   │
│                                             │
│  [▶ Play Game]    [✏️ Fork & Edit]          │
│                                             │
│  (iframe appears here after clicking Play)  │
└─────────────────────────────────────────────┘
```

---

## 14. Environment Variables

```bash
# .env

# ── Server ──────────────────────────────────────────────
BASE_URL=https://yoursite.com
PORT=3000
DB_PATH=./data/games.db

# ── AI Providers (add only the ones you want to enable) ─
# At least one must be set. Models from unconfigured providers
# are automatically hidden from the UI model picker.

ANTHROPIC_API_KEY=sk-ant-...      # Enables Claude Haiku, Sonnet
OPENAI_API_KEY=sk-...             # Enables GPT-4o mini, GPT-4o
GOOGLE_API_KEY=...                # Enables Gemini 1.5 Flash, Pro

# Ollama (local) — no key needed, just point at the running process
# Defaults to http://localhost:11434 if not set
OLLAMA_HOST=http://localhost:11434

# ── AI Behaviour ────────────────────────────────────────
DEFAULT_MODEL=claude-haiku-4-5   # Used when client doesn't specify
MAX_TOKENS=2000
MAX_DESCRIPTION_LENGTH=500

# ── Rate Limiting ───────────────────────────────────────
RATE_LIMIT_POINTS=5              # requests per window
RATE_LIMIT_DURATION=3600         # window in seconds

# ── Optional ────────────────────────────────────────────
HCAPTCHA_SECRET=...              # If using CAPTCHA
```

> For local development with only Ollama (fully free/offline), set only `OLLAMA_HOST`. The UI will show only local models. For production, set whichever cloud provider keys you want to expose; unset ones are silently excluded.

---

## 15. Deployment

### Local Development

```bash
npm install
node scripts/buildAssetManifest.js   # generate asset manifest
node server/index.js
```

To test with local models only (no cloud API keys needed):
```bash
# Install Ollama from https://ollama.com, then:
ollama pull llama3.2
ollama serve
# In .env: OLLAMA_HOST=http://localhost:11434
node server/index.js
```

### Production (Railway or Fly.io)

Both platforms support Node.js with persistent disk for SQLite.

**Railway:**
- Connect GitHub repo, Railway auto-detects Node.js.
- Set a persistent volume mounted at `/data` for `games.db`.
- Add only the provider keys you want to expose as Railway environment variables.
- Set start command: `node scripts/buildAssetManifest.js && node server/index.js`

**Fly.io:**
```bash
fly launch
fly volumes create gamedata --size 1   # 1 GB for SQLite
# In fly.toml, mount volume at /data
fly secrets set ANTHROPIC_API_KEY=sk-ant-...
fly secrets set OPENAI_API_KEY=sk-...
fly secrets set GOOGLE_API_KEY=...
fly deploy
```

### SQLite at Scale

For a hobby/demo project, a single SQLite file on a persistent volume is perfectly adequate. If you later need to scale horizontally, swap `better-sqlite3` for **Turso** (hosted libSQL, same API, free tier available) with minimal code changes:

```bash
npm install @libsql/client
```

---

## Quick Implementation Order

1. **Bootstrap:** Hono server, SQLite schema (with `model` column), serve static files.
2. **Asset library:** Download Kenney assets, run manifest script.
3. **Model registry:** `models.js` with all providers; `GET /api/models` route.
4. **Ollama adapter first:** Get local models working before touching cloud APIs — zero cost, fast feedback loop.
5. **Shared prompt + validation:** `prompt.js` and `validate.js` — used by all adapters.
6. **Cloud adapters:** Add Anthropic, OpenAI, Google adapters one at a time, testing each.
7. **AI router:** `server/ai/index.js` wiring everything together.
8. **Core routes:** `POST /api/games`, `GET /api/games/:id/frame` with model param.
9. **Editor UI:** Description input + model picker → generate → iframe display.
10. **Refinement:** `POST /api/games/:id/refine` route + UI input + model switcher.
11. **Share system:** Share route, share page (show model used), fork route.
12. **Rate limiting:** Add middleware to generation routes.
13. **Platform detection:** Pass platform flag, inject into system prompt.
14. **Polish:** Error states, loading indicators, mobile responsive layout.
