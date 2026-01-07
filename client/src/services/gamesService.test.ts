import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGames, fetchGameCount, fetchFilterOptions } from './gamesService';

// Mock the api module
vi.mock('./api', () => ({
  fetchApi: vi.fn(),
}));

import { fetchApi } from './api';

describe('gamesService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('fetchGames', () => {
    const mockApiResponse = {
      success: true,
      data: {
        items: [
          {
            id: 1,
            title: 'Test Game',
            slug: 'test-game',
            cover_image_url: 'https://example.com/cover.jpg',
            screenshots: [],
            description: 'A test',
            short_description: 'Test',
            developer: 'Dev',
            publisher: 'Pub',
            release_date: '2024-01-01',
            genres: ['Action'],
            tags: ['Singleplayer'],
            metacritic_score: 85,
            metacritic_url: null,
            steam_rating: null,
            steam_rating_count: null,
            steam_app_id: 12345,
            playtime_minutes: 100,
            created_at: '2024-01-01T00:00:00Z',
            updated_at: '2024-01-01T00:00:00Z',
          },
        ],
        total: 1,
        page: 1,
        pageSize: 50,
        totalPages: 1,
      },
    };

    it('should call fetchApi with correct query params', async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(mockApiResponse);

      await fetchGames({ page: 2, pageSize: 25 });

      expect(fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('limit=25')
      );
      expect(fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('offset=25')
      );
    });

    it('should use default params when none provided', async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(mockApiResponse);

      await fetchGames();

      expect(fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('limit=50')
      );
      expect(fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('offset=0')
      );
      expect(fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('sortBy=title')
      );
      expect(fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('sortOrder=asc')
      );
    });

    it('should include search param when provided', async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(mockApiResponse);

      await fetchGames({ search: 'witcher' });

      expect(fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('search=witcher')
      );
    });

    it('should include genres param when provided', async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(mockApiResponse);

      await fetchGames({ genres: ['RPG', 'Action'] });

      expect(fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('genres=RPG%2CAction')
      );
    });

    it('should include platforms param when provided', async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(mockApiResponse);

      await fetchGames({ platforms: ['steam', 'gamepass'] });

      expect(fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('platforms=steam%2Cgamepass')
      );
    });

    it('should transform response items to camelCase', async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(mockApiResponse);

      const result = await fetchGames();

      expect(result.items[0]).toHaveProperty('coverImageUrl');
      expect(result.items[0]).toHaveProperty('shortDescription');
      expect(result.items[0]).toHaveProperty('steamAppId');
      expect(result.items[0]).toHaveProperty('playtimeMinutes');
      expect(result.items[0]).not.toHaveProperty('cover_image_url');
    });

    it('should return pagination data', async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(mockApiResponse);

      const result = await fetchGames();

      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.pageSize).toBe(50);
      expect(result.totalPages).toBe(1);
    });

    it('should throw error when no data in response', async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce({ success: true });

      await expect(fetchGames()).rejects.toThrow('No data in response');
    });

    it('should handle custom sort options', async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce(mockApiResponse);

      await fetchGames({ sortBy: 'metacritic_score', sortOrder: 'desc' });

      expect(fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('sortBy=metacritic_score')
      );
      expect(fetchApi).toHaveBeenCalledWith(
        expect.stringContaining('sortOrder=desc')
      );
    });
  });

  describe('fetchGameCount', () => {
    it('should return count from API', async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce({
        success: true,
        data: { count: 2420 },
      });

      const count = await fetchGameCount();

      expect(count).toBe(2420);
      expect(fetchApi).toHaveBeenCalledWith('/games/count');
    });

    it('should return 0 when no games', async () => {
      vi.mocked(fetchApi).mockResolvedValueOnce({
        success: true,
        data: { count: 0 },
      });

      const count = await fetchGameCount();

      expect(count).toBe(0);
    });
  });

  describe('fetchFilterOptions', () => {
    it('should return filter options from API', async () => {
      const mockOptions = {
        platforms: ['steam', 'gamepass'],
        genres: ['Action', 'RPG'],
        sortOptions: [
          { id: 'title-asc', label: 'Title A-Z', sortBy: 'title', sortOrder: 'asc' },
        ],
      };

      vi.mocked(fetchApi).mockResolvedValueOnce({
        success: true,
        data: mockOptions,
      });

      const result = await fetchFilterOptions();

      expect(result).toEqual(mockOptions);
      expect(fetchApi).toHaveBeenCalledWith('/games/filters');
    });
  });
});
