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
  steamgrid_id: number | null;
  hero_url: string | null;
  logo_url: string | null;
  assets_checked_at: string | null;
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

/**
 * Update Steam rating data for a game
 */
export function updateGameSteamRating(
  steamAppId: number,
  rating: number,
  ratingCount: number
): boolean {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE games
    SET steam_rating = ?, steam_rating_count = ?, updated_at = datetime('now')
    WHERE steam_app_id = ?
  `);
  const result = stmt.run(rating, ratingCount, steamAppId);
  return result.changes > 0;
}

/**
 * Get all games with Steam App IDs that are missing ratings
 */
export function getGamesWithoutRatings(): Array<{ id: number; steamAppId: number; title: string }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, steam_app_id as steamAppId, title
    FROM games
    WHERE steam_app_id IS NOT NULL AND steam_rating IS NULL
    ORDER BY title
  `);
  return stmt.all() as Array<{ id: number; steamAppId: number; title: string }>;
}

/**
 * Get all games with Steam App IDs (for full ratings sync)
 */
export function getAllSteamGames(): Array<{ id: number; steamAppId: number; title: string }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, steam_app_id as steamAppId, title
    FROM games
    WHERE steam_app_id IS NOT NULL
    ORDER BY title
  `);
  return stmt.all() as Array<{ id: number; steamAppId: number; title: string }>;
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

/**
 * Get cached SteamGridDB assets for a game
 */
export interface CachedAssets {
  steamgridId: number | null;
  heroUrl: string | null;
  logoUrl: string | null;
  assetsCheckedAt: string | null;
}

export function getCachedAssets(gameId: number): CachedAssets {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT steamgrid_id, hero_url, logo_url, assets_checked_at
    FROM games WHERE id = ?
  `);
  const row = stmt.get(gameId) as {
    steamgrid_id: number | null;
    hero_url: string | null;
    logo_url: string | null;
    assets_checked_at: string | null;
  } | undefined;

  if (!row) {
    return { steamgridId: null, heroUrl: null, logoUrl: null, assetsCheckedAt: null };
  }

  return {
    steamgridId: row.steamgrid_id,
    heroUrl: row.hero_url,
    logoUrl: row.logo_url,
    assetsCheckedAt: row.assets_checked_at,
  };
}

/**
 * Update SteamGridDB assets for a game
 */
export interface UpdateAssetsInput {
  steamgridId?: number | null;
  heroUrl?: string | null;
  logoUrl?: string | null;
}

export function updateGameAssets(gameId: number, assets: UpdateAssetsInput): boolean {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE games SET
      steamgrid_id = COALESCE(?, steamgrid_id),
      hero_url = COALESCE(?, hero_url),
      logo_url = COALESCE(?, logo_url),
      assets_checked_at = datetime('now'),
      updated_at = datetime('now')
    WHERE id = ?
  `);
  const result = stmt.run(
    assets.steamgridId ?? null,
    assets.heroUrl ?? null,
    assets.logoUrl ?? null,
    gameId
  );
  return result.changes > 0;
}

/**
 * Mark a game's assets as checked (even if not found) to avoid re-querying
 */
export function markAssetsChecked(gameId: number): boolean {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE games SET
      assets_checked_at = datetime('now'),
      updated_at = datetime('now')
    WHERE id = ?
  `);
  const result = stmt.run(gameId);
  return result.changes > 0;
}

/**
 * Get similar games based on shared genres and tags
 */
export function getSimilarGames(
  excludeId: number,
  genres: string[],
  tags: string[],
  limit: number = 10
): GameRow[] {
  const db = getDatabase();

  if (genres.length === 0 && tags.length === 0) {
    return [];
  }

  // Build conditions for genre and tag matching
  // SQLite doesn't have array contains, so we use LIKE with JSON
  const conditions: string[] = [];
  const likePatterns: string[] = [];

  // Add genre conditions
  for (const genre of genres) {
    conditions.push("genres LIKE ?");
    likePatterns.push(`%"${genre}"%`);
  }

  // Add tag conditions
  for (const tag of tags) {
    conditions.push("tags LIKE ?");
    likePatterns.push(`%"${tag}"%`);
  }

  // Query: find games that match any genre or tag, exclude current game
  // Order by number of matches (more matches = more similar)
  // Note: CASE expressions and WHERE both need the same LIKE patterns,
  // so we duplicate the params for each set of placeholders
  const matchExpressions = conditions.map(c => `CASE WHEN ${c} THEN 1 ELSE 0 END`).join(' + ');

  const sql = `
    SELECT *, (${matchExpressions}) as match_count
    FROM games
    WHERE id != ? AND (${conditions.join(' OR ')})
    ORDER BY match_count DESC, title ASC
    LIMIT ?
  `;

  // Build full params array:
  // 1. Params for CASE expressions (likePatterns)
  // 2. excludeId for WHERE id != ?
  // 3. Params for WHERE conditions (likePatterns again)
  // 4. limit for LIMIT ?
  const params: (string | number)[] = [
    ...likePatterns,     // for CASE expressions
    excludeId,           // for id != ?
    ...likePatterns,     // for WHERE conditions
    limit,               // for LIMIT
  ];

  return db.prepare(sql).all(...params) as unknown as GameRow[];
}

// ============================================================================
// Extended Steam Metadata Types and Functions
// ============================================================================

/**
 * Extended Steam metadata input for updating existing games
 * Uses COALESCE pattern - only provided fields will be updated
 */
export interface SteamMetadataInput {
  // Basic info
  gameType?: string; // game/dlc/demo/mod
  requiredAge?: number;
  isFree?: boolean;
  controllerSupport?: string | null;
  supportedLanguages?: string | null;

  // Links
  website?: string | null;
  backgroundUrl?: string | null;

  // Platform support (JSON object)
  platforms?: { windows?: boolean; mac?: boolean; linux?: boolean } | null;

  // Requirements (JSON objects)
  pcRequirements?: { minimum?: string; recommended?: string } | null;
  macRequirements?: { minimum?: string; recommended?: string } | null;
  linuxRequirements?: { minimum?: string; recommended?: string } | null;

  // Media
  movies?: Array<{ name: string; thumbnail: string; mp4Url?: string; webmUrl?: string }> | null;

  // Stats
  recommendationsTotal?: number | null;
  achievementsTotal?: number | null;

  // Reviews (extended)
  reviewScore?: number | null;
  reviewScoreDesc?: string | null;
  reviewsPositive?: number | null;
  reviewsNegative?: number | null;

  // Pricing
  priceCurrency?: string | null;
  priceInitial?: number | null;
  priceFinal?: number | null;
  priceDiscountPercent?: number | null;

  // Content
  contentDescriptors?: number[] | null;
  dlcAppIds?: number[] | null;

  // Timestamps
  lastPlayedAt?: string | null;
}

/**
 * Update Steam metadata for a game using COALESCE pattern
 * Only updates fields that are explicitly provided (not undefined)
 * Preserves existing values for fields not provided
 */
export function updateSteamMetadata(steamAppId: number, input: SteamMetadataInput): boolean {
  const db = getDatabase();

  // Build dynamic SET clause - only include fields that are provided
  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  // Helper to add a field update only if the value is provided
  const addField = (column: string, value: unknown, transform?: (v: unknown) => string | number | null) => {
    if (value !== undefined) {
      updates.push(`${column} = ?`);
      const transformed = transform ? transform(value) : value;
      params.push(transformed as string | number | null);
    }
  };

  // Basic info
  addField('game_type', input.gameType);
  addField('required_age', input.requiredAge);
  addField('is_free', input.isFree, (v) => (v ? 1 : 0));
  addField('controller_support', input.controllerSupport);
  addField('supported_languages', input.supportedLanguages);

  // Links
  addField('website', input.website);
  addField('background_url', input.backgroundUrl);

  // Platform support
  addField('platforms', input.platforms, (v) => JSON.stringify(v ?? {}));

  // Requirements
  addField('pc_requirements', input.pcRequirements, (v) => JSON.stringify(v ?? {}));
  addField('mac_requirements', input.macRequirements, (v) => JSON.stringify(v ?? {}));
  addField('linux_requirements', input.linuxRequirements, (v) => JSON.stringify(v ?? {}));

  // Media
  addField('movies', input.movies, (v) => JSON.stringify(v ?? []));

  // Stats
  addField('recommendations_total', input.recommendationsTotal);
  addField('achievements_total', input.achievementsTotal);

  // Reviews
  addField('review_score', input.reviewScore);
  addField('review_score_desc', input.reviewScoreDesc);
  addField('reviews_positive', input.reviewsPositive);
  addField('reviews_negative', input.reviewsNegative);

  // Pricing
  addField('price_currency', input.priceCurrency);
  addField('price_initial', input.priceInitial);
  addField('price_final', input.priceFinal);
  addField('price_discount_percent', input.priceDiscountPercent);

  // Content
  addField('content_descriptors', input.contentDescriptors, (v) => JSON.stringify(v ?? []));
  addField('dlc_app_ids', input.dlcAppIds, (v) => JSON.stringify(v ?? []));

  // Timestamps
  addField('last_played_at', input.lastPlayedAt);

  // Always update steam_data_updated_at and updated_at
  updates.push('steam_data_updated_at = datetime(\'now\')');
  updates.push('updated_at = datetime(\'now\')');

  if (updates.length === 2) {
    // Only timestamps, no real updates
    return false;
  }

  params.push(steamAppId);

  const sql = `UPDATE games SET ${updates.join(', ')} WHERE steam_app_id = ?`;
  const result = db.prepare(sql).run(...params);

  return result.changes > 0;
}

/**
 * Get games missing extended Steam metadata (for incremental sync)
 */
export function getGamesWithoutSteamMetadata(): Array<{ id: number; steamAppId: number; title: string }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, steam_app_id as steamAppId, title
    FROM games
    WHERE steam_app_id IS NOT NULL AND steam_data_updated_at IS NULL
    ORDER BY title
  `);
  return stmt.all() as Array<{ id: number; steamAppId: number; title: string }>;
}

// ============================================================================
// IGDB Metadata Functions
// ============================================================================

/**
 * IGDB metadata input type - matches IGDBMetadataInput from igdbService
 */
export interface IGDBMetadataInput {
  igdbId: number;
  igdbSlug: string | null;
  igdbRating: number | null;
  igdbRatingCount: number | null;
  igdbAggregatedRating: number | null;
  igdbAggregatedRatingCount: number | null;
  igdbTotalRating: number | null;
  storyline: string | null;
  themes: string[];
  gameModes: string[];
  playerPerspectives: string[];
  igdbGenres: string[];
  igdbPlatforms: string[];
  igdbSummary: string | null;
  igdbMatchConfidence: number | null;
}

/**
 * Update IGDB metadata for a game
 * Uses COALESCE pattern - only updates fields that are provided and non-null
 */
export function updateIGDBMetadata(gameId: number, input: IGDBMetadataInput): boolean {
  const db = getDatabase();
  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  // Helper to add field only if provided (not undefined)
  const addField = (column: string, value: unknown, transform?: (v: unknown) => string | number | null) => {
    if (value !== undefined) {
      updates.push(`${column} = ?`);
      const transformed = transform ? transform(value) : value;
      params.push(transformed as string | number | null);
    }
  };

  // IGDB identifiers (always update these)
  addField('igdb_id', input.igdbId);
  addField('igdb_slug', input.igdbSlug);
  addField('igdb_match_confidence', input.igdbMatchConfidence);

  // Ratings
  addField('igdb_rating', input.igdbRating);
  addField('igdb_rating_count', input.igdbRatingCount);
  addField('igdb_aggregated_rating', input.igdbAggregatedRating);
  addField('igdb_aggregated_rating_count', input.igdbAggregatedRatingCount);
  addField('igdb_total_rating', input.igdbTotalRating);

  // Content
  addField('storyline', input.storyline);
  addField('igdb_summary', input.igdbSummary);

  // Arrays (stored as JSON)
  addField('themes', input.themes, (v) => JSON.stringify(v ?? []));
  addField('game_modes', input.gameModes, (v) => JSON.stringify(v ?? []));
  addField('player_perspectives', input.playerPerspectives, (v) => JSON.stringify(v ?? []));
  addField('igdb_genres', input.igdbGenres, (v) => JSON.stringify(v ?? []));
  addField('igdb_platforms', input.igdbPlatforms, (v) => JSON.stringify(v ?? []));

  // Always update timestamps
  updates.push('igdb_updated_at = datetime(\'now\')');
  updates.push('updated_at = datetime(\'now\')');

  if (updates.length === 2) {
    // Only timestamps, no real updates
    return false;
  }

  params.push(gameId);

  const sql = `UPDATE games SET ${updates.join(', ')} WHERE id = ?`;
  const result = db.prepare(sql).run(...params);

  return result.changes > 0;
}

/**
 * Get games missing IGDB metadata (for sync)
 * Returns games that don't have an IGDB ID yet
 */
export function getGamesWithoutIGDBMetadata(): Array<{ id: number; steamAppId: number | null; title: string }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, steam_app_id as steamAppId, title
    FROM games
    WHERE igdb_id IS NULL
    ORDER BY title
  `);
  return stmt.all() as Array<{ id: number; steamAppId: number | null; title: string }>;
}

/**
 * Get games with IGDB ID for re-sync
 */
export function getGamesWithIGDBMetadata(): Array<{ id: number; igdbId: number; title: string }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, igdb_id as igdbId, title
    FROM games
    WHERE igdb_id IS NOT NULL
    ORDER BY title
  `);
  return stmt.all() as Array<{ id: number; igdbId: number; title: string }>;
}

/**
 * Get count of games with/without IGDB data
 */
export function getIGDBSyncStats(): { withIGDB: number; withoutIGDB: number; total: number } {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT
      COUNT(CASE WHEN igdb_id IS NOT NULL THEN 1 END) as withIGDB,
      COUNT(CASE WHEN igdb_id IS NULL THEN 1 END) as withoutIGDB,
      COUNT(*) as total
    FROM games
  `).get() as { withIGDB: number; withoutIGDB: number; total: number };
  return result;
}

// ============================================================================
// SteamGridDB Metadata Functions
// ============================================================================

/**
 * SteamGridDB metadata input type for enrichment
 */
export interface SteamGridDBMetadataInput {
  steamgridId?: number;
  steamgridName?: string | null;
  steamgridVerified?: boolean;
  iconUrl?: string | null;
  gridsCount?: number | null;
  heroesCount?: number | null;
  logosCount?: number | null;
  iconsCount?: number | null;
}

/**
 * Update SteamGridDB metadata for a game
 */
export function updateSteamGridDBMetadata(gameId: number, input: SteamGridDBMetadataInput): boolean {
  const db = getDatabase();
  const updates: string[] = [];
  const params: (string | number | null)[] = [];

  const addField = (column: string, value: unknown, transform?: (v: unknown) => string | number | null) => {
    if (value !== undefined) {
      updates.push(`${column} = ?`);
      const transformed = transform ? transform(value) : value;
      params.push(transformed as string | number | null);
    }
  };

  // SteamGridDB identifiers
  addField('steamgrid_id', input.steamgridId);
  addField('steamgrid_name', input.steamgridName);
  addField('steamgrid_verified', input.steamgridVerified, (v) => v ? 1 : 0);

  // Icon
  addField('icon_url', input.iconUrl);

  // Asset counts
  addField('grids_count', input.gridsCount);
  addField('heroes_count', input.heroesCount);
  addField('logos_count', input.logosCount);
  addField('icons_count', input.iconsCount);

  // Always update timestamps
  updates.push('assets_checked_at = datetime(\'now\')');
  updates.push('updated_at = datetime(\'now\')');

  if (updates.length === 2) {
    return false;
  }

  params.push(gameId);

  const sql = `UPDATE games SET ${updates.join(', ')} WHERE id = ?`;
  const result = db.prepare(sql).run(...params);

  return result.changes > 0;
}

/**
 * Get games missing SteamGridDB enrichment (for sync)
 */
export function getGamesWithoutSteamGridDBEnrichment(): Array<{ id: number; steamAppId: number | null; steamgridId: number | null; title: string }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, steam_app_id as steamAppId, steamgrid_id as steamgridId, title
    FROM games
    WHERE grids_count IS NULL
    ORDER BY title
  `);
  return stmt.all() as Array<{ id: number; steamAppId: number | null; steamgridId: number | null; title: string }>;
}

/**
 * Get SteamGridDB sync stats
 */
export function getSteamGridDBSyncStats(): { enriched: number; notEnriched: number; total: number } {
  const db = getDatabase();
  const result = db.prepare(`
    SELECT
      COUNT(CASE WHEN grids_count IS NOT NULL THEN 1 END) as enriched,
      COUNT(CASE WHEN grids_count IS NULL THEN 1 END) as notEnriched,
      COUNT(*) as total
    FROM games
  `).get() as { enriched: number; notEnriched: number; total: number };
  return result;
}

/**
 * Get games with remote screenshots (for downloading locally)
 * Returns games that have screenshots but haven't been downloaded yet
 */
export function getGamesWithScreenshots(): Array<{ id: number; title: string; screenshots: string[] }> {
  const db = getDatabase();
  const stmt = db.prepare(`
    SELECT id, title, screenshots
    FROM games
    WHERE screenshots IS NOT NULL AND screenshots != '[]'
    ORDER BY title
  `);
  const rows = stmt.all() as Array<{ id: number; title: string; screenshots: string }>;
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    screenshots: JSON.parse(row.screenshots) as string[],
  }));
}

/**
 * Get screenshot sync stats
 */
export function getScreenshotSyncStats(): { withScreenshots: number; totalScreenshots: number; total: number } {
  const db = getDatabase();
  const rows = db.prepare(`
    SELECT screenshots FROM games WHERE screenshots IS NOT NULL AND screenshots != '[]'
  `).all() as Array<{ screenshots: string }>;

  let totalScreenshots = 0;
  for (const row of rows) {
    try {
      const arr = JSON.parse(row.screenshots) as string[];
      totalScreenshots += arr.length;
    } catch {
      // Ignore parse errors
    }
  }

  const total = db.prepare('SELECT COUNT(*) as count FROM games').get() as { count: number };

  return {
    withScreenshots: rows.length,
    totalScreenshots,
    total: total.count,
  };
}
