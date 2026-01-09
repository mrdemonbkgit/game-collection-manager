import { DatabaseSync } from 'node:sqlite';
import { SCHEMA } from './schema.js';
import path from 'node:path';
import fs from 'node:fs';

let db: DatabaseSync | null = null;

export function getDatabase(): DatabaseSync {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

/**
 * Check if a table exists in the database
 */
function tableExists(database: DatabaseSync, table: string): boolean {
  const result = database.prepare(
    `SELECT name FROM sqlite_master WHERE type='table' AND name=?`
  ).get(table) as { name: string } | undefined;
  return result !== undefined;
}

/**
 * Check if a column exists in a table
 */
function columnExists(database: DatabaseSync, table: string, column: string): boolean {
  const result = database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  return result.some(col => col.name === column);
}

/**
 * Run migrations to add new columns to existing database
 */
function runMigrations(database: DatabaseSync): void {
  const migrations = [
    // Existing SteamGridDB columns
    { table: 'games', column: 'steamgrid_id', sql: 'ALTER TABLE games ADD COLUMN steamgrid_id INTEGER' },
    { table: 'games', column: 'hero_url', sql: 'ALTER TABLE games ADD COLUMN hero_url TEXT' },
    { table: 'games', column: 'logo_url', sql: 'ALTER TABLE games ADD COLUMN logo_url TEXT' },
    { table: 'games', column: 'assets_checked_at', sql: 'ALTER TABLE games ADD COLUMN assets_checked_at TEXT' },

    // IGDB columns (17)
    { table: 'games', column: 'igdb_id', sql: 'ALTER TABLE games ADD COLUMN igdb_id INTEGER' },
    { table: 'games', column: 'igdb_slug', sql: 'ALTER TABLE games ADD COLUMN igdb_slug TEXT' },
    { table: 'games', column: 'igdb_rating', sql: 'ALTER TABLE games ADD COLUMN igdb_rating REAL' },
    { table: 'games', column: 'igdb_rating_count', sql: 'ALTER TABLE games ADD COLUMN igdb_rating_count INTEGER' },
    { table: 'games', column: 'igdb_aggregated_rating', sql: 'ALTER TABLE games ADD COLUMN igdb_aggregated_rating REAL' },
    { table: 'games', column: 'igdb_aggregated_rating_count', sql: 'ALTER TABLE games ADD COLUMN igdb_aggregated_rating_count INTEGER' },
    { table: 'games', column: 'igdb_total_rating', sql: 'ALTER TABLE games ADD COLUMN igdb_total_rating REAL' },
    { table: 'games', column: 'storyline', sql: 'ALTER TABLE games ADD COLUMN storyline TEXT' },
    { table: 'games', column: 'themes', sql: "ALTER TABLE games ADD COLUMN themes TEXT DEFAULT '[]'" },
    { table: 'games', column: 'game_modes', sql: "ALTER TABLE games ADD COLUMN game_modes TEXT DEFAULT '[]'" },
    { table: 'games', column: 'player_perspectives', sql: "ALTER TABLE games ADD COLUMN player_perspectives TEXT DEFAULT '[]'" },
    { table: 'games', column: 'igdb_updated_at', sql: 'ALTER TABLE games ADD COLUMN igdb_updated_at TEXT' },
    { table: 'games', column: 'igdb_match_confidence', sql: 'ALTER TABLE games ADD COLUMN igdb_match_confidence INTEGER' },
    { table: 'games', column: 'igdb_genres', sql: "ALTER TABLE games ADD COLUMN igdb_genres TEXT DEFAULT '[]'" },
    { table: 'games', column: 'igdb_platforms', sql: "ALTER TABLE games ADD COLUMN igdb_platforms TEXT DEFAULT '[]'" },
    { table: 'games', column: 'igdb_summary', sql: 'ALTER TABLE games ADD COLUMN igdb_summary TEXT' },

    // Additional SteamGridDB columns (7)
    { table: 'games', column: 'icon_url', sql: 'ALTER TABLE games ADD COLUMN icon_url TEXT' },
    { table: 'games', column: 'steamgrid_name', sql: 'ALTER TABLE games ADD COLUMN steamgrid_name TEXT' },
    { table: 'games', column: 'steamgrid_verified', sql: 'ALTER TABLE games ADD COLUMN steamgrid_verified INTEGER DEFAULT 0' },
    { table: 'games', column: 'grids_count', sql: 'ALTER TABLE games ADD COLUMN grids_count INTEGER' },
    { table: 'games', column: 'heroes_count', sql: 'ALTER TABLE games ADD COLUMN heroes_count INTEGER' },
    { table: 'games', column: 'logos_count', sql: 'ALTER TABLE games ADD COLUMN logos_count INTEGER' },
    { table: 'games', column: 'icons_count', sql: 'ALTER TABLE games ADD COLUMN icons_count INTEGER' },

    // Steam extended columns - Game type and age (3)
    { table: 'games', column: 'game_type', sql: "ALTER TABLE games ADD COLUMN game_type TEXT DEFAULT 'game'" },
    { table: 'games', column: 'required_age', sql: 'ALTER TABLE games ADD COLUMN required_age INTEGER DEFAULT 0' },
    { table: 'games', column: 'is_free', sql: 'ALTER TABLE games ADD COLUMN is_free INTEGER DEFAULT 0' },

    // Steam extended columns - Platform support (3)
    { table: 'games', column: 'platforms', sql: "ALTER TABLE games ADD COLUMN platforms TEXT DEFAULT '{}'" },
    { table: 'games', column: 'controller_support', sql: 'ALTER TABLE games ADD COLUMN controller_support TEXT' },
    { table: 'games', column: 'supported_languages', sql: 'ALTER TABLE games ADD COLUMN supported_languages TEXT' },

    // Steam extended columns - Links (2)
    { table: 'games', column: 'website', sql: 'ALTER TABLE games ADD COLUMN website TEXT' },
    { table: 'games', column: 'background_url', sql: 'ALTER TABLE games ADD COLUMN background_url TEXT' },

    // Steam extended columns - Requirements (3)
    { table: 'games', column: 'pc_requirements', sql: "ALTER TABLE games ADD COLUMN pc_requirements TEXT DEFAULT '{}'" },
    { table: 'games', column: 'mac_requirements', sql: "ALTER TABLE games ADD COLUMN mac_requirements TEXT DEFAULT '{}'" },
    { table: 'games', column: 'linux_requirements', sql: "ALTER TABLE games ADD COLUMN linux_requirements TEXT DEFAULT '{}'" },

    // Steam extended columns - Media (1)
    { table: 'games', column: 'movies', sql: "ALTER TABLE games ADD COLUMN movies TEXT DEFAULT '[]'" },

    // Steam extended columns - Stats (3)
    { table: 'games', column: 'recommendations_total', sql: 'ALTER TABLE games ADD COLUMN recommendations_total INTEGER' },
    { table: 'games', column: 'achievements_total', sql: 'ALTER TABLE games ADD COLUMN achievements_total INTEGER' },
    { table: 'games', column: 'current_players', sql: 'ALTER TABLE games ADD COLUMN current_players INTEGER' },

    // Steam extended columns - Reviews (4)
    { table: 'games', column: 'review_score', sql: 'ALTER TABLE games ADD COLUMN review_score INTEGER' },
    { table: 'games', column: 'review_score_desc', sql: 'ALTER TABLE games ADD COLUMN review_score_desc TEXT' },
    { table: 'games', column: 'reviews_positive', sql: 'ALTER TABLE games ADD COLUMN reviews_positive INTEGER' },
    { table: 'games', column: 'reviews_negative', sql: 'ALTER TABLE games ADD COLUMN reviews_negative INTEGER' },

    // Steam extended columns - Pricing (4)
    { table: 'games', column: 'price_currency', sql: 'ALTER TABLE games ADD COLUMN price_currency TEXT' },
    { table: 'games', column: 'price_initial', sql: 'ALTER TABLE games ADD COLUMN price_initial INTEGER' },
    { table: 'games', column: 'price_final', sql: 'ALTER TABLE games ADD COLUMN price_final INTEGER' },
    { table: 'games', column: 'price_discount_percent', sql: 'ALTER TABLE games ADD COLUMN price_discount_percent INTEGER' },

    // Steam extended columns - Content (2)
    { table: 'games', column: 'content_descriptors', sql: "ALTER TABLE games ADD COLUMN content_descriptors TEXT DEFAULT '[]'" },
    { table: 'games', column: 'dlc_app_ids', sql: "ALTER TABLE games ADD COLUMN dlc_app_ids TEXT DEFAULT '[]'" },

    // Steam extended columns - Timestamps (2)
    { table: 'games', column: 'last_played_at', sql: 'ALTER TABLE games ADD COLUMN last_played_at TEXT' },
    { table: 'games', column: 'steam_data_updated_at', sql: 'ALTER TABLE games ADD COLUMN steam_data_updated_at TEXT' },
  ];

  for (const migration of migrations) {
    if (!columnExists(database, migration.table, migration.column)) {
      console.log(`[DB] Adding column ${migration.column} to ${migration.table}...`);
      database.exec(migration.sql);
    }
  }
}

/**
 * Run index migrations - creates indexes that may not exist
 */
function runIndexMigrations(database: DatabaseSync): void {
  const indexes = [
    // IGDB indexes
    'CREATE INDEX IF NOT EXISTS idx_games_igdb_id ON games(igdb_id)',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_games_igdb_id_unique ON games(igdb_id) WHERE igdb_id IS NOT NULL',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_games_steamgrid_id_unique ON games(steamgrid_id) WHERE steamgrid_id IS NOT NULL',

    // Steam extended field indexes
    'CREATE INDEX IF NOT EXISTS idx_games_game_type ON games(game_type)',
    'CREATE INDEX IF NOT EXISTS idx_games_is_free ON games(is_free)',
    'CREATE INDEX IF NOT EXISTS idx_games_recommendations ON games(recommendations_total)',
    'CREATE INDEX IF NOT EXISTS idx_games_achievements ON games(achievements_total)',
    'CREATE INDEX IF NOT EXISTS idx_games_review_score ON games(review_score)',
    'CREATE INDEX IF NOT EXISTS idx_games_igdb_aggregated_rating ON games(igdb_aggregated_rating)',
  ];

  for (const indexSql of indexes) {
    try {
      database.exec(indexSql);
    } catch (err) {
      // Index may already exist, ignore
      console.log(`[DB] Index creation skipped (may exist): ${indexSql.substring(0, 60)}...`);
    }
  }
}

export function initDatabase(dbPath?: string): DatabaseSync {
  const finalPath = dbPath || process.env.DATABASE_PATH || './data/games.db';

  // Ensure directory exists
  const dir = path.dirname(finalPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new DatabaseSync(finalPath);

  // Enable WAL mode for better concurrent read/write performance
  db.exec('PRAGMA journal_mode = WAL');

  // Set busy timeout to 30 seconds (30000ms) to handle concurrent access
  db.exec('PRAGMA busy_timeout = 30000');

  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON');

  // For existing databases, run migrations BEFORE schema
  // (so new columns exist before schema tries to create indexes on them)
  if (tableExists(db, 'games')) {
    runMigrations(db);
  }

  // Run schema (creates tables if they don't exist, creates indexes)
  db.exec(SCHEMA);

  // Run index migrations (after schema to ensure tables exist)
  runIndexMigrations(db);

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
