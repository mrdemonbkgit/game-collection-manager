/**
 * IGDB Service - Provides universal game identification and metadata
 *
 * IGDB (Internet Game Database) is the universal source for game metadata,
 * covering ALL platforms (Steam, Xbox, PlayStation, Nintendo, etc.)
 *
 * Authentication: Uses Twitch OAuth2 (IGDB is owned by Twitch/Amazon)
 * Rate Limit: 4 requests/second
 */

// IGDB API Types
export interface IGDBGame {
  id: number;
  name: string;
  slug?: string;
  summary?: string;
  storyline?: string;
  rating?: number;           // IGDB user rating (0-100)
  rating_count?: number;
  aggregated_rating?: number; // Critic score average (0-100)
  aggregated_rating_count?: number;
  total_rating?: number;      // Combined user + critic
  first_release_date?: number; // Unix timestamp
  genres?: IGDBGenre[];
  themes?: IGDBTheme[];
  game_modes?: IGDBGameMode[];
  player_perspectives?: IGDBPlayerPerspective[];
  platforms?: IGDBPlatform[];
  involved_companies?: IGDBInvolvedCompany[];
  cover?: IGDBCover;
  screenshots?: IGDBScreenshot[];
  videos?: IGDBVideo[];
  external_games?: IGDBExternalGame[];
}

interface IGDBGenre {
  id: number;
  name: string;
}

interface IGDBTheme {
  id: number;
  name: string;
}

interface IGDBGameMode {
  id: number;
  name: string;
}

interface IGDBPlayerPerspective {
  id: number;
  name: string;
}

interface IGDBPlatform {
  id: number;
  name: string;
  abbreviation?: string;
}

interface IGDBInvolvedCompany {
  id: number;
  company: {
    id: number;
    name: string;
  };
  developer: boolean;
  publisher: boolean;
}

interface IGDBCover {
  id: number;
  url: string;
  width?: number;
  height?: number;
}

interface IGDBScreenshot {
  id: number;
  url: string;
}

interface IGDBVideo {
  id: number;
  video_id: string; // YouTube video ID
  name?: string;
}

interface IGDBExternalGame {
  id: number;
  category: number; // 1=Steam, 5=GOG, 11=Microsoft, etc.
  uid: string;      // External ID (e.g., Steam App ID)
  game?: number;    // Game ID reference (when querying external_games)
}

// External game category IDs
const EXTERNAL_CATEGORY = {
  STEAM: 1,
  GOG: 5,
  YOUTUBE: 10,
  MICROSOFT: 11,
  APPLE: 13,
  TWITCH: 14,
  ANDROID: 15,
  AMAZON_ASIN: 20,
  AMAZON_LUNA: 22,
  AMAZON_ADG: 23,
  EPIC_GAMES: 26,
  OCULUS: 28,
  UTOMIK: 29,
  ITCH_IO: 30,
  XBOX_MARKETPLACE: 31,
  KARTRIDGE: 32,
  PLAYSTATION_STORE: 36,
  FOCUS_ENTERTAINMENT: 37,
  XBOX_GAME_PASS_ULTIMATE_CLOUD: 54,
  GAMEJOLT: 55,
} as const;

// OAuth Token Cache
interface TokenCache {
  accessToken: string;
  expiresAt: number;
}

let tokenCache: TokenCache | null = null;

// Rate limiting
const RATE_LIMIT_DELAY = 250; // 4 requests/second = 250ms between requests
const REQUEST_TIMEOUT = 30000;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF = 1000;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch with exponential backoff retry for 429/5xx errors
 */
async function fetchWithRetry(url: string, options: RequestInit, timeoutMs: number = REQUEST_TIMEOUT): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, timeoutMs);

      if (response.ok) {
        return response;
      }

      // Rate limited - wait and retry
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        let waitTime: number;

        if (retryAfter) {
          const seconds = parseInt(retryAfter, 10);
          if (!isNaN(seconds)) {
            waitTime = seconds * 1000;
          } else {
            const retryDate = new Date(retryAfter);
            waitTime = Math.max(0, retryDate.getTime() - Date.now());
          }
        } else {
          waitTime = INITIAL_BACKOFF * Math.pow(2, attempt);
        }

        console.warn(`[IGDB] Rate limited (429). Waiting ${Math.round(waitTime / 1000)}s before retry...`);
        await delay(waitTime);
        continue;
      }

      // Server error - retry with backoff
      if (response.status >= 500) {
        const waitTime = INITIAL_BACKOFF * Math.pow(2, attempt);
        console.warn(`[IGDB] Server error (${response.status}). Waiting ${Math.round(waitTime / 1000)}s before retry...`);
        await delay(waitTime);
        continue;
      }

      // Client error (4xx except 429) - don't retry
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (lastError.name === 'AbortError') {
        console.warn(`[IGDB] Request timeout for ${url}`);
      }

      if (attempt < MAX_RETRIES - 1) {
        const waitTime = INITIAL_BACKOFF * Math.pow(2, attempt);
        console.warn(`[IGDB] Network error, retrying in ${Math.round(waitTime / 1000)}s...`);
        await delay(waitTime);
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${MAX_RETRIES} retries`);
}

/**
 * Get OAuth access token from Twitch
 * Tokens are cached until they expire
 */
export async function getIGDBToken(): Promise<string> {
  // Check cache
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.accessToken;
  }

  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error('TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET environment variables are required for IGDB API');
  }

  const response = await fetchWithRetry(
    'https://id.twitch.tv/oauth2/token',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'client_credentials',
      }),
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get IGDB token: ${response.status} ${text}`);
  }

  const data = await response.json() as { access_token: string; expires_in: number };

  tokenCache = {
    accessToken: data.access_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
  };

  console.log('[IGDB] OAuth token obtained, expires in', Math.round(data.expires_in / 3600), 'hours');
  return tokenCache.accessToken;
}

/**
 * Make an authenticated request to IGDB API
 */
async function igdbRequest<T>(endpoint: string, body: string): Promise<T> {
  const token = await getIGDBToken();
  const clientId = process.env.TWITCH_CLIENT_ID!;

  const response = await fetchWithRetry(
    `https://api.igdb.com/v4/${endpoint}`,
    {
      method: 'POST',
      headers: {
        'Client-ID': clientId,
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'text/plain',
      },
      body,
    }
  );

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`IGDB API error: ${response.status} ${text}`);
  }

  return response.json() as Promise<T>;
}

/**
 * Calculate string similarity (Levenshtein-based)
 * Returns 0-100 confidence score
 */
function calculateTitleSimilarity(title1: string, title2: string): number {
  const normalize = (s: string) => s.toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .replace(/\s+/g, '');

  const s1 = normalize(title1);
  const s2 = normalize(title2);

  if (s1 === s2) return 100;

  // Calculate Levenshtein distance
  const matrix: number[][] = [];
  for (let i = 0; i <= s1.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= s2.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= s1.length; i++) {
    for (let j = 1; j <= s2.length; j++) {
      const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  const distance = matrix[s1.length][s2.length];
  const maxLen = Math.max(s1.length, s2.length);

  if (maxLen === 0) return 100;

  return Math.round((1 - distance / maxLen) * 100);
}

/**
 * Get game by Steam App ID via external_games lookup
 * Returns null if not found, sets igdb_match_confidence to null (exact match)
 */
export async function getGameBySteamId(steamAppId: number): Promise<{ game: IGDBGame; confidence: null } | null> {
  await delay(RATE_LIMIT_DELAY);

  try {
    // First, find the external game entry with the Steam ID
    const externalGames = await igdbRequest<IGDBExternalGame[]>(
      'external_games',
      `fields game; where category = ${EXTERNAL_CATEGORY.STEAM} & uid = "${steamAppId}"; limit 1;`
    );

    if (!externalGames.length || !externalGames[0].game) {
      return null;
    }

    const gameId = externalGames[0].game;

    // Now fetch the full game data
    await delay(RATE_LIMIT_DELAY);
    const games = await igdbRequest<IGDBGame[]>(
      'games',
      `fields name, slug, summary, storyline, rating, rating_count, aggregated_rating,
              aggregated_rating_count, total_rating, first_release_date,
              genres.name, themes.name, game_modes.name, player_perspectives.name,
              platforms.name, platforms.abbreviation,
              involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
              cover.url, screenshots.url, videos.video_id, videos.name,
              external_games.category, external_games.uid;
       where id = ${gameId}; limit 1;`
    );

    if (!games.length) {
      return null;
    }

    return { game: games[0], confidence: null };
  } catch (error) {
    console.warn(`[IGDB] Error fetching game by Steam ID ${steamAppId}:`, error);
    return null;
  }
}

/**
 * Search for game by title
 * Returns best match with confidence score (0-100)
 */
export async function searchGameByTitle(title: string, releaseYear?: number): Promise<{ game: IGDBGame; confidence: number } | null> {
  await delay(RATE_LIMIT_DELAY);

  try {
    // Build search query
    let query = `search "${title.replace(/"/g, '\\"')}";
      fields name, slug, summary, storyline, rating, rating_count, aggregated_rating,
             aggregated_rating_count, total_rating, first_release_date,
             genres.name, themes.name, game_modes.name, player_perspectives.name,
             platforms.name, platforms.abbreviation,
             involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
             cover.url, screenshots.url, videos.video_id, videos.name,
             external_games.category, external_games.uid;
      limit 10;`;

    const games = await igdbRequest<IGDBGame[]>('games', query);

    if (!games.length) {
      return null;
    }

    // Score each result based on title similarity and optional year match
    let bestMatch: { game: IGDBGame; confidence: number } | null = null;

    for (const game of games) {
      let confidence = calculateTitleSimilarity(title, game.name);

      // Boost confidence if release year matches
      if (releaseYear && game.first_release_date) {
        const gameYear = new Date(game.first_release_date * 1000).getFullYear();
        if (gameYear === releaseYear) {
          confidence = Math.min(100, confidence + 10);
        }
      }

      // Exact name match gets maximum confidence
      if (game.name.toLowerCase() === title.toLowerCase()) {
        confidence = 100;
      }

      if (!bestMatch || confidence > bestMatch.confidence) {
        bestMatch = { game, confidence };
      }
    }

    // Require minimum 60% confidence
    if (bestMatch && bestMatch.confidence >= 60) {
      return bestMatch;
    }

    return null;
  } catch (error) {
    console.warn(`[IGDB] Error searching for game "${title}":`, error);
    return null;
  }
}

/**
 * Get game by IGDB ID
 */
export async function getGameByIGDBId(igdbId: number): Promise<IGDBGame | null> {
  await delay(RATE_LIMIT_DELAY);

  try {
    const games = await igdbRequest<IGDBGame[]>(
      'games',
      `fields name, slug, summary, storyline, rating, rating_count, aggregated_rating,
              aggregated_rating_count, total_rating, first_release_date,
              genres.name, themes.name, game_modes.name, player_perspectives.name,
              platforms.name, platforms.abbreviation,
              involved_companies.company.name, involved_companies.developer, involved_companies.publisher,
              cover.url, screenshots.url, videos.video_id, videos.name,
              external_games.category, external_games.uid;
       where id = ${igdbId}; limit 1;`
    );

    return games[0] || null;
  } catch (error) {
    console.warn(`[IGDB] Error fetching game by IGDB ID ${igdbId}:`, error);
    return null;
  }
}

/**
 * Convert IGDB game data to database format
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

export function convertIGDBGameToMetadata(game: IGDBGame, confidence: number | null): IGDBMetadataInput {
  return {
    igdbId: game.id,
    igdbSlug: game.slug || null,
    igdbRating: game.rating ?? null,
    igdbRatingCount: game.rating_count ?? null,
    igdbAggregatedRating: game.aggregated_rating ?? null,
    igdbAggregatedRatingCount: game.aggregated_rating_count ?? null,
    igdbTotalRating: game.total_rating ?? null,
    storyline: game.storyline || null,
    themes: game.themes?.map(t => t.name) || [],
    gameModes: game.game_modes?.map(m => m.name) || [],
    playerPerspectives: game.player_perspectives?.map(p => p.name) || [],
    igdbGenres: game.genres?.map(g => g.name) || [],
    igdbPlatforms: game.platforms?.map(p => p.name) || [],
    igdbSummary: game.summary || null,
    igdbMatchConfidence: confidence,
  };
}

/**
 * Sync progress callback type
 */
export interface IGDBSyncProgress {
  total: number;
  current: number;
  currentGame: string;
  matched: number;
  failed: number;
}

export type IGDBSyncProgressCallback = (progress: IGDBSyncProgress) => void;

/**
 * Sync result type
 */
export interface IGDBSyncResult {
  totalGames: number;
  matched: number;
  notFound: number;
  errors: Array<{ gameId: number; title: string; error: string }>;
}
