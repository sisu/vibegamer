Simple game-prototyping website: User writes a simple game description, and AI generates a game prototype that is immediately playable in the browser.

## Local Development

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` and add at least one AI provider key:

- `ANTHROPIC_API_KEY` — enables Claude Haiku 4.5 (default) and Sonnet 4.5
- `OPENAI_API_KEY` — enables GPT-4o mini and GPT-4o
- `GOOGLE_API_KEY` — enables Gemini 1.5 Flash and Pro

**Free option (no API key needed):** use Ollama with a local model:

```bash
# Install Ollama from https://ollama.com, then:
ollama pull llama3.2
ollama serve
# Leave OLLAMA_HOST=http://localhost:11434 in .env (or omit it — that's the default)
```

### 3. Set up assets and game engine

```bash
npm run setup
```

This command:
- Copies the Kaplay game engine bundle to `public/engine/kaboom.js`
- Creates placeholder game assets in `public/assets/` (sprites, tiles, icons, sounds)
- Generates the asset manifest that is injected into the AI prompt

**Optional:** replace the placeholder assets with real [Kenney.nl](https://kenney.nl) CC0 asset packs for much better-looking games. Drop the files into `public/assets/sprites/`, `public/assets/tiles/`, `public/assets/icons/`, and `public/assets/sounds/`, then re-run `node scripts/buildAssetManifest.js`.

### 4. Start the server

```bash
node server/index.js
```

Open [http://localhost:3000](http://localhost:3000).

> If you edited assets after setup, rebuild the manifest first: `node scripts/buildAssetManifest.js && node server/index.js`

### Full one-liner (setup + start)

```bash
npm start
```

---

## How it works

- Describe a game → AI generates Kaplay (Kaboom.js) JavaScript → runs in a sandboxed iframe
- Refine the game with follow-up prompts; each refinement creates a new version
- Share creates an immutable snapshot link; editing later won't affect the shared URL
- Shared games require a "Play" click before running (security)
- Fork a shared game to get your own editable copy
- Platform-aware: mobile visitors get touch-controlled games, desktop gets keyboard/mouse

## Deployment

Set the same environment variables on your host (Railway, Fly.io, etc.) and ensure a persistent volume is mounted for the SQLite database (`DB_PATH=./data/games.db`).

Start command: `node scripts/buildAssetManifest.js && node server/index.js`
