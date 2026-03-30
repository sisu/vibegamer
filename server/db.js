import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { join, dirname } from 'path';
import { mkdirSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DB_PATH ?? join(__dirname, '../data/games.db');

mkdirSync(dirname(dbPath), { recursive: true });

const db = new Database(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS games (
    id          TEXT PRIMARY KEY,
    parent_id   TEXT REFERENCES games(id),
    code        TEXT NOT NULL,
    prompts     TEXT NOT NULL,
    platform    TEXT NOT NULL DEFAULT 'desktop',
    model       TEXT NOT NULL DEFAULT 'claude-haiku-4-5',
    created_at  INTEGER NOT NULL
  );

  CREATE TABLE IF NOT EXISTS shares (
    slug        TEXT PRIMARY KEY,
    game_id     TEXT NOT NULL REFERENCES games(id),
    created_at  INTEGER NOT NULL
  );
`);

export function getGame(id) {
  return db.prepare('SELECT * FROM games WHERE id = ?').get(id) ?? null;
}

export function createGame({ id, parentId = null, code, prompts, platform, model }) {
  db.prepare(`
    INSERT INTO games (id, parent_id, code, prompts, platform, model, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, parentId, code, JSON.stringify(prompts), platform, model, Date.now());
}

export function getShare(slug) {
  return db.prepare(`
    SELECT s.slug, s.game_id AS gameId, s.created_at AS createdAt,
           g.platform, g.model, g.prompts
    FROM shares s
    JOIN games g ON g.id = s.game_id
    WHERE s.slug = ?
  `).get(slug) ?? null;
}

export function createShare(slug, gameId) {
  db.prepare('INSERT INTO shares (slug, game_id, created_at) VALUES (?, ?, ?)')
    .run(slug, gameId, Date.now());
}
