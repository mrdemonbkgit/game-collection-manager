/**
 * E2E Test Database Setup Script
 *
 * Copies games from the main database to the test database.
 * Collections are NOT copied - E2E tests manage their own collections.
 */

import { DatabaseSync } from 'node:sqlite';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

const MAIN_DB_PATH = path.join(PROJECT_ROOT, 'server/data/games.db');
const TEST_DB_PATH = path.join(PROJECT_ROOT, 'server/data/test.db');

function setupTestDatabase() {
  console.log('Setting up E2E test database...');

  // Ensure data directory exists
  const dataDir = path.dirname(TEST_DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  // Remove existing test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH);
    console.log('Removed existing test database');
  }

  // Check if main database exists
  if (!fs.existsSync(MAIN_DB_PATH)) {
    console.error('Main database not found at', MAIN_DB_PATH);
    console.error('Run the Steam sync first to populate the main database');
    process.exit(1);
  }

  // Open both databases
  const mainDb = new DatabaseSync(MAIN_DB_PATH);
  const testDb = new DatabaseSync(TEST_DB_PATH);

  // Enable foreign keys
  testDb.exec('PRAGMA foreign_keys = ON');

  // Create schema in test database (same as main schema)
  const schema = `
    -- Games table
    CREATE TABLE IF NOT EXISTS games (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      cover_image_url TEXT,
      screenshots TEXT DEFAULT '[]',
      description TEXT,
      short_description TEXT,
      developer TEXT,
      publisher TEXT,
      release_date TEXT,
      genres TEXT DEFAULT '[]',
      tags TEXT DEFAULT '[]',
      metacritic_score INTEGER,
      metacritic_url TEXT,
      steam_rating REAL,
      steam_rating_count INTEGER,
      steam_app_id INTEGER UNIQUE,
      playtime_minutes INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Game platforms
    CREATE TABLE IF NOT EXISTS game_platforms (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_id INTEGER NOT NULL,
      platform_type TEXT NOT NULL CHECK(platform_type IN ('steam', 'gamepass', 'eaplay', 'ubisoftplus')),
      platform_game_id TEXT NOT NULL,
      is_primary INTEGER DEFAULT 0,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
      UNIQUE(game_id, platform_type)
    );

    -- Collections
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      is_smart_filter INTEGER DEFAULT 0,
      filter_criteria TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Collection games
    CREATE TABLE IF NOT EXISTS collection_games (
      collection_id INTEGER NOT NULL,
      game_id INTEGER NOT NULL,
      PRIMARY KEY (collection_id, game_id),
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
      FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
    );

    -- AI conversations
    CREATE TABLE IF NOT EXISTS ai_conversations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- AI messages
    CREATE TABLE IF NOT EXISTS ai_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      conversation_id INTEGER NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
      content TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (conversation_id) REFERENCES ai_conversations(id) ON DELETE CASCADE
    );

    -- User preferences
    CREATE TABLE IF NOT EXISTS user_preferences (
      key TEXT PRIMARY KEY,
      value TEXT
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_games_title ON games(title);
    CREATE INDEX IF NOT EXISTS idx_games_steam_app_id ON games(steam_app_id);
    CREATE INDEX IF NOT EXISTS idx_games_metacritic ON games(metacritic_score);
    CREATE INDEX IF NOT EXISTS idx_games_release_date ON games(release_date);
    CREATE INDEX IF NOT EXISTS idx_game_platforms_game_id ON game_platforms(game_id);
    CREATE INDEX IF NOT EXISTS idx_game_platforms_type ON game_platforms(platform_type);
    CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation ON ai_messages(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_collection_games_collection ON collection_games(collection_id);
    CREATE INDEX IF NOT EXISTS idx_collection_games_game ON collection_games(game_id);
  `;

  testDb.exec(schema);
  console.log('Created test database schema');

  // Copy games
  const games = mainDb.prepare('SELECT * FROM games').all() as Array<Record<string, unknown>>;
  const insertGame = testDb.prepare(`
    INSERT INTO games (
      id, title, slug, cover_image_url, screenshots, description, short_description,
      developer, publisher, release_date, genres, tags, metacritic_score, metacritic_url,
      steam_rating, steam_rating_count, steam_app_id, playtime_minutes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const game of games) {
    insertGame.run(
      game.id,
      game.title,
      game.slug,
      game.cover_image_url,
      game.screenshots,
      game.description,
      game.short_description,
      game.developer,
      game.publisher,
      game.release_date,
      game.genres,
      game.tags,
      game.metacritic_score,
      game.metacritic_url,
      game.steam_rating,
      game.steam_rating_count,
      game.steam_app_id,
      game.playtime_minutes,
      game.created_at,
      game.updated_at
    );
  }
  console.log(`Copied ${games.length} games`);

  // Copy game_platforms
  const gamePlatforms = mainDb
    .prepare('SELECT * FROM game_platforms')
    .all() as Array<Record<string, unknown>>;
  const insertGamePlatform = testDb.prepare(
    'INSERT INTO game_platforms (id, game_id, platform_type, platform_game_id, is_primary) VALUES (?, ?, ?, ?, ?)'
  );
  for (const gp of gamePlatforms) {
    insertGamePlatform.run(gp.id, gp.game_id, gp.platform_type, gp.platform_game_id, gp.is_primary);
  }
  console.log(`Copied ${gamePlatforms.length} game-platform links`);

  // Note: Collections are NOT copied - E2E tests manage their own collections

  // Close databases
  mainDb.close();
  testDb.close();

  console.log('Test database setup complete!');
  console.log(`Test database: ${TEST_DB_PATH}`);
  console.log('Collections NOT copied - E2E tests will manage their own collections');
}

setupTestDatabase();
