# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

VibeGamer is an AI-powered game prototyping website. Users describe a game in natural language, and an AI model generates immediately playable browser-based games. Games can be iteratively refined, shared via immutable snapshot links, and forked for independent editing.

## Commands

```bash
# Install dependencies
npm install hono @hono/node-server better-sqlite3 nanoid \
            @anthropic-ai/sdk openai @google/generative-ai \
            rate-limiter-flexible dotenv
npm install kaplay

# Build asset manifest (run before starting server)
node scripts/buildAssetManifest.js

# Start server
node server/index.js

# Local development without cloud API keys (requires Ollama installed)
ollama pull llama3.2
ollama serve
# Then start server with OLLAMA_HOST set in .env
```

## Architecture

### Server (Hono + Node.js)
- `server/index.js` — entry point, middleware setup
- `server/routes/games.js` — game CRUD + generation endpoints
- `server/routes/shares.js` — immutable share snapshot endpoints
- `server/db.js` — SQLite schema (`games` and `shares` tables via `better-sqlite3`)
- `server/rateLimiter.js` — per-IP in-memory rate limiting (5 req/hour default)
- `server/assetManifest.js` — scans `public/assets/` and builds prompt-injectable manifest

### AI Layer (`server/ai/`)
- `index.js` — routes requests to the correct provider adapter
- `prompt.js` — builds the unified system prompt (includes asset manifest + platform instructions)
- `validate.js` — safety blocklist validation on generated code
- `models.js` — model registry with metadata (provider, display name, cost tier)
- `adapters/` — one file per provider: `anthropic.js`, `openai.js`, `google.js`, `ollama.js`

### Frontend
Plain HTML/CSS/JS — no build step. Game code is **never sent to the client**; only opaque `nanoid`-generated game IDs are returned. Games render inside sandboxed iframes via `/api/games/:id/frame`.

### Key Data Flow

**Generation:** User prompt → rate limit check → system prompt + asset manifest injected → AI adapter called → code validated → stored in DB → opaque game ID returned to client.

**Refinement:** Game ID + new instruction → previous code + full prompt history fetched → conversation history passed to AI → new game row created with `parent_id` linking to previous version.

**Rendering:** `/api/games/:id/frame` returns a self-contained HTML document with the Kaplay UMD bundle and generated game code. Served in a sandboxed iframe (`sandbox="allow-scripts"`, no `allow-same-origin`) — games cannot access parent DOM, cookies, or localStorage.

**Sharing:** Creates an immutable `shares` row pointing to a specific game version. Share links never change even if the game is later refined.

## Environment Variables

```
ANTHROPIC_API_KEY=
OPENAI_API_KEY=
GOOGLE_API_KEY=
OLLAMA_HOST=http://localhost:11434   # optional, for local models
RATE_LIMIT_MAX=5                     # requests per window
RATE_LIMIT_WINDOW_SECONDS=3600
PORT=3000
```

## Security Architecture

- **Sandboxed iframes**: `sandbox="allow-scripts"` only — no same-origin, no cookies, no parent access
- **Code on server only**: Generated JS never leaves the server; clients only get IDs
- **Input validation**: Prompt length limits, blocklist on generated code before storage
- **Rate limiting**: Per-IP to control AI API costs
- **Content Security Policy**: Set on frame responses to restrict resource loading

See `IMPLEMENTATION_REFERENCE.md` for the full security checklist and implementation order.
