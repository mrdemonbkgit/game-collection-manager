/**
 * SteamSpy API Service
 *
 * Fetches genre and tag data from SteamSpy API with parallel request support.
 * Much faster than Steam Store API for bulk metadata retrieval.
 *
 * API Docs: https://steamspy.com/api.php
 * Rate limit: 1 request/second for appdetails endpoint
 */

const STEAMSPY_API = 'https://steamspy.com/api.php';

// Rate limiting: 1 req/sec, but we use 500ms stagger with 2 concurrent
const REQUEST_DELAY_MS = 500;
const MAX_CONCURRENT = 2;

export interface SteamSpyAppDetails {
  appid: number;
  name: string;
  developer: string;
  publisher: string;
  score_rank: string;
  owners: string;
  average_forever: number;
  average_2weeks: number;
  median_forever: number;
  median_2weeks: number;
  ccu: number;
  price: string;
  initialprice: string;
  discount: string;
  tags: Record<string, number>; // { "Singleplayer": 1234, "RPG": 567 }
  languages: string;
  genre: string; // Comma-separated: "Action, Adventure, RPG"
}

export interface GenreSyncProgress {
  total: number;
  completed: number;
  currentGame: string;
  estimatedMinutesRemaining: number;
}

export interface GenreSyncResult {
  total: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ steamAppId: number; error: string }>;
}

export type GenreSyncProgressCallback = (progress: GenreSyncProgress) => void;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch app details from SteamSpy API
 */
export async function fetchSteamSpyAppDetails(
  appId: number
): Promise<SteamSpyAppDetails | null> {
  const url = `${STEAMSPY_API}?request=appdetails&appid=${appId}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      console.warn(`SteamSpy API error for app ${appId}: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as SteamSpyAppDetails;

    // SteamSpy returns appid: 0 for invalid/not found apps
    if (!data || data.appid === 0) {
      return null;
    }

    return data;
  } catch (error) {
    console.warn(`Error fetching SteamSpy data for app ${appId}:`, error);
    return null;
  }
}

// Acronyms that should stay uppercase
const ACRONYMS = new Set(['RPG', 'MMO', 'MMORPG', 'FPS', 'RTS', 'VR', 'AR', 'PVP', 'PVE', 'DLC']);

/**
 * Normalize genre string to Title Case, preserving acronyms
 * Input: "free to play" or "Free To Play"
 * Output: "Free To Play"
 * Input: "rpg" -> "RPG"
 */
function normalizeGenre(genre: string): string {
  return genre
    .split(' ')
    .map((word) => {
      const upper = word.toUpperCase();
      if (ACRONYMS.has(upper)) {
        return upper;
      }
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Parse genre string into array with normalized casing
 * Input: "Action, Adventure, RPG"
 * Output: ["Action", "Adventure", "Rpg"]
 */
export function parseGenres(genreString: string | undefined): string[] {
  if (!genreString || genreString.trim() === '') {
    return [];
  }
  return genreString
    .split(',')
    .map((g) => normalizeGenre(g.trim()))
    .filter((g) => g.length > 0);
}

/**
 * Extract top N tags sorted by vote count
 * Input: { "Singleplayer": 1234, "RPG": 567, "Open World": 890 }
 * Output: ["Singleplayer", "Open World", "RPG"] (sorted by votes desc)
 */
export function extractTopTags(
  tags: Record<string, number> | undefined,
  limit: number = 10
): string[] {
  if (!tags || typeof tags !== 'object') {
    return [];
  }

  return Object.entries(tags)
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([tag]) => tag);
}

/**
 * Semaphore for controlling concurrent requests
 */
class Semaphore {
  private permits: number;
  private waiting: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--;
      return;
    }

    return new Promise((resolve) => {
      this.waiting.push(resolve);
    });
  }

  release(): void {
    if (this.waiting.length > 0) {
      const next = this.waiting.shift();
      next?.();
    } else {
      this.permits++;
    }
  }
}

/**
 * Sync genres and tags for multiple games using parallel requests
 */
export async function syncGenresFromSteamSpy(
  games: Array<{ steamAppId: number; title: string }>,
  onProgress?: GenreSyncProgressCallback,
  onGameUpdate?: (
    steamAppId: number,
    genres: string[],
    tags: string[]
  ) => void
): Promise<GenreSyncResult> {
  const result: GenreSyncResult = {
    total: games.length,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  const semaphore = new Semaphore(MAX_CONCURRENT);
  const startTime = Date.now();
  let completed = 0;

  const processGame = async (game: { steamAppId: number; title: string }) => {
    await semaphore.acquire();

    try {
      // Stagger requests
      await delay(REQUEST_DELAY_MS);

      const data = await fetchSteamSpyAppDetails(game.steamAppId);

      if (!data) {
        result.failed++;
        result.errors.push({
          steamAppId: game.steamAppId,
          error: 'App not found or API error',
        });
        return;
      }

      const genres = parseGenres(data.genre);
      const tags = extractTopTags(data.tags, 10);

      if (genres.length === 0 && tags.length === 0) {
        result.skipped++;
        return;
      }

      // Call the update callback
      if (onGameUpdate) {
        onGameUpdate(game.steamAppId, genres, tags);
      }

      result.success++;
    } catch (error) {
      result.failed++;
      result.errors.push({
        steamAppId: game.steamAppId,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      completed++;
      semaphore.release();

      // Report progress
      if (onProgress) {
        const elapsedMs = Date.now() - startTime;
        const avgTimePerGame = elapsedMs / completed;
        const remaining = games.length - completed;
        const estimatedMs = remaining * avgTimePerGame;

        onProgress({
          total: games.length,
          completed,
          currentGame: game.title,
          estimatedMinutesRemaining: Math.ceil(estimatedMs / 60000),
        });
      }
    }
  };

  // Process all games with controlled concurrency
  const promises = games.map((game) => processGame(game));
  await Promise.all(promises);

  return result;
}
