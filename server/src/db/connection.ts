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

  // Run schema
  db.exec(SCHEMA);

  return db;
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
