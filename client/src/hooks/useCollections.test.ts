import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import { useCollections, clearCollectionsCache } from './useCollections';
import { fetchCollections } from '../services/collectionsService';
import { Collection } from '../types/collection';

vi.mock('../services/collectionsService');

describe('useCollections', () => {
  const mockCollections: Collection[] = [
    {
      id: 1,
      name: 'Favorites',
      description: 'My favorite games',
      isSmartFilter: false,
      filterCriteria: null,
      gameCount: 10,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
    {
      id: 2,
      name: 'High Rated RPGs',
      description: null,
      isSmartFilter: true,
      filterCriteria: { genres: ['RPG'], sortBy: 'metacritic_score' },
      gameCount: 0,
      createdAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z',
    },
  ];

  beforeEach(() => {
    vi.resetAllMocks();
    clearCollectionsCache();
  });

  afterEach(() => {
    clearCollectionsCache();
  });

  it('should start with loading state', () => {
    vi.mocked(fetchCollections).mockReturnValue(new Promise(() => {})); // Never resolves

    const { result } = renderHook(() => useCollections());

    expect(result.current.loading).toBe(true);
    expect(result.current.collections).toEqual([]);
    expect(result.current.error).toBeNull();
  });

  it('should fetch and return collections', async () => {
    vi.mocked(fetchCollections).mockResolvedValueOnce(mockCollections);

    const { result } = renderHook(() => useCollections());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.collections).toEqual(mockCollections);
    expect(result.current.error).toBeNull();
    expect(fetchCollections).toHaveBeenCalledTimes(1);
  });

  it('should handle fetch error', async () => {
    vi.mocked(fetchCollections).mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => useCollections());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.collections).toEqual([]);
    expect(result.current.error).toBe('Network error');
  });

  it('should handle non-Error rejection', async () => {
    vi.mocked(fetchCollections).mockRejectedValueOnce('Unknown error');

    const { result } = renderHook(() => useCollections());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBe('Failed to load collections');
  });

  it('should use cached data on subsequent mounts', async () => {
    vi.mocked(fetchCollections).mockResolvedValueOnce(mockCollections);

    // First mount
    const { result: result1, unmount } = renderHook(() => useCollections());
    await waitFor(() => {
      expect(result1.current.loading).toBe(false);
    });
    unmount();

    // Second mount - should use cache
    const { result: result2 } = renderHook(() => useCollections());

    // Should immediately have data from cache, no loading
    expect(result2.current.loading).toBe(false);
    expect(result2.current.collections).toEqual(mockCollections);
    expect(fetchCollections).toHaveBeenCalledTimes(1); // Only called once
  });

  it('should refresh collections when refresh is called', async () => {
    const updatedCollections: Collection[] = [
      ...mockCollections,
      {
        id: 3,
        name: 'New Collection',
        description: null,
        isSmartFilter: false,
        filterCriteria: null,
        gameCount: 5,
        createdAt: '2024-01-02T00:00:00Z',
        updatedAt: '2024-01-02T00:00:00Z',
      },
    ];

    vi.mocked(fetchCollections)
      .mockResolvedValueOnce(mockCollections)
      .mockResolvedValueOnce(updatedCollections);

    const { result } = renderHook(() => useCollections());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.collections).toEqual(mockCollections);

    // Call refresh
    act(() => {
      result.current.refresh();
    });

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.collections).toEqual(updatedCollections);
    expect(fetchCollections).toHaveBeenCalledTimes(2);
  });

  it('should clear error on refresh', async () => {
    vi.mocked(fetchCollections)
      .mockRejectedValueOnce(new Error('First error'))
      .mockResolvedValueOnce(mockCollections);

    const { result } = renderHook(() => useCollections());

    await waitFor(() => {
      expect(result.current.error).toBe('First error');
    });

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.collections).toEqual(mockCollections);
  });

  describe('clearCollectionsCache', () => {
    it('should clear the cache so next mount fetches fresh data', async () => {
      vi.mocked(fetchCollections)
        .mockResolvedValueOnce(mockCollections)
        .mockResolvedValueOnce([mockCollections[0]]);

      // First mount
      const { result: result1, unmount } = renderHook(() => useCollections());
      await waitFor(() => {
        expect(result1.current.loading).toBe(false);
      });
      unmount();

      // Clear cache
      clearCollectionsCache();

      // Second mount - should fetch fresh
      const { result: result2 } = renderHook(() => useCollections());

      await waitFor(() => {
        expect(result2.current.loading).toBe(false);
      });

      expect(result2.current.collections).toEqual([mockCollections[0]]);
      expect(fetchCollections).toHaveBeenCalledTimes(2);
    });
  });
});
