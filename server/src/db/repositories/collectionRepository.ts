import { getDatabase } from '../connection.js';

export interface CollectionRow {
  id: number;
  name: string;
  description: string | null;
  is_smart_filter: number;
  filter_criteria: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCollectionInput {
  name: string;
  description?: string;
  isSmartFilter?: boolean;
  filterCriteria?: Record<string, unknown>;
}

export function getAllCollections(): CollectionRow[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM collections ORDER BY name');
  return stmt.all() as unknown as CollectionRow[];
}

export function getCollectionById(id: number): CollectionRow | null {
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM collections WHERE id = ?');
  const result = stmt.get(id) as CollectionRow | undefined;
  return result ?? null;
}

export function insertCollection(input: CreateCollectionInput): number {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO collections (name, description, is_smart_filter, filter_criteria)
    VALUES (?, ?, ?, ?)
  `);

  const result = stmt.run(
    input.name,
    input.description ?? null,
    input.isSmartFilter ? 1 : 0,
    input.filterCriteria ? JSON.stringify(input.filterCriteria) : null
  );

  return Number(result.lastInsertRowid);
}

export function updateCollection(id: number, input: Partial<CreateCollectionInput>): boolean {
  const db = getDatabase();

  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  if (input.name !== undefined) {
    updates.push('name = ?');
    params.push(input.name);
  }

  if (input.description !== undefined) {
    updates.push('description = ?');
    params.push(input.description ?? null);
  }

  if (input.isSmartFilter !== undefined) {
    updates.push('is_smart_filter = ?');
    params.push(input.isSmartFilter ? 1 : 0);
  }

  if (input.filterCriteria !== undefined) {
    updates.push('filter_criteria = ?');
    params.push(input.filterCriteria ? JSON.stringify(input.filterCriteria) : null);
  }

  if (updates.length === 0) {
    return false;
  }

  // Always update updated_at
  updates.push("updated_at = datetime('now')");
  params.push(id);

  const stmt = db.prepare(`
    UPDATE collections SET ${updates.join(', ')} WHERE id = ?
  `);

  const result = stmt.run(...params);
  return result.changes > 0;
}

export function deleteCollection(id: number): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM collections WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// Junction table operations

export function addGameToCollection(collectionId: number, gameId: number): void {
  const db = getDatabase();
  // Use INSERT OR IGNORE to avoid PK conflicts
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO collection_games (collection_id, game_id)
    VALUES (?, ?)
  `);
  stmt.run(collectionId, gameId);
}

export function removeGameFromCollection(collectionId: number, gameId: number): boolean {
  const db = getDatabase();
  const stmt = db.prepare(`
    DELETE FROM collection_games WHERE collection_id = ? AND game_id = ?
  `);
  const result = stmt.run(collectionId, gameId);
  return result.changes > 0;
}

export function getGamesInCollection(collectionId: number): number[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT game_id FROM collection_games WHERE collection_id = ?');
  const rows = stmt.all(collectionId) as Array<{ game_id: number }>;
  return rows.map((r) => r.game_id);
}

export function getCollectionsForGame(gameId: number): number[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT collection_id FROM collection_games WHERE game_id = ?');
  const rows = stmt.all(gameId) as Array<{ collection_id: number }>;
  return rows.map((r) => r.collection_id);
}

export function getCollectionGameCounts(): Array<{ collection_id: number; count: number }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT collection_id, COUNT(*) as count
    FROM collection_games
    GROUP BY collection_id
  `);
  return stmt.all() as Array<{ collection_id: number; count: number }>;
}

export function clearAllCollections(): void {
  const db = getDatabase();
  db.exec('DELETE FROM collection_games');
  db.exec('DELETE FROM collections');
}
