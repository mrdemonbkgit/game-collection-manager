import { fetchApi } from './api';
import {
  GamesApiResponse,
  GameApiResponse,
  ApiResponse,
  PaginatedData,
  Game,
  transformGame,
} from '../types/game';

export interface FetchGamesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  genres?: string[];      // Multi-select support
  platforms?: string[];   // Multi-select support
  collections?: number[]; // Collection IDs to filter by
  sortBy?: 'title' | 'release_date' | 'metacritic_score' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

export interface SortOption {
  id: string;
  label: string;
  sortBy: 'title' | 'release_date' | 'metacritic_score' | 'created_at';
  sortOrder: 'asc' | 'desc';
}

export interface FilterOptions {
  platforms: string[];
  genres: string[];
  sortOptions: SortOption[];
}

export async function fetchGames(
  params: FetchGamesParams = {}
): Promise<PaginatedData<Game>> {
  const {
    page = 1,
    pageSize = 50,
    search,
    genres,
    platforms,
    collections,
    sortBy = 'title',
    sortOrder = 'asc',
  } = params;

  const queryParams = new URLSearchParams({
    limit: pageSize.toString(),
    offset: ((page - 1) * pageSize).toString(),
    sortBy,
    sortOrder,
  });

  if (search) queryParams.set('search', search);
  // Use CSV format for multi-select params
  if (platforms && platforms.length > 0) queryParams.set('platforms', platforms.join(','));
  if (genres && genres.length > 0) queryParams.set('genres', genres.join(','));
  if (collections && collections.length > 0) queryParams.set('collections', collections.join(','));

  const response = await fetchApi<GamesApiResponse>(
    `/games?${queryParams.toString()}`
  );

  if (!response.data) {
    throw new Error('No data in response');
  }

  // Transform snake_case to camelCase
  return {
    items: response.data.items.map(transformGame),
    total: response.data.total,
    page: response.data.page,
    pageSize: response.data.pageSize,
    totalPages: response.data.totalPages,
  };
}

export async function fetchGameCount(): Promise<number> {
  const response = await fetchApi<{
    success: boolean;
    data: { count: number };
  }>('/games/count');
  return response.data.count;
}

export async function fetchFilterOptions(): Promise<FilterOptions> {
  const response = await fetchApi<{
    success: boolean;
    data: FilterOptions;
  }>('/games/filters');
  return response.data;
}

export async function fetchGameBySlug(slug: string): Promise<Game> {
  const response = await fetchApi<ApiResponse<GameApiResponse>>(
    `/games/slug/${encodeURIComponent(slug)}`
  );

  if (!response.data) {
    throw new Error('Game not found');
  }

  return transformGame(response.data);
}

export async function fetchGameById(id: number): Promise<Game> {
  const response = await fetchApi<ApiResponse<GameApiResponse>>(
    `/games/${id}`
  );

  if (!response.data) {
    throw new Error('Game not found');
  }

  return transformGame(response.data);
}

export interface SteamGridAssets {
  heroUrl: string | null;
  logoUrl: string | null;
}

export async function fetchGameAssets(gameId: number): Promise<SteamGridAssets> {
  const response = await fetchApi<ApiResponse<SteamGridAssets>>(
    `/games/${gameId}/steamgrid-assets`
  );

  if (!response.data) {
    throw new Error('Failed to fetch game assets');
  }

  return response.data;
}

export async function fetchSimilarGames(gameId: number, limit = 10): Promise<Game[]> {
  const response = await fetchApi<ApiResponse<GameApiResponse[]>>(
    `/games/${gameId}/similar?limit=${limit}`
  );

  if (!response.data) {
    return [];
  }

  return response.data.map(transformGame);
}

// Asset Fix Types
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

export async function fetchHeroOptions(
  gameId: number,
  limit = 6,
  offset = 0
): Promise<AssetOptionsResponse> {
  const response = await fetchApi<ApiResponse<AssetOptionsResponse>>(
    `/games/${gameId}/steamgrid-heroes?limit=${limit}&offset=${offset}`
  );

  if (!response.data) {
    return { options: [], total: 0, hasMore: false, currentAssetId: null, currentLocalUrl: null };
  }

  return response.data;
}

export async function fetchLogoOptions(
  gameId: number,
  limit = 6,
  offset = 0
): Promise<AssetOptionsResponse> {
  const response = await fetchApi<ApiResponse<AssetOptionsResponse>>(
    `/games/${gameId}/steamgrid-logos?limit=${limit}&offset=${offset}`
  );

  if (!response.data) {
    return { options: [], total: 0, hasMore: false, currentAssetId: null, currentLocalUrl: null };
  }

  return response.data;
}

export interface SaveAssetsRequest {
  heroAssetId?: number;
  logoAssetId?: number;
}

export interface SaveAssetsResponse {
  success: boolean;
  heroLocalUrl?: string;
  logoLocalUrl?: string;
  errors: string[];
}

export async function saveGameAssets(
  gameId: number,
  request: SaveAssetsRequest
): Promise<SaveAssetsResponse> {
  const response = await fetchApi<ApiResponse<SaveAssetsResponse>>(
    `/games/${gameId}/assets`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    }
  );

  if (!response.data) {
    return { success: false, errors: ['Failed to save assets'] };
  }

  return response.data;
}
