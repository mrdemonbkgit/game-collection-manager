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
    { table: 'games', column: 'steamgrid_id', sql: 'ALTER TABLE games ADD COLUMN steamgrid_id INTEGER' },
    { table: 'games', column: 'hero_url', sql: 'ALTER TABLE games ADD COLUMN hero_url TEXT' },
    { table: 'games', column: 'logo_url', sql: 'ALTER TABLE games ADD COLUMN logo_url TEXT' },
    { table: 'games', column: 'assets_checked_at', sql: 'ALTER TABLE games ADD COLUMN assets_checked_at TEXT' },
  ];

  for (const migration of migrations) {
    if (!columnExists(database, migration.table, migration.column)) {
      console.log(`[DB] Adding column ${migration.column} to ${migration.table}...`);
      database.exec(migration.sql);
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

  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON');

  // For existing databases, run migrations BEFORE schema
  // (so new columns exist before schema tries to create indexes on them)
  if (tableExists(db, 'games')) {
    runMigrations(db);
  }

  // Run schema (creates tables if they don't exist, creates indexes)
  db.exec(SCHEMA);

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
