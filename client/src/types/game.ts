// Platform types
export type PlatformType = 'steam' | 'gamepass' | 'eaplay' | 'ubisoftplus';

// Raw API response type for platforms (snake_case from server)
export interface GamePlatformApiResponse {
  id: number;
  game_id: number;
  platform_type: string;
  platform_game_id: string;
  is_primary: number;
}

// Client-side platform type (camelCase)
export interface GamePlatform {
  id: number;
  gameId: number;
  platformType: PlatformType;
  platformGameId: string;
  isPrimary: boolean;
}

// Raw API response types (snake_case from server)
export interface GameApiResponse {
  id: number;
  title: string;
  slug: string;
  cover_image_url: string | null;
  screenshots: string[];
  description: string | null;
  short_description: string | null;
  developer: string | null;
  publisher: string | null;
  release_date: string | null;
  genres: string[];
  tags: string[];
  metacritic_score: number | null;
  metacritic_url: string | null;
  steam_rating: number | null;
  steam_rating_count: number | null;
  steam_app_id: number | null;
  playtime_minutes: number;
  created_at: string;
  updated_at: string;
  platforms?: GamePlatformApiResponse[];
}

// Client-side model (camelCase)
export interface Game {
  id: number;
  title: string;
  slug: string;
  coverImageUrl: string | null;
  screenshots: string[];
  description: string | null;
  shortDescription: string | null;
  developer: string | null;
  publisher: string | null;
  releaseDate: string | null;
  genres: string[];
  tags: string[];
  metacriticScore: number | null;
  metacriticUrl: string | null;
  steamRating: number | null;
  steamRatingCount: number | null;
  steamAppId: number | null;
  playtimeMinutes: number;
  createdAt: string;
  updatedAt: string;
  platforms: GamePlatform[];
}

// API response wrappers
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedData<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export type GamesApiResponse = ApiResponse<PaginatedData<GameApiResponse>>;

// Transform function: snake_case -> camelCase
export function transformGame(raw: GameApiResponse): Game {
  return {
    id: raw.id,
    title: raw.title,
    slug: raw.slug,
    coverImageUrl: raw.cover_image_url,
    screenshots: raw.screenshots ?? [],
    description: raw.description,
    shortDescription: raw.short_description,
    developer: raw.developer,
    publisher: raw.publisher,
    releaseDate: raw.release_date,
    genres: raw.genres ?? [],
    tags: raw.tags ?? [],
    metacriticScore: raw.metacritic_score,
    metacriticUrl: raw.metacritic_url,
    steamRating: raw.steam_rating,
    steamRatingCount: raw.steam_rating_count,
    steamAppId: raw.steam_app_id,
    playtimeMinutes: raw.playtime_minutes ?? 0,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
    platforms: (raw.platforms ?? []).map((p) => ({
      id: p.id,
      gameId: p.game_id,
      platformType: p.platform_type as PlatformType,
      platformGameId: p.platform_game_id,
      isPrimary: p.is_primary === 1,
    })),
  };
}
