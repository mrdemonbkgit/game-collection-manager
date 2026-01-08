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

export function removeGamePlatform(gameId: number, platformType: string): boolean {
  const db = getDatabase();

  const stmt = db.prepare(`
    DELETE FROM game_platforms WHERE game_id = ? AND platform_type = ?
  `);

  const result = stmt.run(gameId, platformType);
  return result.changes > 0;
}

export function getGamesByPlatform(
  platformType: string
): Array<{ id: number; title: string; platformId: number }> {
  const db = getDatabase();

  const stmt = db.prepare(`
    SELECT g.id, g.title, gp.id as platformId
    FROM games g
    JOIN game_platforms gp ON g.id = gp.game_id
    WHERE gp.platform_type = ?
    ORDER BY g.title
  `);

  return stmt.all(platformType) as Array<{ id: number; title: string; platformId: number }>;
}

export function deleteOrphanedGames(): number {
  const db = getDatabase();

  // Find and delete games with no platform associations
  const stmt = db.prepare(`
    DELETE FROM games
    WHERE id IN (
      SELECT g.id FROM games g
      LEFT JOIN game_platforms gp ON g.id = gp.game_id
      WHERE gp.id IS NULL
    )
  `);

  const result = stmt.run();
  return Number(result.changes);
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

export function getGameBySlug(slug: string): GameWithPlatforms | null {
  const db = getDatabase();

  const gameStmt = db.prepare('SELECT * FROM games WHERE slug = ?');
  const game = gameStmt.get(slug) as GameRow | undefined;

  if (!game) return null;

  const platformsStmt = db.prepare('SELECT * FROM game_platforms WHERE game_id = ?');
  const platforms = platformsStmt.all(game.id) as unknown as GamePlatformRow[];

  return { ...game, platforms };
}

/**
 * Get platforms for multiple games at once (efficient batch query)
 */
export function getPlatformsForGames(gameIds: number[]): Map<number, GamePlatformRow[]> {
  if (gameIds.length === 0) return new Map();

  const db = getDatabase();
  const placeholders = gameIds.map(() => '?').join(',');
  const stmt = db.prepare(`SELECT * FROM game_platforms WHERE game_id IN (${placeholders})`);
  const platforms = stmt.all(...gameIds) as unknown as GamePlatformRow[];

  // Group platforms by game_id
  const platformMap = new Map<number, GamePlatformRow[]>();
  for (const platform of platforms) {
    const existing = platformMap.get(platform.game_id) || [];
    existing.push(platform);
    platformMap.set(platform.game_id, existing);
  }

  return platformMap;
}

/**
 * Find a game by title (case-insensitive match)
 * Used for matching imported games with existing ones
 */
export function getGameByTitle(title: string): GameRow | null {
  const db = getDatabase();

  // Try exact match first (case-insensitive)
  const exactStmt = db.prepare('SELECT * FROM games WHERE LOWER(title) = LOWER(?)');
  const exactMatch = exactStmt.get(title) as GameRow | undefined;

  if (exactMatch) return exactMatch;

  // Try normalized match (remove special characters)
  const normalizedTitle = title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
  const allGames = db.prepare('SELECT * FROM games').all() as unknown as GameRow[];

  for (const game of allGames) {
    const normalizedGameTitle = game.title.toLowerCase().replace(/[^a-z0-9\s]/g, '').trim();
    if (normalizedGameTitle === normalizedTitle) {
      return game;
    }
  }

  return null;
}

export interface GameQueryOptions {
  platform?: string;
  platforms?: string[];  // Multi-select support
  genre?: string;
  genres?: string[];     // Multi-select support
  tag?: string;
  search?: string;
  collectionIds?: number[];  // Filter by collection IDs (multi-select)
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

  // Support both singular (genre) and plural (genres) params
  const genreList = options.genres?.length ? options.genres : (options.genre ? [options.genre] : []);
  if (genreList.length > 0) {
    const genreConditions = genreList.map(() => "genres LIKE ?");
    conditions.push(`(${genreConditions.join(' OR ')})`);
    genreList.forEach(g => params.push(`%"${g}"%`));
  }

  if (options.tag) {
    conditions.push("tags LIKE ?");
    params.push(`%"${options.tag}"%`);
  }

  // Support both singular (platform) and plural (platforms) params
  const platformList = options.platforms?.length ? options.platforms : (options.platform ? [options.platform] : []);
  if (platformList.length > 0) {
    const placeholders = platformList.map(() => '?').join(', ');
    conditions.push(`
      id IN (SELECT game_id FROM game_platforms WHERE platform_type IN (${placeholders}))
    `);
    platformList.forEach(p => params.push(p));
  }

  // Collection filtering
  if (options.collectionIds && options.collectionIds.length > 0) {
    const placeholders = options.collectionIds.map(() => '?').join(', ');
    conditions.push(`
      id IN (SELECT game_id FROM collection_games WHERE collection_id IN (${placeholders}))
    `);
    options.collectionIds.forEach(id => params.push(id));
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

// Genre cache with 1 hour TTL
let genreCache: { genres: string[]; timestamp: number } | null = null;
const GENRE_CACHE_TTL = 60 * 60 * 1000; // 1 hour

export function getDistinctGenres(): string[] {
  // Check cache first
  if (genreCache && Date.now() - genreCache.timestamp < GENRE_CACHE_TTL) {
    return genreCache.genres;
  }

  const db = getDatabase();
  const stmt = db.prepare("SELECT genres FROM games WHERE genres != '[]'");
  const rows = stmt.all() as { genres: string }[];

  // Extract unique genres from JSON arrays
  const genreSet = new Set<string>();
  for (const row of rows) {
    try {
      const parsed = JSON.parse(row.genres) as string[];
      parsed.forEach(g => genreSet.add(g));
    } catch {
      // Skip invalid JSON
    }
  }

  // Sort alphabetically
  const genres = Array.from(genreSet).sort((a, b) => a.localeCompare(b));

  // Update cache
  genreCache = { genres, timestamp: Date.now() };

  return genres;
}

export function clearGenreCache(): void {
  genreCache = null;
}

export function getDistinctPlatforms(): string[] {
  const db = getDatabase();
  const stmt = db.prepare('SELECT DISTINCT platform_type FROM game_platforms ORDER BY platform_type');
  const rows = stmt.all() as { platform_type: string }[];
  return rows.map(r => r.platform_type);
}

/**
 * Get all games that don't have genre data (genres = '[]')
 */
export function getGamesWithoutGenres(): Array<{ id: number; steamAppId: number; title: string }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, steam_app_id as steamAppId, title
    FROM games
    WHERE genres = '[]' AND steam_app_id IS NOT NULL
  `);
  return stmt.all() as Array<{ id: number; steamAppId: number; title: string }>;
}

/**
 * Update genres and tags for a game by Steam App ID
 */
export function updateGameMetadata(
  steamAppId: number,
  genres: string[],
  tags: string[]
): boolean {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE games
    SET genres = ?, tags = ?, updated_at = datetime('now')
    WHERE steam_app_id = ?
  `);
  const result = stmt.run(JSON.stringify(genres), JSON.stringify(tags), steamAppId);
  return result.changes > 0;
}

// Acronyms that should stay uppercase
const GENRE_ACRONYMS = new Set(['RPG', 'MMO', 'MMORPG', 'FPS', 'RTS', 'VR', 'AR', 'PVP', 'PVE', 'DLC']);

function normalizeGenreString(genre: string): string {
  return genre
    .split(' ')
    .map((word) => {
      const upper = word.toUpperCase();
      if (GENRE_ACRONYMS.has(upper)) {
        return upper;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Get all games that don't have cover images
 */
export function getGamesWithoutCovers(): Array<{ id: number; title: string; steamAppId: number | null }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, title, steam_app_id as steamAppId
    FROM games
    WHERE cover_image_url IS NULL
    ORDER BY title
  `);
  return stmt.all() as Array<{ id: number; title: string; steamAppId: number | null }>;
}

/**
 * Get all games with horizontal (header.jpg) covers
 */
export function getGamesWithHorizontalCovers(): Array<{ id: number; title: string; steamAppId: number | null }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, title, steam_app_id as steamAppId
    FROM games
    WHERE cover_image_url LIKE '%header.jpg%'
    ORDER BY title
  `);
  return stmt.all() as Array<{ id: number; title: string; steamAppId: number | null }>;
}

/**
 * Update cover image URL for a game
 */
export function updateGameCover(gameId: number, coverUrl: string, steamAppId?: number): boolean {
  const db = getDatabase();

  if (steamAppId) {
    // Check if this steam_app_id is already used by another game
    const existingStmt = db.prepare('SELECT id FROM games WHERE steam_app_id = ? AND id != ?');
    const existing = existingStmt.get(steamAppId, gameId);

    if (existing) {
      // Steam ID already in use - only update cover, not steam_app_id
      const stmt = db.prepare(`
        UPDATE games
        SET cover_image_url = ?, updated_at = datetime('now')
        WHERE id = ?
      `);
      const result = stmt.run(coverUrl, gameId);
      return result.changes > 0;
    }

    const stmt = db.prepare(`
      UPDATE games
      SET cover_image_url = ?, steam_app_id = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    const result = stmt.run(coverUrl, steamAppId, gameId);
    return result.changes > 0;
  } else {
    const stmt = db.prepare(`
      UPDATE games
      SET cover_image_url = ?, updated_at = datetime('now')
      WHERE id = ?
    `);
    const result = stmt.run(coverUrl, gameId);
    return result.changes > 0;
  }
}

/**
 * Normalize all genre strings in the database to consistent Title Case
 */
export function normalizeAllGenres(): number {
  const db = getDatabase();

  // Get all games with genres
  const selectStmt = db.prepare("SELECT id, genres FROM games WHERE genres != '[]'");
  const rows = selectStmt.all() as { id: number; genres: string }[];

  const updateStmt = db.prepare("UPDATE games SET genres = ? WHERE id = ?");

  let updated = 0;
  for (const row of rows) {
    try {
      const genres = JSON.parse(row.genres) as string[];
      const normalized = genres.map(normalizeGenreString);

      const newJson = JSON.stringify(normalized);
      if (newJson !== row.genres) {
        updateStmt.run(newJson, row.id);
        updated++;
      }
    } catch {
      // Skip invalid JSON
    }
  }

  // Clear genre cache
  clearGenreCache();

  return updated;
}
