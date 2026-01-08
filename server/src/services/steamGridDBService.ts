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
  getCachedAssets,
  updateGameAssets,
  markAssetsChecked,
  getGameById,
  getAllGames,
} from '../db/repositories/gameRepository.js';
import { downloadCover } from './localCoverService.js';
import { downloadGameAssets, getLocalAssetUrl, downloadAsset, hasLocalAsset } from './localAssetsService.js';

const API_BASE = 'https://www.steamgriddb.com/api/v2';
const RATE_LIMIT_DELAY = 250; // 250ms between requests (4 req/sec)

// Track which SteamGridDB grid IDs have been tried per game
const TRIED_COVERS_FILE = path.resolve(process.cwd(), 'data', 'cover-fix-history.json');

export interface CoverFixHistoryEntry {
  gridIds: number[];
  triedUrls: string[]; // URLs that have been downloaded
  lastTryTime: number; // Unix timestamp in ms
}

export interface CoverFixHistory {
  [gameId: string]: CoverFixHistoryEntry;
}

// Old format for migration
type OldCoverFixHistory = { [gameId: string]: number[] | CoverFixHistoryEntry };

function loadTriedCovers(): CoverFixHistory {
  try {
    if (fs.existsSync(TRIED_COVERS_FILE)) {
      const raw = JSON.parse(fs.readFileSync(TRIED_COVERS_FILE, 'utf-8')) as OldCoverFixHistory;
      // Migrate old format (array) to new format (object with gridIds, triedUrls, and lastTryTime)
      const migrated: CoverFixHistory = {};
      let needsMigration = false;
      for (const [gameId, value] of Object.entries(raw)) {
        if (Array.isArray(value)) {
          // Old format (just array of gridIds) - migrate
          migrated[gameId] = { gridIds: value, triedUrls: [], lastTryTime: Date.now() };
          needsMigration = true;
        } else {
          // New format - ensure triedUrls exists
          if (!value.triedUrls) {
            migrated[gameId] = { ...value, triedUrls: [] };
            needsMigration = true;
          } else {
            migrated[gameId] = value;
          }
        }
      }
      if (needsMigration) {
        saveTriedCovers(migrated);
      }
      return migrated;
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

function addTriedCover(gameId: number, gridId: number, url: string): void {
  const history = loadTriedCovers();
  const key = String(gameId);
  if (!history[key]) {
    history[key] = { gridIds: [], triedUrls: [], lastTryTime: Date.now() };
  }
  if (!history[key].gridIds.includes(gridId)) {
    history[key].gridIds.push(gridId);
  }
  if (!history[key].triedUrls.includes(url)) {
    history[key].triedUrls.push(url);
  }
  history[key].lastTryTime = Date.now();
  saveTriedCovers(history);
}

function getTriedCovers(gameId: number): { gridIds: number[]; urls: string[] } {
  const history = loadTriedCovers();
  const entry = history[String(gameId)];
  return {
    gridIds: entry?.gridIds || [],
    urls: entry?.triedUrls || [],
  };
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
    .replace(/[_:\-–—]/g, ' ')  // Convert underscores to spaces too
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

  // Extract numbers from both titles - these must match for sports games, sequels, etc.
  const numbers1 = norm1.match(/\d+/g) || [];
  const numbers2 = norm2.match(/\d+/g) || [];

  // If both have numbers, they must have at least one in common
  // This prevents "Madden NFL 24" from matching "Madden NFL 26"
  if (numbers1.length > 0 && numbers2.length > 0) {
    const numSet1 = new Set(numbers1);
    const numSet2 = new Set(numbers2);
    const hasCommonNumber = [...numSet1].some(n => numSet2.has(n));
    if (!hasCommonNumber) return false;
  }

  // One contains the other - but require the shorter to be at least 40% of the longer
  // This prevents "ALPHA" from matching "Alpha Kimori Episode One"
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    const shorter = norm1.length < norm2.length ? norm1 : norm2;
    const longer = norm1.length < norm2.length ? norm2 : norm1;
    const ratio = shorter.length / longer.length;
    if (ratio >= 0.4) return true;
  }

  // Check word overlap - require high similarity
  // Keep numbers in word list regardless of length
  const words1 = new Set(norm1.split(' ').filter(w => w.length > 2 || /^\d+$/.test(w)));
  const words2 = new Set(norm2.split(' ').filter(w => w.length > 2 || /^\d+$/.test(w)));

  if (words1.size === 0 || words2.size === 0) return false;

  const intersection = [...words1].filter(w => words2.has(w));
  const similarity = intersection.length / Math.max(words1.size, words2.size);

  return similarity >= 0.6;
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

    // Get list of previously tried grid IDs and URLs for this game
    const { gridIds: triedGridIds, urls: triedUrls } = getTriedCovers(gameId);
    if (triedGridIds.length > 0) {
      console.log(`[SteamGridDB] Previously tried ${triedGridIds.length} covers (${triedUrls.length} unique URLs) for this game`);
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

    // Filter out grids with URLs we've already tried
    const gridsWithNewUrls = grids.filter(g => !triedUrls.includes(g.url));
    console.log(`[SteamGridDB] ${gridsWithNewUrls.length} grids with new URLs (filtered ${grids.length - gridsWithNewUrls.length} duplicates)`);

    // Select best grid (excluding previously tried ones by ID and URL)
    const bestGrid = selectBestGrid(gridsWithNewUrls, triedGridIds);

    if (!bestGrid) {
      const availableCount = gridsWithNewUrls.length;
      console.log(`[SteamGridDB] ❌ No more covers to try (${triedGridIds.length} grid IDs tried, ${triedUrls.length} URLs tried, ${availableCount} remaining)`);
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
    addTriedCover(gameId, bestGrid.id, bestGrid.url);
    console.log(`[SteamGridDB] 📝 Recorded grid #${bestGrid.id} and URL as tried`);

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

// ============================================================
// HERO AND LOGO ASSETS
// ============================================================

interface SteamGridDBHero {
  id: number;
  score: number;
  style: string;
  width: number;
  height: number;
  nsfw: boolean;
  humor: boolean;
  url: string;
  thumb: string;
}

interface SteamGridDBLogo {
  id: number;
  score: number;
  style: string;
  width: number;
  height: number;
  nsfw: boolean;
  humor: boolean;
  url: string;
  thumb: string;
}

interface HeroesResponse {
  success: boolean;
  data: SteamGridDBHero[];
}

interface LogosResponse {
  success: boolean;
  data: SteamGridDBLogo[];
}

/**
 * Get SteamGridDB game ID by Steam App ID
 * More accurate than title search
 */
async function getSteamGridIdBySteamAppId(steamAppId: number): Promise<number | null> {
  try {
    const apiKey = getApiKey();
    const url = `${API_BASE}/games/steam/${steamAppId}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      console.warn(`[SteamGridDB] Failed to get game by steamAppId ${steamAppId}: ${response.status}`);
      return null;
    }

    const data = await response.json() as { success: boolean; data: { id: number } };
    if (!data.success || !data.data) return null;

    return data.data.id;
  } catch (error) {
    console.warn(`[SteamGridDB] Error getting game by steamAppId ${steamAppId}:`, error);
    return null;
  }
}

/**
 * Fetch hero images for a SteamGridDB game
 */
async function fetchHeroes(steamGridId: number): Promise<SteamGridDBHero[]> {
  try {
    const apiKey = getApiKey();
    const url = `${API_BASE}/heroes/game/${steamGridId}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      if (response.status === 404) return [];
      console.warn(`[SteamGridDB] Failed to fetch heroes for ${steamGridId}: ${response.status}`);
      return [];
    }

    const data = await response.json() as HeroesResponse;
    if (!data.success || !data.data) return [];

    return data.data;
  } catch (error) {
    console.warn(`[SteamGridDB] Error fetching heroes for ${steamGridId}:`, error);
    return [];
  }
}

/**
 * Fetch logo images for a SteamGridDB game
 */
async function fetchLogos(steamGridId: number): Promise<SteamGridDBLogo[]> {
  try {
    const apiKey = getApiKey();
    const url = `${API_BASE}/logos/game/${steamGridId}`;

    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!response.ok) {
      if (response.status === 404) return [];
      console.warn(`[SteamGridDB] Failed to fetch logos for ${steamGridId}: ${response.status}`);
      return [];
    }

    const data = await response.json() as LogosResponse;
    if (!data.success || !data.data) return [];

    return data.data;
  } catch (error) {
    console.warn(`[SteamGridDB] Error fetching logos for ${steamGridId}:`, error);
    return [];
  }
}

/**
 * Select the best asset from a list (prefer high score, non-NSFW)
 */
function selectBestAsset<T extends { score: number; nsfw: boolean; humor: boolean; url: string }>(
  assets: T[]
): T | null {
  if (assets.length === 0) return null;

  // Filter out NSFW and humor, sort by score
  const safe = assets
    .filter(a => !a.nsfw && !a.humor)
    .sort((a, b) => b.score - a.score);

  if (safe.length > 0) return safe[0];

  // Fallback to any asset
  return assets.sort((a, b) => b.score - a.score)[0] || null;
}

/**
 * Result of getHeroAndLogo
 */
export interface SteamGridAssets {
  heroUrl: string | null;
  logoUrl: string | null;
  cached: boolean;
}

// Cache duration: 24 hours (re-check after this time)
const ASSET_CACHE_HOURS = 24;

/**
 * Get hero and logo images for a game from SteamGridDB
 * Downloads assets locally for faster loading and returns local URLs
 */
export async function getHeroAndLogo(gameId: number): Promise<SteamGridAssets> {
  // 1. Check for locally cached assets first (fastest)
  let localHero = getLocalAssetUrl(gameId, 'hero');
  let localLogo = getLocalAssetUrl(gameId, 'logo');

  // 2. Check DB cache for remote URLs
  const cached = getCachedAssets(gameId);

  // If we have both local files, return immediately
  if (localHero && localLogo) {
    return { heroUrl: localHero, logoUrl: localLogo, cached: true };
  }

  // If we're missing local files but have DB cache, download the missing ones
  if (cached.heroUrl || cached.logoUrl) {
    const needsHeroDownload = !localHero && cached.heroUrl;
    const needsLogoDownload = !localLogo && cached.logoUrl;

    if (needsHeroDownload || needsLogoDownload) {
      console.log(`[SteamGridDB] Downloading cached assets locally for game ${gameId}`);
      const { heroLocalUrl, logoLocalUrl } = await downloadGameAssets(
        gameId,
        needsHeroDownload ? cached.heroUrl : null,
        needsLogoDownload ? cached.logoUrl : null
      );

      // Update local URLs with downloaded files
      if (heroLocalUrl) localHero = heroLocalUrl;
      if (logoLocalUrl) localLogo = logoLocalUrl;
    }

    // Return what we have (local preferred, remote as fallback)
    return {
      heroUrl: localHero || cached.heroUrl,
      logoUrl: localLogo || cached.logoUrl,
      cached: true,
    };
  }

  // If we have any local files from previous attempts, return them
  if (localHero || localLogo) {
    return { heroUrl: localHero, logoUrl: localLogo, cached: true };
  }

  // If we recently checked and found nothing, don't re-query
  if (cached.assetsCheckedAt) {
    const checkedAt = new Date(cached.assetsCheckedAt);
    const hoursAgo = (Date.now() - checkedAt.getTime()) / (1000 * 60 * 60);

    if (hoursAgo < ASSET_CACHE_HOURS) {
      return { heroUrl: null, logoUrl: null, cached: true };
    }
  }

  // 3. Get game info
  const game = getGameById(gameId);
  if (!game) {
    return { heroUrl: null, logoUrl: null, cached: false };
  }

  console.log(`[SteamGridDB] Fetching hero/logo for "${game.title}" (ID: ${gameId})`);

  // 4. Lookup by steamAppId first (more accurate)
  let steamGridId: number | null = cached.steamgridId;

  if (!steamGridId && game.steam_app_id) {
    console.log(`[SteamGridDB] Looking up by Steam App ID: ${game.steam_app_id}`);
    steamGridId = await getSteamGridIdBySteamAppId(game.steam_app_id);
    await delay(RATE_LIMIT_DELAY);
  }

  // 5. Fallback to title search
  if (!steamGridId) {
    console.log(`[SteamGridDB] Falling back to title search: "${game.title}"`);
    const sgdbGame = await searchGame(game.title);
    steamGridId = sgdbGame?.id || null;
    await delay(RATE_LIMIT_DELAY);
  }

  if (!steamGridId) {
    console.log(`[SteamGridDB] ❌ Game not found on SteamGridDB`);
    // Mark as checked to avoid re-querying
    markAssetsChecked(gameId);
    return { heroUrl: null, logoUrl: null, cached: false };
  }

  console.log(`[SteamGridDB] Found SteamGridDB ID: ${steamGridId}`);

  // 6. Fetch heroes and logos in parallel
  const [heroes, logos] = await Promise.all([
    fetchHeroes(steamGridId),
    fetchLogos(steamGridId),
  ]);

  console.log(`[SteamGridDB] Found ${heroes.length} heroes, ${logos.length} logos`);

  const remoteHeroUrl = selectBestAsset(heroes)?.url || null;
  const remoteLogoUrl = selectBestAsset(logos)?.url || null;

  // 7. Download assets locally
  const { heroLocalUrl, logoLocalUrl } = await downloadGameAssets(
    gameId,
    remoteHeroUrl,
    remoteLogoUrl
  );

  // 8. Cache remote URLs in DB (as backup reference)
  updateGameAssets(gameId, {
    steamgridId: steamGridId,
    heroUrl: remoteHeroUrl,
    logoUrl: remoteLogoUrl,
  });

  console.log(`[SteamGridDB] ✅ Downloaded and cached assets for game ${gameId}`);

  // Return local URLs (or remote as fallback)
  return {
    heroUrl: heroLocalUrl || remoteHeroUrl,
    logoUrl: logoLocalUrl || remoteLogoUrl,
    cached: false,
  };
}

// ============================================================
// ASSET OPTIONS (for Asset Fix Page)
// ============================================================

// Domain allowlist for SSRF protection
const ALLOWED_DOMAINS = ['cdn.steamgriddb.com', 'cdn2.steamgriddb.com'];

function isAllowedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return ALLOWED_DOMAINS.includes(parsed.hostname);
  } catch {
    return false;
  }
}

export interface SteamGridAssetOption {
  id: number;
  url: string;
  thumb: string;
  score: number;
  style: string;
  width: number;
  height: number;
  author: string;
}

export interface AssetOptionsResponse {
  options: SteamGridAssetOption[];
  total: number;
  hasMore: boolean;
  currentAssetId: number | null;
  currentLocalUrl: string | null;
}

/**
 * Get hero options for a game from SteamGridDB
 */
export async function getHeroOptions(
  gameId: number,
  limit: number = 6,
  offset: number = 0
): Promise<AssetOptionsResponse> {
  const game = getGameById(gameId);
  if (!game) {
    return { options: [], total: 0, hasMore: false, currentAssetId: null, currentLocalUrl: null };
  }

  // Get current local URL if exists
  const currentLocalUrl = getLocalAssetUrl(gameId, 'hero');

  // Get SteamGridDB ID (cached or lookup)
  let steamGridId = getCachedAssets(gameId).steamgridId;

  if (!steamGridId && game.steam_app_id) {
    steamGridId = await getSteamGridIdBySteamAppId(game.steam_app_id);
    await delay(RATE_LIMIT_DELAY);
  }

  if (!steamGridId) {
    const sgdbGame = await searchGame(game.title);
    steamGridId = sgdbGame?.id || null;
    await delay(RATE_LIMIT_DELAY);
  }

  if (!steamGridId) {
    return { options: [], total: 0, hasMore: false, currentAssetId: null, currentLocalUrl };
  }

  // Fetch all heroes
  const heroes = await fetchHeroes(steamGridId);

  // Sort by score descending, filter NSFW/humor
  const sortedHeroes = heroes
    .filter(h => !h.nsfw && !h.humor)
    .sort((a, b) => b.score - a.score);

  const total = sortedHeroes.length;
  const paginatedHeroes = sortedHeroes.slice(offset, offset + limit);

  const options: SteamGridAssetOption[] = paginatedHeroes.map(h => ({
    id: h.id,
    url: h.url,
    thumb: h.thumb,
    score: h.score,
    style: h.style,
    width: h.width,
    height: h.height,
    author: '', // Heroes don't have author in API response
  }));

  return {
    options,
    total,
    hasMore: offset + limit < total,
    currentAssetId: null, // We don't track asset IDs currently
    currentLocalUrl,
  };
}

/**
 * Get logo options for a game from SteamGridDB
 */
export async function getLogoOptions(
  gameId: number,
  limit: number = 6,
  offset: number = 0
): Promise<AssetOptionsResponse> {
  const game = getGameById(gameId);
  if (!game) {
    return { options: [], total: 0, hasMore: false, currentAssetId: null, currentLocalUrl: null };
  }

  // Get current local URL if exists
  const currentLocalUrl = getLocalAssetUrl(gameId, 'logo');

  // Get SteamGridDB ID (cached or lookup)
  let steamGridId = getCachedAssets(gameId).steamgridId;

  if (!steamGridId && game.steam_app_id) {
    steamGridId = await getSteamGridIdBySteamAppId(game.steam_app_id);
    await delay(RATE_LIMIT_DELAY);
  }

  if (!steamGridId) {
    const sgdbGame = await searchGame(game.title);
    steamGridId = sgdbGame?.id || null;
    await delay(RATE_LIMIT_DELAY);
  }

  if (!steamGridId) {
    return { options: [], total: 0, hasMore: false, currentAssetId: null, currentLocalUrl };
  }

  // Fetch all logos
  const logos = await fetchLogos(steamGridId);

  // Sort by score descending, filter NSFW/humor
  const sortedLogos = logos
    .filter(l => !l.nsfw && !l.humor)
    .sort((a, b) => b.score - a.score);

  const total = sortedLogos.length;
  const paginatedLogos = sortedLogos.slice(offset, offset + limit);

  const options: SteamGridAssetOption[] = paginatedLogos.map(l => ({
    id: l.id,
    url: l.url,
    thumb: l.thumb,
    score: l.score,
    style: l.style,
    width: l.width,
    height: l.height,
    author: '', // Logos don't have author in API response
  }));

  return {
    options,
    total,
    hasMore: offset + limit < total,
    currentAssetId: null, // We don't track asset IDs currently
    currentLocalUrl,
  };
}

/**
 * Save selected assets by their SteamGridDB IDs
 * Fetches the asset URLs from the options and downloads to local cache
 */
export async function saveSelectedAssets(
  gameId: number,
  heroAssetId: number | null,
  logoAssetId: number | null
): Promise<{ success: boolean; heroLocalUrl?: string; logoLocalUrl?: string; errors: string[] }> {
  const errors: string[] = [];
  let heroLocalUrl: string | undefined;
  let logoLocalUrl: string | undefined;

  const game = getGameById(gameId);
  if (!game) {
    return { success: false, errors: ['Game not found'] };
  }

  // Get SteamGridDB ID
  let steamGridId = getCachedAssets(gameId).steamgridId;
  if (!steamGridId && game.steam_app_id) {
    steamGridId = await getSteamGridIdBySteamAppId(game.steam_app_id);
    await delay(RATE_LIMIT_DELAY);
  }
  if (!steamGridId) {
    const sgdbGame = await searchGame(game.title);
    steamGridId = sgdbGame?.id || null;
  }

  if (!steamGridId) {
    return { success: false, errors: ['Game not found on SteamGridDB'] };
  }

  // Fetch and download hero
  if (heroAssetId) {
    try {
      const heroes = await fetchHeroes(steamGridId);
      const hero = heroes.find(h => h.id === heroAssetId);

      if (!hero) {
        errors.push('Hero asset not found');
      } else if (!isAllowedUrl(hero.url)) {
        errors.push('Hero URL not from allowed domain');
      } else {
        const result = await downloadAsset(gameId, hero.url, 'hero');
        if (result.success && result.localUrl) {
          heroLocalUrl = result.localUrl;
          // Update DB cache
          updateGameAssets(gameId, { steamgridId: steamGridId, heroUrl: hero.url });
        } else {
          errors.push(`Hero download failed: ${result.error}`);
        }
      }
    } catch (err) {
      errors.push(`Hero error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  // Fetch and download logo
  if (logoAssetId) {
    try {
      const logos = await fetchLogos(steamGridId);
      const logo = logos.find(l => l.id === logoAssetId);

      if (!logo) {
        errors.push('Logo asset not found');
      } else if (!isAllowedUrl(logo.url)) {
        errors.push('Logo URL not from allowed domain');
      } else {
        const result = await downloadAsset(gameId, logo.url, 'logo');
        if (result.success && result.localUrl) {
          logoLocalUrl = result.localUrl;
          // Update DB cache
          updateGameAssets(gameId, { steamgridId: steamGridId, logoUrl: logo.url });
        } else {
          errors.push(`Logo download failed: ${result.error}`);
        }
      }
    } catch (err) {
      errors.push(`Logo error: ${err instanceof Error ? err.message : 'Unknown'}`);
    }
  }

  const success = errors.length === 0 && !!(heroLocalUrl || logoLocalUrl);
  return { success, heroLocalUrl, logoLocalUrl, errors };
}

// ============================================================
// BATCH PREDOWNLOAD HEROES AND LOGOS
// ============================================================

export interface PredownloadProgress {
  total: number;
  completed: number;
  downloaded: number;
  skipped: number;
  failed: number;
  currentGame: string;
}

export interface PredownloadResult {
  total: number;
  downloaded: number;
  skipped: number;
  failed: number;
  errors: Array<{ gameId: number; title: string; error: string }>;
}

/**
 * Predownload heroes and logos for all games that don't have them locally cached
 */
export async function predownloadAllAssets(
  onProgress?: (progress: PredownloadProgress) => void
): Promise<PredownloadResult> {
  // Get all games
  const { games } = getAllGames({ limit: 10000 });

  // Filter to games missing heroes OR logos
  const gamesNeedingAssets = games.filter(game => {
    const hasHero = hasLocalAsset(game.id, 'hero') !== null;
    const hasLogo = hasLocalAsset(game.id, 'logo') !== null;
    return !hasHero || !hasLogo;
  });

  const result: PredownloadResult = {
    total: gamesNeedingAssets.length,
    downloaded: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  console.log(`[SteamGridDB] Starting predownload for ${gamesNeedingAssets.length} games missing assets...`);

  for (let i = 0; i < gamesNeedingAssets.length; i++) {
    const game = gamesNeedingAssets[i];

    if (onProgress) {
      onProgress({
        total: gamesNeedingAssets.length,
        completed: i,
        downloaded: result.downloaded,
        skipped: result.skipped,
        failed: result.failed,
        currentGame: game.title,
      });
    }

    try {
      // getHeroAndLogo handles caching logic and downloads missing assets
      const assets = await getHeroAndLogo(game.id);

      if (assets.heroUrl || assets.logoUrl) {
        result.downloaded++;
      } else {
        result.skipped++;
      }

      // Rate limit between games
      await delay(RATE_LIMIT_DELAY);
    } catch (error) {
      result.failed++;
      result.errors.push({
        gameId: game.id,
        title: game.title,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  // Final progress
  if (onProgress) {
    onProgress({
      total: gamesNeedingAssets.length,
      completed: gamesNeedingAssets.length,
      downloaded: result.downloaded,
      skipped: result.skipped,
      failed: result.failed,
      currentGame: 'Done',
    });
  }

  console.log(`[SteamGridDB] Predownload complete: ${result.downloaded} downloaded, ${result.skipped} skipped, ${result.failed} failed`);

  return result;
}
