import { getDatabase } from '../connection.js';

export interface GameRow {
  id: number;
  title: string;
  slug: string;
  cover_image_url: string | null;
  screenshots: string;
  description: string | null;
  short_description: string | null;
  developer: string | null;
  publisher: string | null;
  release_date: string | null;
  genres: string;
  tags: string;
  metacritic_score: number | null;
  metacritic_url: string | null;
  steam_rating: number | null;
  steam_rating_count: number | null;
  steam_app_id: number | null;
  playtime_minutes: number;
  created_at: string;
  updated_at: string;
}

export interface GamePlatformRow {
  id: number;
  game_id: number;
  platform_type: string;
  platform_game_id: string;
  is_primary: number;
}

export interface CreateGameInput {
  title: string;
  slug: string;
  coverImageUrl?: string | null;
  screenshots?: string[];
  description?: string | null;
  shortDescription?: string | null;
  developer?: string | null;
  publisher?: string | null;
  releaseDate?: string | null;
  genres?: string[];
  tags?: string[];
  metacriticScore?: number | null;
  metacriticUrl?: string | null;
  steamRating?: number | null;
  steamRatingCount?: number | null;
  steamAppId?: number | null;
  playtimeMinutes?: number;
}

export interface GameWithPlatforms extends GameRow {
  platforms: GamePlatformRow[];
}

export function createSlug(title: string, suffix?: string | number): string {
  let slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  if (suffix !== undefined) {
    slug = `${slug}-${suffix}`;
  }

  return slug;
}

export function getUniqueSlug(title: string, steamAppId?: number | null): string {
  const db = getDatabase();
  const baseSlug = createSlug(title);

  // Check if slug exists
  const existingStmt = db.prepare('SELECT id FROM games WHERE slug = ?');
  const existing = existingStmt.get(baseSlug);

  if (!existing) {
    return baseSlug;
  }

  // Slug exists, append steamAppId or incrementing number
  if (steamAppId) {
    return createSlug(title, steamAppId);
  }

  // Find next available number
  let counter = 2;
  while (true) {
    const numberedSlug = createSlug(title, counter);
    const check = existingStmt.get(numberedSlug);
    if (!check) {
      return numberedSlug;
    }
    counter++;
  }
}

export function insertGame(input: CreateGameInput): number {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT INTO games (
      title, slug, cover_image_url, screenshots, description, short_description,
      developer, publisher, release_date, genres, tags,
      metacritic_score, metacritic_url, steam_rating, steam_rating_count,
      steam_app_id, playtime_minutes
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const result = stmt.run(
    input.title,
    input.slug,
    input.coverImageUrl ?? null,
    JSON.stringify(input.screenshots ?? []),
    input.description ?? null,
    input.shortDescription ?? null,
    input.developer ?? null,
    input.publisher ?? null,
    input.releaseDate ?? null,
    JSON.stringify(input.genres ?? []),
    JSON.stringify(input.tags ?? []),
    input.metacriticScore ?? null,
    input.metacriticUrl ?? null,
    input.steamRating ?? null,
    input.steamRatingCount ?? null,
    input.steamAppId ?? null,
    input.playtimeMinutes ?? 0
  );

  return Number(result.lastInsertRowid);
}

export function upsertGameBySteamAppId(input: CreateGameInput): number {
  const db = getDatabase();

  // Check if game exists
  const existingStmt = db.prepare('SELECT id FROM games WHERE steam_app_id = ?');
  const existing = existingStmt.get(input.steamAppId ?? null) as { id: number } | undefined;

  if (existing) {
    // Update existing game
    const updateStmt = db.prepare(`
      UPDATE games SET
        title = ?, cover_image_url = ?, screenshots = ?, description = ?,
        short_description = ?, developer = ?, publisher = ?, release_date = ?,
        genres = ?, tags = ?, metacritic_score = ?, metacritic_url = ?,
        steam_rating = ?, steam_rating_count = ?, playtime_minutes = ?,
        updated_at = datetime('now')
      WHERE id = ?
    `);

    updateStmt.run(
      input.title,
      input.coverImageUrl ?? null,
      JSON.stringify(input.screenshots ?? []),
      input.description ?? null,
      input.shortDescription ?? null,
      input.developer ?? null,
      input.publisher ?? null,
      input.releaseDate ?? null,
      JSON.stringify(input.genres ?? []),
      JSON.stringify(input.tags ?? []),
      input.metacriticScore ?? null,
      input.metacriticUrl ?? null,
      input.steamRating ?? null,
      input.steamRatingCount ?? null,
      input.playtimeMinutes ?? 0,
      existing.id
    );

    return existing.id;
  } else {
    return insertGame(input);
  }
}

export function addGamePlatform(
  gameId: number,
  platformType: string,
  platformGameId: string,
  isPrimary: boolean = false
): void {
  const db = getDatabase();

  const stmt = db.prepare(`
    INSERT OR REPLACE INTO game_platforms (game_id, platform_type, platform_game_id, is_primary)
    VALUES (?, ?, ?, ?)
  `);

  stmt.run(gameId, platformType, platformGameId, isPrimary ? 1 : 0);
}

export function getGameById(id: number): GameWithPlatforms | null {
  const db = getDatabase();

  const gameStmt = db.prepare('SELECT * FROM games WHERE id = ?');
  const game = gameStmt.get(id) as GameRow | undefined;

  if (!game) return null;

  const platformsStmt = db.prepare('SELECT * FROM game_platforms WHERE game_id = ?');
  const platforms = platformsStmt.all(id) as unknown as GamePlatformRow[];

  return { ...game, platforms };
}

export function getGameBySteamAppId(steamAppId: number): GameWithPlatforms | null {
  const db = getDatabase();

  const gameStmt = db.prepare('SELECT * FROM games WHERE steam_app_id = ?');
  const game = gameStmt.get(steamAppId) as GameRow | undefined;

  if (!game) return null;

  const platformsStmt = db.prepare('SELECT * FROM game_platforms WHERE game_id = ?');
  const platforms = platformsStmt.all(game.id) as unknown as GamePlatformRow[];

  return { ...game, platforms };
}

export interface GameQueryOptions {
  platform?: string;
  genre?: string;
  tag?: string;
  search?: string;
  sortBy?: 'title' | 'release_date' | 'metacritic_score' | 'created_at';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export function getAllGames(options: GameQueryOptions = {}): { games: GameRow[]; total: number } {
  const db = getDatabase();

  const conditions: string[] = [];
  const params: (string | number)[] = [];

  if (options.search) {
    conditions.push('title LIKE ?');
    params.push(`%${options.search}%`);
  }

  if (options.genre) {
    conditions.push("genres LIKE ?");
    params.push(`%"${options.genre}"%`);
  }

  if (options.tag) {
    conditions.push("tags LIKE ?");
    params.push(`%"${options.tag}"%`);
  }

  if (options.platform) {
    conditions.push(`
      id IN (SELECT game_id FROM game_platforms WHERE platform_type = ?)
    `);
    params.push(options.platform);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  // Get total count
  const countStmt = db.prepare(`SELECT COUNT(*) as count FROM games ${whereClause}`);
  const countResult = countStmt.get(...params) as { count: number };

  // Get games
  const sortBy = options.sortBy || 'title';
  const sortOrder = options.sortOrder || 'asc';
  const limit = options.limit || 50;
  const offset = options.offset || 0;

  const gamesStmt = db.prepare(`
    SELECT * FROM games ${whereClause}
    ORDER BY ${sortBy} ${sortOrder}
    LIMIT ? OFFSET ?
  `);

  const games = gamesStmt.all(...params, limit, offset) as unknown as GameRow[];

  return { games, total: countResult.count };
}

export function getGameCount(): number {
  const db = getDatabase();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM games');
  const result = stmt.get() as { count: number };
  return result.count;
}

export function deleteGame(id: number): boolean {
  const db = getDatabase();
  const stmt = db.prepare('DELETE FROM games WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

export function clearAllGames(): void {
  const db = getDatabase();
  db.exec('DELETE FROM game_platforms');
  db.exec('DELETE FROM games');
}
