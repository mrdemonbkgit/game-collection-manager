/**
 * Catalog Import Service
 *
 * Handles importing subscription catalog JSON files (Game Pass, EA Play, Ubisoft+)
 * with duplicate detection and game matching.
 */

import {
  getGameBySteamAppId,
  getGameByTitle,
  insertGame,
  addGamePlatform,
  removeGamePlatform,
  getGamesByPlatform,
  deleteOrphanedGames,
  getUniqueSlug,
  type CreateGameInput,
} from '../db/repositories/gameRepository.js';

// Supported platform types
export type CatalogPlatform = 'gamepass' | 'eaplay' | 'ubisoftplus';

// Single game entry in the catalog JSON
export interface CatalogGameEntry {
  title: string;
  external_id?: string; // Platform-specific ID
  steam_app_id?: number | null;
  release_date?: string | null;
  developer?: string | null;
  publisher?: string | null;
  genres?: string[];
  description?: string | null;
  cover_url?: string | null;
}

// Full catalog import format
export interface CatalogImport {
  platform: CatalogPlatform;
  updated?: string;
  source?: string;
  games: CatalogGameEntry[];
}

// Import result for a single game
export interface GameImportResult {
  title: string;
  status: 'added' | 'linked' | 'error';
  gameId?: number;
  error?: string;
}

// Overall import result
export interface ImportResult {
  platform: CatalogPlatform;
  total: number;
  added: number;
  linked: number;
  errors: number;
  details: GameImportResult[];
}

/**
 * Validate the catalog import format
 */
export function validateCatalog(data: unknown): CatalogImport {
  if (!data || typeof data !== 'object') {
    throw new Error('Invalid catalog format: expected object');
  }

  const catalog = data as Record<string, unknown>;

  if (!catalog.platform || typeof catalog.platform !== 'string') {
    throw new Error('Invalid catalog format: missing or invalid platform');
  }

  const validPlatforms: CatalogPlatform[] = ['gamepass', 'eaplay', 'ubisoftplus'];
  if (!validPlatforms.includes(catalog.platform as CatalogPlatform)) {
    throw new Error(
      `Invalid platform: ${catalog.platform}. Must be one of: ${validPlatforms.join(', ')}`
    );
  }

  if (!Array.isArray(catalog.games)) {
    throw new Error('Invalid catalog format: games must be an array');
  }

  // Validate each game entry
  for (let i = 0; i < catalog.games.length; i++) {
    const game = catalog.games[i];
    if (!game || typeof game !== 'object') {
      throw new Error(`Invalid game at index ${i}: expected object`);
    }
    if (!game.title || typeof game.title !== 'string') {
      throw new Error(`Invalid game at index ${i}: missing or invalid title`);
    }
  }

  return {
    platform: catalog.platform as CatalogPlatform,
    updated: catalog.updated as string | undefined,
    source: catalog.source as string | undefined,
    games: catalog.games as CatalogGameEntry[],
  };
}

/**
 * Generate a platform_game_id for a game
 * Uses external_id if provided, otherwise generates from platform-slug
 */
function generatePlatformGameId(
  platform: CatalogPlatform,
  externalId: string | undefined,
  slug: string
): string {
  if (externalId) {
    return externalId;
  }
  return `${platform}-${slug}`;
}

/**
 * Import a catalog of games from a subscription service
 *
 * Import Logic:
 * 1. For each game in JSON:
 *    - Try to match by steam_app_id (if provided)
 *    - Try to match by title (case-insensitive, normalized)
 *    - If match found: Add platform to existing game (linked)
 *    - If no match: Create new game (added)
 * 2. Return summary: { total, added, linked, errors }
 */
export function importCatalog(catalog: CatalogImport): ImportResult {
  const result: ImportResult = {
    platform: catalog.platform,
    total: catalog.games.length,
    added: 0,
    linked: 0,
    errors: 0,
    details: [],
  };

  for (const entry of catalog.games) {
    try {
      const importResult = importSingleGame(catalog.platform, entry);
      result.details.push(importResult);

      if (importResult.status === 'added') {
        result.added++;
      } else if (importResult.status === 'linked') {
        result.linked++;
      } else {
        result.errors++;
      }
    } catch (error) {
      result.errors++;
      result.details.push({
        title: entry.title,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

/**
 * Import a single game from a catalog entry
 */
function importSingleGame(
  platform: CatalogPlatform,
  entry: CatalogGameEntry
): GameImportResult {
  // Try to find existing game by Steam App ID
  if (entry.steam_app_id) {
    const existingBySteam = getGameBySteamAppId(entry.steam_app_id);
    if (existingBySteam) {
      // Game exists - link to platform
      const platformGameId = generatePlatformGameId(
        platform,
        entry.external_id,
        existingBySteam.slug
      );
      addGamePlatform(existingBySteam.id, platform, platformGameId, false);
      return {
        title: entry.title,
        status: 'linked',
        gameId: existingBySteam.id,
      };
    }
  }

  // Try to find existing game by title
  const existingByTitle = getGameByTitle(entry.title);
  if (existingByTitle) {
    // Game exists - link to platform
    const platformGameId = generatePlatformGameId(
      platform,
      entry.external_id,
      existingByTitle.slug
    );
    addGamePlatform(existingByTitle.id, platform, platformGameId, false);
    return {
      title: entry.title,
      status: 'linked',
      gameId: existingByTitle.id,
    };
  }

  // Game doesn't exist - create new game
  const slug = getUniqueSlug(entry.title, entry.steam_app_id);
  const platformGameId = generatePlatformGameId(platform, entry.external_id, slug);

  const gameInput: CreateGameInput = {
    title: entry.title,
    slug,
    coverImageUrl: entry.cover_url ?? null,
    description: entry.description ?? null,
    developer: entry.developer ?? null,
    publisher: entry.publisher ?? null,
    releaseDate: entry.release_date ?? null,
    genres: entry.genres ?? [],
    steamAppId: entry.steam_app_id ?? null,
  };

  const gameId = insertGame(gameInput);

  // Add platform link
  addGamePlatform(gameId, platform, platformGameId, true);

  return {
    title: entry.title,
    status: 'added',
    gameId,
  };
}

// Sync result for catalog sync operation
export interface SyncResult {
  platform: CatalogPlatform;
  removed: number;
  orphanedDeleted: number;
  remaining: number;
  removedGames: string[];
}

/**
 * Sync a catalog - removes platform association from games not in the catalog
 *
 * This ensures only games in the provided catalog are marked for that platform.
 * Games that exist on other platforms (e.g., Steam) will keep those associations.
 * Games that become orphaned (no platforms) will be deleted.
 */
export function syncCatalog(catalog: CatalogImport): SyncResult {
  const platform = catalog.platform;

  // Build a set of catalog titles (lowercase for comparison)
  const catalogTitles = new Set(
    catalog.games.map(g => g.title.toLowerCase())
  );

  // Get all games currently marked with this platform
  const currentGames = getGamesByPlatform(platform);

  // Find games to remove (not in catalog)
  const toRemove = currentGames.filter(
    g => !catalogTitles.has(g.title.toLowerCase())
  );

  const removedGames: string[] = [];

  // Remove platform association from games not in catalog
  for (const game of toRemove) {
    removeGamePlatform(game.id, platform);
    removedGames.push(game.title);
  }

  // Delete any games that are now orphaned (no platform associations)
  const orphanedDeleted = deleteOrphanedGames();

  // Get remaining count
  const remaining = getGamesByPlatform(platform).length;

  return {
    platform,
    removed: toRemove.length,
    orphanedDeleted,
    remaining,
    removedGames,
  };
}
