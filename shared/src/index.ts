// Game Collection - Shared Types

export type PlatformType = 'steam' | 'gamepass' | 'eaplay' | 'ubisoftplus';

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
  createdAt: string;
  updatedAt: string;
}

export interface GamePlatform {
  id: number;
  gameId: number;
  platformType: PlatformType;
  platformGameId: string;
  isPrimary: boolean;
}

export interface Collection {
  id: number;
  name: string;
  description: string | null;
  isSmartFilter: boolean;
  filterCriteria: FilterCriteria | null;
  createdAt: string;
  updatedAt: string;
}

export interface FilterCriteria {
  platforms?: PlatformType[];
  genres?: string[];
  tags?: string[];
  developers?: string[];
  publishers?: string[];
  releaseYearMin?: number;
  releaseYearMax?: number;
  metacriticMin?: number;
  metacriticMax?: number;
  steamRatingMin?: number;
}

export interface CollectionGame {
  collectionId: number;
  gameId: number;
}

export interface AIConversation {
  id: number;
  createdAt: string;
  updatedAt: string;
}

export interface AIMessage {
  id: number;
  conversationId: number;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
}

export interface UserPreference {
  key: string;
  value: unknown;
}

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface GameWithPlatforms extends Game {
  platforms: GamePlatform[];
}

// Steam API Types
export interface SteamOwnedGame {
  appid: number;
  name: string;
  playtime_forever: number;
  img_icon_url: string;
  playtime_windows_forever?: number;
  playtime_mac_forever?: number;
  playtime_linux_forever?: number;
  rtime_last_played?: number;
}

export interface SteamOwnedGamesResponse {
  response: {
    game_count: number;
    games: SteamOwnedGame[];
  };
}

export interface SteamAppDetails {
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

// Filter/Sort Types for API
export interface GameFilters {
  platform?: PlatformType;
  genre?: string;
  tag?: string;
  developer?: string;
  publisher?: string;
  releaseYearMin?: number;
  releaseYearMax?: number;
  metacriticMin?: number;
  metacriticMax?: number;
  steamRatingMin?: number;
  search?: string;
}

export type SortField = 'title' | 'releaseDate' | 'metacriticScore' | 'steamRating' | 'createdAt';
export type SortOrder = 'asc' | 'desc';

export interface GameQueryParams extends GameFilters {
  page?: number;
  pageSize?: number;
  sortBy?: SortField;
  sortOrder?: SortOrder;
}
