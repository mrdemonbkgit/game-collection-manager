/**
 * SteamGridDB Service
 *
 * Fetches game cover images from SteamGridDB.com
 * Used for games that don't have covers from Steam CDN.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import {
  getGamesWithoutCovers,
  getGamesWithHorizontalCovers,
  updateGameCover,
} from '../db/repositories/gameRepository.js';
import { downloadCover } from './localCoverService.js';

const API_BASE = 'https://www.steamgriddb.com/api/v2';
const RATE_LIMIT_DELAY = 250; // 250ms between requests (4 req/sec)

// Track which SteamGridDB grid IDs have been tried per game
const TRIED_COVERS_FILE = path.resolve(process.cwd(), 'data', 'cover-fix-history.json');

export interface CoverFixHistory {
  [gameId: string]: number[]; // Array of tried SGDB grid IDs
}

function loadTriedCovers(): CoverFixHistory {
  try {
    if (fs.existsSync(TRIED_COVERS_FILE)) {
      return JSON.parse(fs.readFileSync(TRIED_COVERS_FILE, 'utf-8'));
    }
  } catch {
    // Ignore errors, start fresh
  }
  return {};
}

function saveTriedCovers(history: CoverFixHistory): void {
  const dir = path.dirname(TRIED_COVERS_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(TRIED_COVERS_FILE, JSON.stringify(history, null, 2));
}

function addTriedCover(gameId: number, gridId: number): void {
  const history = loadTriedCovers();
  const key = String(gameId);
  if (!history[key]) {
    history[key] = [];
  }
  if (!history[key].includes(gridId)) {
    history[key].push(gridId);
  }
  saveTriedCovers(history);
}

function getTriedCovers(gameId: number): number[] {
  const history = loadTriedCovers();
  return history[String(gameId)] || [];
}

export function clearTriedCovers(gameId: number): void {
  const history = loadTriedCovers();
  delete history[String(gameId)];
  saveTriedCovers(history);
  console.log(`[SteamGridDB] 🗑️ Cleared fix history for game ${gameId}`);
}

export function clearAllTriedCovers(): void {
  saveTriedCovers({});
  console.log(`[SteamGridDB] 🗑️ Cleared all fix history`);
}

export function getCoverFixHistory(): CoverFixHistory {
  return loadTriedCovers();
}

interface SteamGridDBGame {
  id: number;
  name: string;
  types: string[];
  verified: boolean;
}

interface SteamGridDBGrid {
  id: number;
  score: number;
  style: string;
  width: number;
  height: number;
  nsfw: boolean;
  humor: boolean;
  notes: string | null;
  mime: string;
  language: string;
  url: string;
  thumb: string;
  lock: boolean;
  epilepsy: boolean;
  upvotes: number;
  downvotes: number;
  author: {
    name: string;
    steam64: string;
    avatar: string;
  };
}

interface SearchResponse {
  success: boolean;
  data: SteamGridDBGame[];
}

interface GridsResponse {
  success: boolean;
  data: SteamGridDBGrid[];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getApiKey(): string {
  const apiKey = process.env.STEAMGRIDDB_API_KEY;
  if (!apiKey) {
    throw new Error('STEAMGRIDDB_API_KEY environment variable not set');
  }
  return apiKey;
}

/**
 * Normalize a game title for comparison
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, "'")
    .replace(/[®™©]/g, '')
    .replace(/[:\-–—]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9\s']/g, '')
    .trim();
}

/**
 * Check if two titles are a good match
 */
function titlesMatch(title1: string, title2: string): boolean {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);

  if (norm1 === norm2) return true;

  // One contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const shorter = norm1.length < norm2.length ? norm1 : norm2;
    if (shorter.length >= 4) return true;
  }

  // Check word overlap
  const words1 = new Set(norm1.split(' ').filter(w => w.length > 2));
  const words2 = new Set(norm2.split(' ').filter(w => w.length > 2));
  const intersection = [...words1].filter(w => words2.has(w));
  const similarity = intersection.length / Math.max(words1.size, words2.size);

  return similarity >= 0.7;
}

/**
 * Search for a game on SteamGridDB
 */
async function searchGame(title: string): Promise<SteamGridDBGame | null> {
  try {
    const apiKey = getApiKey();
    const searchUrl = `${API_BASE}/search/autocomplete/${encodeURIComponent(title)}`;

    const response = await fetch(searchUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return null;
      }
      console.warn(`SteamGridDB search failed for "${title}": ${response.status}`);
      return null;
    }

    const data = (await response.json()) as SearchResponse;

    if (!data.success || !data.data || data.data.length === 0) {
      return null;
    }

    // Find best match
    for (const game of data.data) {
      if (titlesMatch(title, game.name)) {
        return game;
      }
    }

    // If no exact match, return first result if it's close enough
    const firstResult = data.data[0];
    if (titlesMatch(title, firstResult.name)) {
      return firstResult;
    }

    return null;
  } catch (error) {
    console.warn(`Error searching SteamGridDB for "${title}":`, error);
    return null;
  }
}

/**
 * Get grid images for a game
 */
async function getGrids(gameId: number): Promise<SteamGridDBGrid[]> {
  try {
    const apiKey = getApiKey();
    // Request 600x900 grids (vertical covers) - dimensions parameter
    const gridsUrl = `${API_BASE}/grids/game/${gameId}?dimensions=600x900`;

    const response = await fetch(gridsUrl, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return [];
      }
      console.warn(`SteamGridDB grids failed for game ${gameId}: ${response.status}`);
      return [];
    }

    const data = (await response.json()) as GridsResponse;

    if (!data.success || !data.data) {
      return [];
    }

    return data.data;
  } catch (error) {
    console.warn(`Error getting SteamGridDB grids for game ${gameId}:`, error);
    return [];
  }
}

/**
 * Get the best grid image for a game (prefer high score, non-NSFW, static images)
 * Excludes any grid IDs in the excludeIds array (previously tried covers)
 */
function selectBestGrid(grids: SteamGridDBGrid[], excludeIds: number[] = []): SteamGridDBGrid | null {
  if (grids.length === 0) return null;

  // Filter out NSFW, humor, and previously tried grids
  const excludeSet = new Set(excludeIds);
  const safeGrids = grids
    .filter(g => !g.nsfw && !g.humor && !excludeSet.has(g.id))
    .sort((a, b) => b.score - a.score);

  if (safeGrids.length > 0) {
    return safeGrids[0];
  }

  // Fallback to any grid (excluding tried ones) sorted by score
  const availableGrids = grids
    .filter(g => !excludeSet.has(g.id))
    .sort((a, b) => b.score - a.score);

  if (availableGrids.length > 0) {
    return availableGrids[0];
  }

  // All grids have been tried - return null to indicate no more options
  return null;
}

export interface SteamGridDBProgress {
  total: number;
  completed: number;
  found: number;
  notFound: number;
  currentGame: string;
}

export interface SteamGridDBResult {
  total: number;
  found: number;
  notFound: number;
  details: Array<{
    title: string;
    status: 'found' | 'not_found';
    steamGridDBId?: number;
    steamGridDBName?: string;
    coverUrl?: string;
  }>;
}

/**
 * Fetch covers from SteamGridDB for all games without covers
 */
export async function fetchCoversFromSteamGridDB(
  onProgress?: (progress: SteamGridDBProgress) => void
): Promise<SteamGridDBResult> {
  const gamesWithoutCovers = getGamesWithoutCovers();

  const result: SteamGridDBResult = {
    total: gamesWithoutCovers.length,
    found: 0,
    notFound: 0,
    details: [],
  };

  for (let i = 0; i < gamesWithoutCovers.length; i++) {
    const game = gamesWithoutCovers[i];

    if (onProgress) {
      onProgress({
        total: gamesWithoutCovers.length,
        completed: i,
        found: result.found,
        notFound: result.notFound,
        currentGame: game.title,
      });
    }

    // Rate limit
    if (i > 0) {
      await delay(RATE_LIMIT_DELAY);
    }

    // Search for the game
    const sgdbGame = await searchGame(game.title);

    if (!sgdbGame) {
      result.notFound++;
      result.details.push({
        title: game.title,
        status: 'not_found',
      });
      continue;
    }

    // Get grids for the game
    await delay(RATE_LIMIT_DELAY);
    const grids = await getGrids(sgdbGame.id);

    if (grids.length === 0) {
      result.notFound++;
      result.details.push({
        title: game.title,
        status: 'not_found',
        steamGridDBId: sgdbGame.id,
        steamGridDBName: sgdbGame.name,
      });
      continue;
    }

    // Select best grid
    const bestGrid = selectBestGrid(grids);

    if (bestGrid) {
      updateGameCover(game.id, bestGrid.url);
      result.found++;
      result.details.push({
        title: game.title,
        status: 'found',
        steamGridDBId: sgdbGame.id,
        steamGridDBName: sgdbGame.name,
        coverUrl: bestGrid.url,
      });
    } else {
      result.notFound++;
      result.details.push({
        title: game.title,
        status: 'not_found',
        steamGridDBId: sgdbGame.id,
        steamGridDBName: sgdbGame.name,
      });
    }
  }

  // Final progress update
  if (onProgress) {
    onProgress({
      total: gamesWithoutCovers.length,
      completed: gamesWithoutCovers.length,
      found: result.found,
      notFound: result.notFound,
      currentGame: 'Done',
    });
  }

  return result;
}

/**
 * Fix horizontal covers by fetching vertical ones from SteamGridDB
 */
export async function fixHorizontalCovers(
  onProgress?: (progress: SteamGridDBProgress) => void
): Promise<SteamGridDBResult> {
  const gamesWithHorizontalCovers = getGamesWithHorizontalCovers();

  const result: SteamGridDBResult = {
    total: gamesWithHorizontalCovers.length,
    found: 0,
    notFound: 0,
    details: [],
  };

  for (let i = 0; i < gamesWithHorizontalCovers.length; i++) {
    const game = gamesWithHorizontalCovers[i];

    if (onProgress) {
      onProgress({
        total: gamesWithHorizontalCovers.length,
        completed: i,
        found: result.found,
        notFound: result.notFound,
        currentGame: game.title,
      });
    }

    // Rate limit
    if (i > 0) {
      await delay(RATE_LIMIT_DELAY);
    }

    // Search for the game
    const sgdbGame = await searchGame(game.title);

    if (!sgdbGame) {
      result.notFound++;
      result.details.push({
        title: game.title,
        status: 'not_found',
      });
      continue;
    }

    // Get grids for the game
    await delay(RATE_LIMIT_DELAY);
    const grids = await getGrids(sgdbGame.id);

    if (grids.length === 0) {
      result.notFound++;
      result.details.push({
        title: game.title,
        status: 'not_found',
        steamGridDBId: sgdbGame.id,
        steamGridDBName: sgdbGame.name,
      });
      continue;
    }

    // Select best grid
    const bestGrid = selectBestGrid(grids);

    if (bestGrid) {
      updateGameCover(game.id, bestGrid.url);
      result.found++;
      result.details.push({
        title: game.title,
        status: 'found',
        steamGridDBId: sgdbGame.id,
        steamGridDBName: sgdbGame.name,
        coverUrl: bestGrid.url,
      });
    } else {
      result.notFound++;
      result.details.push({
        title: game.title,
        status: 'not_found',
        steamGridDBId: sgdbGame.id,
        steamGridDBName: sgdbGame.name,
      });
    }
  }

  // Final progress update
  if (onProgress) {
    onProgress({
      total: gamesWithHorizontalCovers.length,
      completed: gamesWithHorizontalCovers.length,
      found: result.found,
      notFound: result.notFound,
      currentGame: 'Done',
    });
  }

  return result;
}

/**
 * Result for fixing a single cover
 */
export interface FixCoverResult {
  success: boolean;
  gameId: number;
  coverUrl?: string;
  error?: string;
  steamGridDBId?: number;
  steamGridDBName?: string;
}

/**
 * Fix a single game's cover by fetching from SteamGridDB
 * Tracks previously tried covers to avoid downloading the same bad cover twice
 */
export async function fixSingleCover(
  gameId: number,
  gameTitle: string,
  searchTerm?: string
): Promise<FixCoverResult> {
  try {
    const searchQuery = searchTerm || gameTitle;
    console.log(`[SteamGridDB] Searching for "${searchQuery}" (gameId: ${gameId})...`);

    // Get list of previously tried grid IDs for this game
    const triedGridIds = getTriedCovers(gameId);
    if (triedGridIds.length > 0) {
      console.log(`[SteamGridDB] Previously tried ${triedGridIds.length} covers for this game`);
    }

    // Search for the game
    const sgdbGame = await searchGame(searchQuery);

    if (!sgdbGame) {
      console.log(`[SteamGridDB] ❌ Not found on SteamGridDB: "${searchQuery}"`);
      return {
        success: false,
        gameId,
        error: `Game not found on SteamGridDB: "${searchQuery}"`,
      };
    }

    console.log(`[SteamGridDB] Found: "${sgdbGame.name}" (SGDB ID: ${sgdbGame.id})`);

    // Get grids for the game
    await delay(RATE_LIMIT_DELAY);
    const grids = await getGrids(sgdbGame.id);
    console.log(`[SteamGridDB] Found ${grids.length} 600x900 grids`);

    if (grids.length === 0) {
      console.log(`[SteamGridDB] ❌ No 600x900 covers available`);
      return {
        success: false,
        gameId,
        error: `No 600x900 covers found for "${sgdbGame.name}"`,
        steamGridDBId: sgdbGame.id,
        steamGridDBName: sgdbGame.name,
      };
    }

    // Select best grid (excluding previously tried ones)
    const bestGrid = selectBestGrid(grids, triedGridIds);

    if (!bestGrid) {
      const availableCount = grids.length - triedGridIds.length;
      console.log(`[SteamGridDB] ❌ No more covers to try (${triedGridIds.length} tried, ${availableCount} remaining)`);
      return {
        success: false,
        gameId,
        error: `All ${grids.length} available covers have been tried. Clear history to retry.`,
        steamGridDBId: sgdbGame.id,
        steamGridDBName: sgdbGame.name,
      };
    }

    console.log(`[SteamGridDB] Selected grid #${bestGrid.id}: score=${bestGrid.score}, style=${bestGrid.style}, ${bestGrid.width}x${bestGrid.height}`);
    console.log(`[SteamGridDB] URL: ${bestGrid.url}`);

    // Download the cover to local cache
    console.log(`[SteamGridDB] Downloading cover to local cache...`);
    const downloadResult = await downloadCover(gameId, bestGrid.url);

    if (!downloadResult.success) {
      console.log(`[SteamGridDB] ❌ Download failed: ${downloadResult.error}`);
      return {
        success: false,
        gameId,
        error: `Download failed: ${downloadResult.error}`,
        steamGridDBId: sgdbGame.id,
        steamGridDBName: sgdbGame.name,
      };
    }

    console.log(`[SteamGridDB] ✅ Downloaded to: ${downloadResult.localPath}`);

    // Track this grid as tried (so next fix attempt uses a different one)
    addTriedCover(gameId, bestGrid.id);
    console.log(`[SteamGridDB] 📝 Recorded grid #${bestGrid.id} as tried`);

    // Update the game's cover URL in database to use local path
    const localUrl = `/covers/${gameId}${downloadResult.localPath?.match(/\.[^.]+$/)?.[0] || '.jpg'}`;
    updateGameCover(gameId, localUrl);
    console.log(`[SteamGridDB] ✅ Updated database: ${localUrl}`);

    return {
      success: true,
      gameId,
      coverUrl: localUrl,
      steamGridDBId: sgdbGame.id,
      steamGridDBName: sgdbGame.name,
    };
  } catch (error) {
    console.error(`[SteamGridDB] ❌ Error fixing cover for ${gameId}:`, error);
    return {
      success: false,
      gameId,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Fix multiple covers in batch
 */
export async function fixMultipleCovers(
  games: Array<{ gameId: number; title: string }>,
  onProgress?: (completed: number, total: number, current: string) => void
): Promise<{
  total: number;
  success: number;
  failed: number;
  results: FixCoverResult[];
}> {
  const results: FixCoverResult[] = [];
  let successCount = 0;
  let failedCount = 0;

  for (let i = 0; i < games.length; i++) {
    const game = games[i];

    if (onProgress) {
      onProgress(i, games.length, game.title);
    }

    // Rate limit between requests
    if (i > 0) {
      await delay(RATE_LIMIT_DELAY * 2); // Double delay for batch operations
    }

    const result = await fixSingleCover(game.gameId, game.title);
    results.push(result);

    if (result.success) {
      successCount++;
    } else {
      failedCount++;
    }
  }

  if (onProgress) {
    onProgress(games.length, games.length, 'Done');
  }

  return {
    total: games.length,
    success: successCount,
    failed: failedCount,
    results,
  };
}
