import {
  upsertGameBySteamAppId,
  addGamePlatform,
  getUniqueSlug,
  updateGamePlaytime,
  gameExistsBySteamAppId,
  type CreateGameInput,
} from '../db/repositories/gameRepository.js';

// Steam API types
interface SteamOwnedGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  rtime_last_played?: number;
}

interface SteamOwnedGamesResponse {
  response: {
    game_count: number;
    games: SteamOwnedGame[];
  };
}

// Full Steam AppDetails interface with ALL available fields
interface SteamAppDetailsData {
  type: string; // game, dlc, demo, mod
  name: string;
  steam_appid: number;
  required_age: number | string;
  is_free: boolean;
  controller_support?: 'full' | 'partial';
  dlc?: number[];
  detailed_description: string;
  about_the_game: string;
  short_description: string;
  supported_languages?: string; // HTML string
  header_image: string;
  capsule_image: string;
  capsule_imagev5: string;
  website: string | null;
  pc_requirements?: { minimum?: string; recommended?: string } | string[];
  mac_requirements?: { minimum?: string; recommended?: string } | string[];
  linux_requirements?: { minimum?: string; recommended?: string } | string[];
  developers?: string[];
  publishers?: string[];
  platforms?: { windows: boolean; mac: boolean; linux: boolean };
  genres?: Array<{ id: string; description: string }>;
  categories?: Array<{ id: number; description: string }>;
  screenshots?: Array<{ id: number; path_thumbnail: string; path_full: string }>;
  movies?: Array<{
    id: number;
    name: string;
    thumbnail: string;
    webm?: { '480': string; max: string };
    mp4?: { '480': string; max: string };
    highlight: boolean;
  }>;
  recommendations?: { total: number };
  achievements?: { total: number; highlighted?: Array<{ name: string; path: string }> };
  release_date?: { coming_soon: boolean; date: string };
  background?: string;
  background_raw?: string;
  metacritic?: { score: number; url: string };
  legal_notice?: string;
  content_descriptors?: { ids: number[]; notes?: string };
  price_overview?: {
    currency: string;
    initial: number;
    final: number;
    discount_percent: number;
    initial_formatted: string;
    final_formatted: string;
  };
}

interface SteamAppDetails {
  success: boolean;
  data?: SteamAppDetailsData;
}

// Steam Reviews API response
interface SteamReviewsResponse {
  success: number;
  query_summary: {
    num_reviews: number;
    review_score: number;
    review_score_desc: string;
    total_positive: number;
    total_negative: number;
    total_reviews: number;
  };
}

export interface SteamReviewData {
  rating: number; // Percentage positive (0-100)
  totalReviews: number;
  totalPositive: number;
  totalNegative: number;
  reviewScoreDesc: string; // "Overwhelmingly Positive", "Very Positive", etc.
}

const STEAM_API_BASE = 'https://api.steampowered.com';
const STEAM_STORE_API = 'https://store.steampowered.com/api';

// Rate limiting for Steam API
const RATE_LIMIT_DELAY = 1500; // 1.5 seconds between requests
const REQUEST_TIMEOUT = 30000; // 30 second timeout per request
const MAX_RETRIES = 3; // Max retry attempts for 429/5xx errors
const INITIAL_BACKOFF = 2000; // Initial backoff delay in ms

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Fetch with timeout using AbortController
 */
async function fetchWithTimeout(url: string, timeoutMs: number = REQUEST_TIMEOUT): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { signal: controller.signal });
    return response;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Fetch with exponential backoff retry for 429/5xx errors
 * Respects Retry-After header when present
 */
async function fetchWithRetry(url: string, timeoutMs: number = REQUEST_TIMEOUT): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      const response = await fetchWithTimeout(url, timeoutMs);

      // Success - return response
      if (response.ok) {
        return response;
      }

      // Rate limited - wait and retry
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        let waitTime: number;

        if (retryAfter) {
          // Retry-After can be seconds or HTTP date
          const seconds = parseInt(retryAfter, 10);
          if (!isNaN(seconds)) {
            waitTime = seconds * 1000;
          } else {
            // Parse as HTTP date
            const retryDate = new Date(retryAfter);
            waitTime = Math.max(0, retryDate.getTime() - Date.now());
          }
        } else {
          // No Retry-After header, use exponential backoff
          waitTime = INITIAL_BACKOFF * Math.pow(2, attempt);
        }

        console.warn(`[Steam] Rate limited (429). Waiting ${Math.round(waitTime / 1000)}s before retry...`);
        await delay(waitTime);
        continue;
      }

      // Server error - retry with backoff
      if (response.status >= 500) {
        const waitTime = INITIAL_BACKOFF * Math.pow(2, attempt);
        console.warn(`[Steam] Server error (${response.status}). Waiting ${Math.round(waitTime / 1000)}s before retry...`);
        await delay(waitTime);
        continue;
      }

      // Client error (4xx except 429) - don't retry
      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Abort errors shouldn't be retried
      if (lastError.name === 'AbortError') {
        console.warn(`[Steam] Request timeout for ${url}`);
      }

      // Retry on network errors
      if (attempt < MAX_RETRIES - 1) {
        const waitTime = INITIAL_BACKOFF * Math.pow(2, attempt);
        console.warn(`[Steam] Network error, retrying in ${Math.round(waitTime / 1000)}s...`);
        await delay(waitTime);
      }
    }
  }

  throw lastError || new Error(`Failed to fetch ${url} after ${MAX_RETRIES} retries`);
}

export async function fetchSteamOwnedGames(
  apiKey: string,
  steamId: string
): Promise<SteamOwnedGame[]> {
  const url = `${STEAM_API_BASE}/IPlayerService/GetOwnedGames/v1/?key=${apiKey}&steamid=${steamId}&include_appinfo=true&include_played_free_games=true&format=json`;

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Steam API error: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as SteamOwnedGamesResponse;

  if (!data.response || !data.response.games) {
    throw new Error('Invalid response from Steam API. Make sure your profile is public.');
  }

  return data.response.games;
}

export async function fetchSteamAppDetails(appId: number): Promise<SteamAppDetailsData | null> {
  const url = `${STEAM_STORE_API}/appdetails?appids=${appId}`;

  try {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      console.warn(`Failed to fetch details for app ${appId}: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as Record<string, SteamAppDetails>;
    const appData = data[appId.toString()];

    if (!appData || !appData.success || !appData.data) {
      return null;
    }

    return appData.data;
  } catch (error) {
    console.warn(`Error fetching details for app ${appId}:`, error);
    return null;
  }
}

/**
 * Fetch Steam review summary for a game
 * Returns rating percentage and review counts
 * Uses filter=summary and num_per_page=0 for minimal payload
 */
export async function fetchSteamReviews(appId: number): Promise<SteamReviewData | null> {
  // Use filter=summary to get only summary stats, num_per_page=0 to skip individual reviews
  const url = `https://store.steampowered.com/appreviews/${appId}?json=1&filter=summary&num_per_page=0&language=all&purchase_type=all`;

  try {
    const response = await fetchWithRetry(url);

    if (!response.ok) {
      console.warn(`Failed to fetch reviews for app ${appId}: ${response.status}`);
      return null;
    }

    const data = (await response.json()) as SteamReviewsResponse;

    if (!data.success || !data.query_summary) {
      return null;
    }

    const summary = data.query_summary;

    // Calculate percentage positive
    const rating = summary.total_reviews > 0
      ? Math.round((summary.total_positive / summary.total_reviews) * 100)
      : 0;

    return {
      rating,
      totalReviews: summary.total_reviews,
      totalPositive: summary.total_positive,
      totalNegative: summary.total_negative,
      reviewScoreDesc: summary.review_score_desc,
    };
  } catch (error) {
    console.warn(`Error fetching reviews for app ${appId}:`, error);
    return null;
  }
}

export interface SyncProgress {
  total: number;
  current: number;
  currentGame: string;
}

export type SyncProgressCallback = (progress: SyncProgress) => void;

export interface SyncResult {
  totalGames: number;
  imported: number;
  updated: number;
  failed: number;
  errors: Array<{ appId: number; name: string; error: string }>;
}

export async function syncSteamLibrary(
  apiKey: string,
  steamId: string,
  onProgress?: SyncProgressCallback,
  fetchDetails: boolean = true
): Promise<SyncResult> {
  const result: SyncResult = {
    totalGames: 0,
    imported: 0,
    updated: 0,
    failed: 0,
    errors: [],
  };

  // Fetch owned games list
  const ownedGames = await fetchSteamOwnedGames(apiKey, steamId);
  result.totalGames = ownedGames.length;

  for (let i = 0; i < ownedGames.length; i++) {
    const game = ownedGames[i];

    if (onProgress) {
      onProgress({
        total: ownedGames.length,
        current: i + 1,
        currentGame: game.name,
      });
    }

    try {
      let gameInput: CreateGameInput = {
        title: game.name,
        slug: getUniqueSlug(game.name, game.appid),
        steamAppId: game.appid,
        playtimeMinutes: game.playtime_forever,
        coverImageUrl: `https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/header.jpg`,
      };

      // For quick sync (fetchDetails=false), only update playtime for existing games
      // This prevents overwriting detailed metadata with null values
      if (!fetchDetails && gameExistsBySteamAppId(game.appid)) {
        // Game exists - just update playtime, preserve all other metadata
        updateGamePlaytime(game.appid, game.playtime_forever);
        result.updated++;
      } else {
        // Full sync or new game - fetch details if requested
        if (fetchDetails) {
          await delay(RATE_LIMIT_DELAY); // Rate limit
          const details = await fetchSteamAppDetails(game.appid);

          if (details) {
            gameInput = {
              ...gameInput,
              description: details.detailed_description || details.about_the_game,
              shortDescription: details.short_description,
              developer: details.developers?.join(', ') || null,
              publisher: details.publishers?.join(', ') || null,
              releaseDate: details.release_date?.date || null,
              genres: details.genres?.map((g) => g.description) || [],
              tags: details.categories?.map((c) => c.description) || [],
              metacriticScore: details.metacritic?.score || null,
              metacriticUrl: details.metacritic?.url || null,
              screenshots: details.screenshots?.map((s) => s.path_full) || [],
              coverImageUrl: details.header_image || gameInput.coverImageUrl,
            };
          }
        }

        // Upsert game (new game or full sync)
        const gameId = upsertGameBySteamAppId(gameInput);

        // Add platform record
        addGamePlatform(gameId, 'steam', game.appid.toString(), true);

        result.imported++;
      }
    } catch (error) {
      result.failed++;
      result.errors.push({
        appId: game.appid,
        name: game.name,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  return result;
}

// Quick sync - just basic info, no detailed API calls
export async function quickSyncSteamLibrary(
  apiKey: string,
  steamId: string,
  onProgress?: SyncProgressCallback
): Promise<SyncResult> {
  return syncSteamLibrary(apiKey, steamId, onProgress, false);
}

// Export SteamAppDetailsData for use in other modules
export type { SteamAppDetailsData };

/**
 * Convert Steam App Details API response to SteamMetadataInput format
 * This helper extracts all extended metadata fields from the Steam API
 */
export function convertSteamDetailsToMetadata(details: SteamAppDetailsData): import('../db/repositories/gameRepository.js').SteamMetadataInput {
  // Extract movie URLs with proper fallbacks
  const movies = details.movies?.map((m) => ({
    name: m.name,
    thumbnail: m.thumbnail,
    mp4Url: m.mp4?.max || m.mp4?.['480'],
    webmUrl: m.webm?.max || m.webm?.['480'],
  })) ?? null;

  // Normalize requirements (can be object or empty array)
  const normalizeRequirements = (req: { minimum?: string; recommended?: string } | string[] | undefined) => {
    if (!req) return null;
    if (Array.isArray(req)) return null; // Empty array means no requirements
    return req;
  };

  return {
    gameType: details.type,
    requiredAge: typeof details.required_age === 'number' ? details.required_age : parseInt(String(details.required_age), 10) || 0,
    isFree: details.is_free,
    controllerSupport: details.controller_support ?? null,
    supportedLanguages: details.supported_languages ?? null,
    website: details.website ?? null,
    backgroundUrl: details.background ?? details.background_raw ?? null,
    platforms: details.platforms ?? null,
    pcRequirements: normalizeRequirements(details.pc_requirements),
    macRequirements: normalizeRequirements(details.mac_requirements),
    linuxRequirements: normalizeRequirements(details.linux_requirements),
    movies,
    recommendationsTotal: details.recommendations?.total ?? null,
    achievementsTotal: details.achievements?.total ?? null,
    priceCurrency: details.price_overview?.currency ?? null,
    priceInitial: details.price_overview?.initial ?? null,
    priceFinal: details.price_overview?.final ?? null,
    priceDiscountPercent: details.price_overview?.discount_percent ?? null,
    contentDescriptors: details.content_descriptors?.ids ?? null,
    dlcAppIds: details.dlc ?? null,
  };
}

/**
 * Fetch extended Steam metadata for a game
 * Combines app details + reviews into a single response
 */
export async function fetchExtendedSteamMetadata(appId: number): Promise<{
  details: SteamAppDetailsData | null;
  reviews: SteamReviewData | null;
}> {
  // Fetch both in parallel (slightly faster)
  const [details, reviews] = await Promise.all([
    fetchSteamAppDetails(appId),
    fetchSteamReviews(appId),
  ]);

  return { details, reviews };
}
