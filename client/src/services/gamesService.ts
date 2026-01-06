import { fetchApi } from './api';
import {
  GamesApiResponse,
  PaginatedData,
  Game,
  transformGame,
} from '../types/game';

export interface FetchGamesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  genre?: string;
  platform?: string;
  sortBy?: 'title' | 'release_date' | 'metacritic_score' | 'created_at';
  sortOrder?: 'asc' | 'desc';
}

export async function fetchGames(
  params: FetchGamesParams = {}
): Promise<PaginatedData<Game>> {
  const {
    page = 1,
    pageSize = 50,
    search,
    genre,
    platform,
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
  if (genre) queryParams.set('genre', genre);
  if (platform) queryParams.set('platform', platform);

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
