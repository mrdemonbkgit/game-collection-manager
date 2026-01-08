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
