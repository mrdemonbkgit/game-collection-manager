import {
  upsertGameBySteamAppId,
  addGamePlatform,
  getUniqueSlug,
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

interface SteamAppDetails {
  success: boolean;
  data?: {
    type: string;
    name: string;
    steam_appid: number;
    required_age: number;
    is_free: boolean;
    detailed_description: string;
    about_the_game: string;
    short_description: string;
    header_image: string;
    capsule_image: string;
    capsule_imagev5: string;
    website: string | null;
    developers?: string[];
    publishers?: string[];
    genres?: Array<{ id: string; description: string }>;
    categories?: Array<{ id: number; description: string }>;
    screenshots?: Array<{ id: number; path_thumbnail: string; path_full: string }>;
    release_date?: { coming_soon: boolean; date: string };
    metacritic?: { score: number; url: string };
    recommendations?: { total: number };
  };
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

export async function fetchSteamAppDetails(appId: number): Promise<SteamAppDetails['data'] | null> {
  const url = `${STEAM_STORE_API}/appdetails?appids=${appId}`;

  try {
    const response = await fetch(url);

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
 */
export async function fetchSteamReviews(appId: number): Promise<SteamReviewData | null> {
  const url = `https://store.steampowered.com/appreviews/${appId}?json=1&language=all&purchase_type=all`;

  try {
    const response = await fetch(url);

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

      // Optionally fetch detailed info (slower but more complete)
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

      // Upsert game
      const gameId = upsertGameBySteamAppId(gameInput);

      // Add platform record
      addGamePlatform(gameId, 'steam', game.appid.toString(), true);

      result.imported++;
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
