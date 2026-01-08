import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useGames } from './useGames';

// Mock the gamesService
vi.mock('../services/gamesService', () => ({
  fetchGames: vi.fn(),
}));

import { fetchGames } from '../services/gamesService';

const mockGame = (id: number) => ({
  id,
  title: `Game ${id}`,
  slug: `game-${id}`,
  coverImageUrl: `https://example.com/game${id}.jpg`,
  screenshots: [],
  description: null,
  shortDescription: null,
  developer: null,
  publisher: null,
  releaseDate: null,
  genres: [],
  tags: [],
  metacriticScore: null,
  metacriticUrl: null,
  steamRating: null,
  steamRatingCount: null,
  steamAppId: id * 1000,
  playtimeMinutes: 0,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-01T00:00:00Z',
  platforms: [],
});

describe('useGames', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should start with loading state', () => {
    vi.mocked(fetchGames).mockImplementation(() => new Promise(() => {}));

    const { result } = renderHook(() => useGames());

    expect(result.current.loading).toBe(true);
    expect(result.current.games).toEqual([]);
    expect(result.current.total).toBe(0);
  });

  it('should load games on mount', async () => {
    const mockResponse = {
      items: [mockGame(1), mockGame(2)],
      total: 2,
      page: 1,
      pageSize: 48,
      totalPages: 1,
    };

    vi.mocked(fetchGames).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useGames());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.games).toHaveLength(2);
    expect(result.current.total).toBe(2);
    expect(result.current.games[0].title).toBe('Game 1');
  });

  it('should handle error state', async () => {
    vi.mocked(fetchGames).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useGames());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Network error');
    expect(result.current.games).toEqual([]);
  });

  it('should calculate totalPages correctly', async () => {
    const mockResponse = {
      items: Array.from({ length: 48 }, (_, i) => mockGame(i + 1)),
      total: 100,
      page: 1,
      pageSize: 48,
      totalPages: 3,
    };

    vi.mocked(fetchGames).mockResolvedValueOnce(mockResponse);

    const { result } = renderHook(() => useGames());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.totalPages).toBe(3); // ceil(100/48) = 3
  });

  it('should reload when params change', async () => {
    const response1 = {
      items: [mockGame(1)],
      total: 1,
      page: 1,
      pageSize: 48,
      totalPages: 1,
    };

    const response2 = {
      items: [mockGame(2), mockGame(3)],
      total: 2,
      page: 1,
      pageSize: 48,
      totalPages: 1,
    };

    vi.mocked(fetchGames)
      .mockResolvedValueOnce(response1)
      .mockResolvedValueOnce(response2);

    type ParamsType = { sortBy: 'title'; sortOrder: 'asc' | 'desc' };
    const { result, rerender } = renderHook(
      ({ params }: { params: ParamsType }) => useGames(params),
      { initialProps: { params: { sortBy: 'title', sortOrder: 'asc' } as ParamsType } }
    );

    await waitFor(() => {
      expect(result.current.games).toHaveLength(1);
    });

    // Change params
    rerender({ params: { sortBy: 'title', sortOrder: 'desc' } as ParamsType });

    await waitFor(() => {
      expect(result.current.games).toHaveLength(2);
    });

    expect(fetchGames).toHaveBeenCalledTimes(2);
  });

  it('should reload when page changes', async () => {
    const page1Response = {
      items: Array.from({ length: 48 }, (_, i) => mockGame(i + 1)),
      total: 96,
      page: 1,
      pageSize: 48,
      totalPages: 2,
    };

    const page2Response = {
      items: Array.from({ length: 48 }, (_, i) => mockGame(i + 49)),
      total: 96,
      page: 2,
      pageSize: 48,
      totalPages: 2,
    };

    vi.mocked(fetchGames)
      .mockResolvedValueOnce(page1Response)
      .mockResolvedValueOnce(page2Response);

    const { result, rerender } = renderHook(
      ({ page }: { page: number }) => useGames({ page }),
      { initialProps: { page: 1 } }
    );

    await waitFor(() => {
      expect(result.current.games[0].title).toBe('Game 1');
    });

    // Change to page 2
    rerender({ page: 2 });

    await waitFor(() => {
      expect(result.current.games[0].title).toBe('Game 49');
    });

    expect(fetchGames).toHaveBeenCalledTimes(2);
  });

  it('should not reload when params object is same values', async () => {
    const mockResponse = {
      items: [mockGame(1)],
      total: 1,
      page: 1,
      pageSize: 48,
      totalPages: 1,
    };

    vi.mocked(fetchGames).mockResolvedValue(mockResponse);

    const { result, rerender } = renderHook(
      ({ params }) => useGames(params),
      { initialProps: { params: { sortBy: 'title' as const } } }
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const callCountAfterInit = vi.mocked(fetchGames).mock.calls.length;

    // Rerender with new object but same values (simulates what happens in component renders)
    rerender({ params: { sortBy: 'title' as const } });

    // Wait a bit to make sure no additional calls happen
    await new Promise((r) => setTimeout(r, 100));

    // Should not have called fetchGames again
    expect(fetchGames).toHaveBeenCalledTimes(callCountAfterInit);
  });
});
