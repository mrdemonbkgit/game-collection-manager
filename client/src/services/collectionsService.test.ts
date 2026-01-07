import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  fetchCollections,
  fetchCollection,
  createCollection,
  updateCollection,
  deleteCollection,
  addGameToCollection,
  removeGameFromCollection,
} from './collectionsService';
import { Collection, CollectionApiResponse } from '../types/collection';

describe('collectionsService', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const mockApiCollection: CollectionApiResponse = {
    id: 1,
    name: 'Favorites',
    description: 'My favorite games',
    is_smart_filter: 0,
    filter_criteria: null,
    game_count: 10,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  };

  const expectedCollection: Collection = {
    id: 1,
    name: 'Favorites',
    description: 'My favorite games',
    isSmartFilter: false,
    filterCriteria: null,
    gameCount: 10,
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-01T00:00:00Z',
  };

  describe('fetchCollections', () => {
    it('should fetch and transform collections', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [mockApiCollection],
          }),
      } as Response);

      const result = await fetchCollections();

      expect(fetch).toHaveBeenCalledWith('/api/collections', {
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual([expectedCollection]);
    });

    it('should return empty array when no collections', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [],
          }),
      } as Response);

      const result = await fetchCollections();

      expect(result).toEqual([]);
    });

    it('should transform smart filter with criteria', async () => {
      const smartFilterApi: CollectionApiResponse = {
        ...mockApiCollection,
        id: 2,
        name: 'High Rated RPGs',
        is_smart_filter: 1,
        filter_criteria: JSON.stringify({
          genres: ['RPG'],
          sortBy: 'metacritic_score',
        }),
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: [smartFilterApi],
          }),
      } as Response);

      const result = await fetchCollections();

      expect(result[0].isSmartFilter).toBe(true);
      expect(result[0].filterCriteria).toEqual({
        genres: ['RPG'],
        sortBy: 'metacritic_score',
      });
    });
  });

  describe('fetchCollection', () => {
    it('should fetch and transform a single collection', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockApiCollection,
          }),
      } as Response);

      const result = await fetchCollection(1);

      expect(fetch).toHaveBeenCalledWith('/api/collections/1', {
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual(expectedCollection);
    });
  });

  describe('createCollection', () => {
    it('should create a collection and return transformed result', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: mockApiCollection,
          }),
      } as Response);

      const result = await createCollection({
        name: 'Favorites',
        description: 'My favorite games',
      });

      expect(fetch).toHaveBeenCalledWith('/api/collections', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Favorites',
          description: 'My favorite games',
          is_smart_filter: 0,
          filter_criteria: null,
        }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result).toEqual(expectedCollection);
    });

    it('should create a smart filter with criteria', async () => {
      const smartFilterResponse: CollectionApiResponse = {
        ...mockApiCollection,
        is_smart_filter: 1,
        filter_criteria: JSON.stringify({ genres: ['Action'] }),
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: smartFilterResponse,
          }),
      } as Response);

      await createCollection({
        name: 'Action Games',
        isSmartFilter: true,
        filterCriteria: { genres: ['Action'] },
      });

      const calledWith = vi.mocked(fetch).mock.calls[0];
      const body = JSON.parse(calledWith[1]?.body as string);
      expect(body.is_smart_filter).toBe(1);
      expect(body.filter_criteria).toBe(JSON.stringify({ genres: ['Action'] }));
    });
  });

  describe('updateCollection', () => {
    it('should update a collection', async () => {
      const updatedApi: CollectionApiResponse = {
        ...mockApiCollection,
        name: 'Updated Name',
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            success: true,
            data: updatedApi,
          }),
      } as Response);

      const result = await updateCollection(1, { name: 'Updated Name' });

      expect(fetch).toHaveBeenCalledWith('/api/collections/1', {
        method: 'PUT',
        body: JSON.stringify({ name: 'Updated Name' }),
        headers: { 'Content-Type': 'application/json' },
      });
      expect(result.name).toBe('Updated Name');
    });
  });

  describe('deleteCollection', () => {
    it('should delete a collection', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response);

      await deleteCollection(1);

      expect(fetch).toHaveBeenCalledWith('/api/collections/1', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('addGameToCollection', () => {
    it('should add a game to a collection', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response);

      await addGameToCollection(1, 42);

      expect(fetch).toHaveBeenCalledWith('/api/collections/1/games/42', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });

  describe('removeGameFromCollection', () => {
    it('should remove a game from a collection', async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response);

      await removeGameFromCollection(1, 42);

      expect(fetch).toHaveBeenCalledWith('/api/collections/1/games/42', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
      });
    });
  });
});
