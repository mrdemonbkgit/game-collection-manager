import { describe, it, expect } from 'vitest';
import { transformGame, type GameApiResponse } from './game';

describe('game types', () => {
  describe('transformGame', () => {
    it('should transform snake_case to camelCase', () => {
      const raw: GameApiResponse = {
        id: 1,
        title: 'Test Game',
        slug: 'test-game',
        cover_image_url: 'https://example.com/cover.jpg',
        screenshots: ['https://example.com/ss1.jpg'],
        description: 'A test game',
        short_description: 'Test',
        developer: 'Test Dev',
        publisher: 'Test Pub',
        release_date: '2024-01-15',
        genres: ['Action', 'RPG'],
        tags: ['Singleplayer'],
        metacritic_score: 85,
        metacritic_url: 'https://metacritic.com/game',
        steam_rating: 92.5,
        steam_rating_count: 10000,
        steam_app_id: 12345,
        playtime_minutes: 120,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-15T00:00:00Z',
      };

      const game = transformGame(raw);

      expect(game.id).toBe(1);
      expect(game.title).toBe('Test Game');
      expect(game.slug).toBe('test-game');
      expect(game.coverImageUrl).toBe('https://example.com/cover.jpg');
      expect(game.screenshots).toEqual(['https://example.com/ss1.jpg']);
      expect(game.description).toBe('A test game');
      expect(game.shortDescription).toBe('Test');
      expect(game.developer).toBe('Test Dev');
      expect(game.publisher).toBe('Test Pub');
      expect(game.releaseDate).toBe('2024-01-15');
      expect(game.genres).toEqual(['Action', 'RPG']);
      expect(game.tags).toEqual(['Singleplayer']);
      expect(game.metacriticScore).toBe(85);
      expect(game.metacriticUrl).toBe('https://metacritic.com/game');
      expect(game.steamRating).toBe(92.5);
      expect(game.steamRatingCount).toBe(10000);
      expect(game.steamAppId).toBe(12345);
      expect(game.playtimeMinutes).toBe(120);
      expect(game.createdAt).toBe('2024-01-01T00:00:00Z');
      expect(game.updatedAt).toBe('2024-01-15T00:00:00Z');
    });

    it('should handle null values', () => {
      const raw: GameApiResponse = {
        id: 2,
        title: 'Minimal Game',
        slug: 'minimal-game',
        cover_image_url: null,
        screenshots: [],
        description: null,
        short_description: null,
        developer: null,
        publisher: null,
        release_date: null,
        genres: [],
        tags: [],
        metacritic_score: null,
        metacritic_url: null,
        steam_rating: null,
        steam_rating_count: null,
        steam_app_id: null,
        playtime_minutes: 0,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };

      const game = transformGame(raw);

      expect(game.coverImageUrl).toBeNull();
      expect(game.description).toBeNull();
      expect(game.shortDescription).toBeNull();
      expect(game.developer).toBeNull();
      expect(game.publisher).toBeNull();
      expect(game.releaseDate).toBeNull();
      expect(game.metacriticScore).toBeNull();
      expect(game.metacriticUrl).toBeNull();
      expect(game.steamRating).toBeNull();
      expect(game.steamRatingCount).toBeNull();
      expect(game.steamAppId).toBeNull();
    });

    it('should handle undefined arrays as empty arrays', () => {
      const raw = {
        id: 3,
        title: 'Game Without Arrays',
        slug: 'game-without-arrays',
        cover_image_url: null,
        screenshots: undefined as unknown as string[],
        description: null,
        short_description: null,
        developer: null,
        publisher: null,
        release_date: null,
        genres: undefined as unknown as string[],
        tags: undefined as unknown as string[],
        metacritic_score: null,
        metacritic_url: null,
        steam_rating: null,
        steam_rating_count: null,
        steam_app_id: null,
        playtime_minutes: undefined as unknown as number,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      } as GameApiResponse;

      const game = transformGame(raw);

      expect(game.screenshots).toEqual([]);
      expect(game.genres).toEqual([]);
      expect(game.tags).toEqual([]);
      expect(game.playtimeMinutes).toBe(0);
    });
  });
});
