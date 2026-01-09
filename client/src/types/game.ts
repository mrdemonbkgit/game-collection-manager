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

// Platform support object (Windows/Mac/Linux)
export interface PlatformSupport {
  windows?: boolean;
  mac?: boolean;
  linux?: boolean;
}

// System requirements
export interface SystemRequirements {
  minimum?: string;
  recommended?: string;
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

  // SteamGridDB assets
  steamgrid_id?: number | null;
  hero_url?: string | null;
  logo_url?: string | null;
  icon_url?: string | null;
  steamgrid_name?: string | null;
  steamgrid_verified?: number | null;
  grids_count?: number | null;
  heroes_count?: number | null;
  logos_count?: number | null;
  icons_count?: number | null;
  assets_checked_at?: string | null;

  // IGDB fields
  igdb_id?: number | null;
  igdb_slug?: string | null;
  igdb_rating?: number | null;
  igdb_rating_count?: number | null;
  igdb_aggregated_rating?: number | null;
  igdb_aggregated_rating_count?: number | null;
  igdb_total_rating?: number | null;
  storyline?: string | null;
  themes?: string[];
  game_modes?: string[];
  player_perspectives?: string[];
  igdb_genres?: string[];
  igdb_platforms?: string[];
  igdb_summary?: string | null;
  igdb_match_confidence?: number | null;
  igdb_updated_at?: string | null;

  // Extended Steam fields
  game_type?: string | null;
  required_age?: number | null;
  is_free?: number | null;
  controller_support?: string | null;
  supported_languages?: string | null;
  website?: string | null;
  background_url?: string | null;
  platform_support?: PlatformSupport | null;
  pc_requirements?: SystemRequirements | null;
  mac_requirements?: SystemRequirements | null;
  linux_requirements?: SystemRequirements | null;
  movies?: Array<{
    name: string;
    thumbnail: string;
    mp4Url?: string;
    webmUrl?: string;
  }> | null;
  recommendations_total?: number | null;
  achievements_total?: number | null;
  review_score?: number | null;
  review_score_desc?: string | null;
  reviews_positive?: number | null;
  reviews_negative?: number | null;
  price_currency?: string | null;
  price_initial?: number | null;
  price_final?: number | null;
  price_discount_percent?: number | null;
  content_descriptors?: number[] | null;
  dlc_app_ids?: number[] | null;
  last_played_at?: string | null;
  steam_data_updated_at?: string | null;
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

  // SteamGridDB assets
  steamgridId: number | null;
  heroUrl: string | null;
  logoUrl: string | null;
  iconUrl: string | null;
  steamgridName: string | null;
  steamgridVerified: boolean;
  gridsCount: number | null;
  heroesCount: number | null;
  logosCount: number | null;
  iconsCount: number | null;
  assetsCheckedAt: string | null;

  // IGDB fields
  igdbId: number | null;
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
  igdbUpdatedAt: string | null;

  // Extended Steam fields
  gameType: string | null;
  requiredAge: number | null;
  isFree: boolean;
  controllerSupport: string | null;
  supportedLanguages: string | null;
  website: string | null;
  backgroundUrl: string | null;
  platformSupport: PlatformSupport | null;
  pcRequirements: SystemRequirements | null;
  macRequirements: SystemRequirements | null;
  linuxRequirements: SystemRequirements | null;
  movies: Array<{
    name: string;
    thumbnail: string;
    mp4Url?: string;
    webmUrl?: string;
  }> | null;
  recommendationsTotal: number | null;
  achievementsTotal: number | null;
  reviewScore: number | null;
  reviewScoreDesc: string | null;
  reviewsPositive: number | null;
  reviewsNegative: number | null;
  priceCurrency: string | null;
  priceInitial: number | null;
  priceFinal: number | null;
  priceDiscountPercent: number | null;
  contentDescriptors: number[] | null;
  dlcAppIds: number[] | null;
  lastPlayedAt: string | null;
  steamDataUpdatedAt: string | null;
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

// Helper to safely parse JSON fields
function safeParseJson<T>(value: unknown, defaultValue: T): T {
  if (value === null || value === undefined) return defaultValue;
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch {
      return defaultValue;
    }
  }
  return value as T;
}

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

    // SteamGridDB assets
    steamgridId: raw.steamgrid_id ?? null,
    heroUrl: raw.hero_url ?? null,
    logoUrl: raw.logo_url ?? null,
    iconUrl: raw.icon_url ?? null,
    steamgridName: raw.steamgrid_name ?? null,
    steamgridVerified: raw.steamgrid_verified === 1,
    gridsCount: raw.grids_count ?? null,
    heroesCount: raw.heroes_count ?? null,
    logosCount: raw.logos_count ?? null,
    iconsCount: raw.icons_count ?? null,
    assetsCheckedAt: raw.assets_checked_at ?? null,

    // IGDB fields
    igdbId: raw.igdb_id ?? null,
    igdbSlug: raw.igdb_slug ?? null,
    igdbRating: raw.igdb_rating ?? null,
    igdbRatingCount: raw.igdb_rating_count ?? null,
    igdbAggregatedRating: raw.igdb_aggregated_rating ?? null,
    igdbAggregatedRatingCount: raw.igdb_aggregated_rating_count ?? null,
    igdbTotalRating: raw.igdb_total_rating ?? null,
    storyline: raw.storyline ?? null,
    themes: safeParseJson(raw.themes, []),
    gameModes: safeParseJson(raw.game_modes, []),
    playerPerspectives: safeParseJson(raw.player_perspectives, []),
    igdbGenres: safeParseJson(raw.igdb_genres, []),
    igdbPlatforms: safeParseJson(raw.igdb_platforms, []),
    igdbSummary: raw.igdb_summary ?? null,
    igdbMatchConfidence: raw.igdb_match_confidence ?? null,
    igdbUpdatedAt: raw.igdb_updated_at ?? null,

    // Extended Steam fields
    gameType: raw.game_type ?? null,
    requiredAge: raw.required_age ?? null,
    isFree: raw.is_free === 1,
    controllerSupport: raw.controller_support ?? null,
    supportedLanguages: raw.supported_languages ?? null,
    website: raw.website ?? null,
    backgroundUrl: raw.background_url ?? null,
    platformSupport: safeParseJson(raw.platform_support, null),
    pcRequirements: safeParseJson(raw.pc_requirements, null),
    macRequirements: safeParseJson(raw.mac_requirements, null),
    linuxRequirements: safeParseJson(raw.linux_requirements, null),
    movies: safeParseJson(raw.movies, null),
    recommendationsTotal: raw.recommendations_total ?? null,
    achievementsTotal: raw.achievements_total ?? null,
    reviewScore: raw.review_score ?? null,
    reviewScoreDesc: raw.review_score_desc ?? null,
    reviewsPositive: raw.reviews_positive ?? null,
    reviewsNegative: raw.reviews_negative ?? null,
    priceCurrency: raw.price_currency ?? null,
    priceInitial: raw.price_initial ?? null,
    priceFinal: raw.price_final ?? null,
    priceDiscountPercent: raw.price_discount_percent ?? null,
    contentDescriptors: safeParseJson(raw.content_descriptors, null),
    dlcAppIds: safeParseJson(raw.dlc_app_ids, null),
    lastPlayedAt: raw.last_played_at ?? null,
    steamDataUpdatedAt: raw.steam_data_updated_at ?? null,
  };
}
