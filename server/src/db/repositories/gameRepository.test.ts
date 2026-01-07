import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  insertGame,
  upsertGameBySteamAppId,
  addGamePlatform,
  getGameById,
  getGameBySteamAppId,
  getAllGames,
  getGameCount,
  deleteGame,
  clearAllGames,
  createSlug,
  type CreateGameInput,
} from './gameRepository.js';
import { initDatabase, closeDatabase } from '../connection.js';

describe('gameRepository', () => {
  beforeEach(() => {
    // Use in-memory database for tests
    initDatabase(':memory:');
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('createSlug', () => {
    it('should create a valid slug from title', () => {
      assert.strictEqual(createSlug('The Witcher 3: Wild Hunt'), 'the-witcher-3-wild-hunt');
      assert.strictEqual(createSlug('DOOM Eternal'), 'doom-eternal');
      assert.strictEqual(createSlug("Baldur's Gate 3"), 'baldur-s-gate-3');
    });

    it('should handle special characters', () => {
      assert.strictEqual(createSlug('Game!!!With@@@Symbols'), 'game-with-symbols');
    });

    it('should trim leading and trailing hyphens', () => {
      assert.strictEqual(createSlug('---Game---'), 'game');
    });

    it('should handle suffix', () => {
      assert.strictEqual(createSlug('Test Game', 12345), 'test-game-12345');
      assert.strictEqual(createSlug('Test Game', 'suffix'), 'test-game-suffix');
    });
  });

  describe('insertGame', () => {
    it('should insert a game and return its ID', () => {
      const input: CreateGameInput = {
        title: 'Test Game',
        slug: 'test-game',
        steamAppId: 12345,
      };

      const id = insertGame(input);
      assert.strictEqual(id, 1);
    });

    it('should insert a game with all fields', () => {
      const input: CreateGameInput = {
        title: 'Full Game',
        slug: 'full-game',
        coverImageUrl: 'https://example.com/cover.jpg',
        screenshots: ['https://example.com/ss1.jpg', 'https://example.com/ss2.jpg'],
        description: 'A great game',
        shortDescription: 'Great game',
        developer: 'Dev Studio',
        publisher: 'Publisher Inc',
        releaseDate: '2024-01-15',
        genres: ['Action', 'RPG'],
        tags: ['Singleplayer', 'Open World'],
        metacriticScore: 85,
        metacriticUrl: 'https://metacritic.com/game/full-game',
        steamRating: 92.5,
        steamRatingCount: 10000,
        steamAppId: 99999,
        playtimeMinutes: 120,
      };

      const id = insertGame(input);
      const game = getGameById(id);

      assert.notStrictEqual(game, null);
      assert.strictEqual(game?.title, 'Full Game');
      assert.strictEqual(game?.metacritic_score, 85);
      assert.deepStrictEqual(JSON.parse(game?.genres || '[]'), ['Action', 'RPG']);
    });

    it('should handle null optional fields', () => {
      const input: CreateGameInput = {
        title: 'Minimal Game',
        slug: 'minimal-game',
      };

      const id = insertGame(input);
      const game = getGameById(id);

      assert.strictEqual(game?.cover_image_url, null);
      assert.strictEqual(game?.description, null);
      assert.strictEqual(game?.metacritic_score, null);
    });
  });

  describe('upsertGameBySteamAppId', () => {
    it('should insert a new game', () => {
      const input: CreateGameInput = {
        title: 'New Steam Game',
        slug: 'new-steam-game',
        steamAppId: 11111,
      };

      const id = upsertGameBySteamAppId(input);
      assert.strictEqual(id, 1);

      const game = getGameById(id);
      assert.strictEqual(game?.title, 'New Steam Game');
    });

    it('should update existing game with same steamAppId', () => {
      const input1: CreateGameInput = {
        title: 'Original Title',
        slug: 'original-title',
        steamAppId: 22222,
        metacriticScore: 70,
      };

      const id1 = upsertGameBySteamAppId(input1);

      const input2: CreateGameInput = {
        title: 'Updated Title',
        slug: 'updated-title',
        steamAppId: 22222,
        metacriticScore: 85,
      };

      const id2 = upsertGameBySteamAppId(input2);

      // Should return the same ID
      assert.strictEqual(id1, id2);

      // Should have updated data
      const game = getGameById(id1);
      assert.strictEqual(game?.title, 'Updated Title');
      assert.strictEqual(game?.metacritic_score, 85);
    });

    it('should preserve slug on update', () => {
      const input1: CreateGameInput = {
        title: 'Original',
        slug: 'original-slug',
        steamAppId: 33333,
      };

      upsertGameBySteamAppId(input1);

      const input2: CreateGameInput = {
        title: 'Updated',
        slug: 'new-slug',
        steamAppId: 33333,
      };

      const id = upsertGameBySteamAppId(input2);
      const game = getGameById(id);

      // Slug should remain original since we only update, not insert
      assert.strictEqual(game?.slug, 'original-slug');
    });
  });

  describe('addGamePlatform', () => {
    it('should add a platform to a game', () => {
      const gameId = insertGame({
        title: 'Multi Platform Game',
        slug: 'multi-platform-game',
        steamAppId: 33333,
      });

      addGamePlatform(gameId, 'steam', '33333', true);

      const game = getGameById(gameId);
      assert.strictEqual(game?.platforms.length, 1);
      assert.strictEqual(game?.platforms[0].platform_type, 'steam');
      assert.strictEqual(game?.platforms[0].is_primary, 1);
    });

    it('should allow multiple platforms for same game', () => {
      const gameId = insertGame({
        title: 'Cross Platform Game',
        slug: 'cross-platform-game',
        steamAppId: 44444,
      });

      addGamePlatform(gameId, 'steam', '44444', true);
      addGamePlatform(gameId, 'gamepass', 'some-game-id', false);

      const game = getGameById(gameId);
      assert.strictEqual(game?.platforms.length, 2);
    });

    it('should replace existing platform entry', () => {
      const gameId = insertGame({
        title: 'Platform Update Game',
        slug: 'platform-update-game',
        steamAppId: 55555,
      });

      addGamePlatform(gameId, 'steam', '55555', false);
      addGamePlatform(gameId, 'steam', '55555', true);

      const game = getGameById(gameId);
      assert.strictEqual(game?.platforms.length, 1);
      assert.strictEqual(game?.platforms[0].is_primary, 1);
    });
  });

  describe('getGameById', () => {
    it('should return null for non-existent game', () => {
      const game = getGameById(9999);
      assert.strictEqual(game, null);
    });

    it('should return game with platforms', () => {
      const gameId = insertGame({
        title: 'Get By Id Test',
        slug: 'get-by-id-test',
        steamAppId: 55555,
      });

      addGamePlatform(gameId, 'steam', '55555', true);

      const game = getGameById(gameId);
      assert.notStrictEqual(game, null);
      assert.strictEqual(game?.id, gameId);
      assert.strictEqual(game?.platforms.length, 1);
    });
  });

  describe('getGameBySteamAppId', () => {
    it('should return null for non-existent steamAppId', () => {
      const game = getGameBySteamAppId(9999999);
      assert.strictEqual(game, null);
    });

    it('should return game by steamAppId', () => {
      insertGame({
        title: 'Steam ID Test',
        slug: 'steam-id-test',
        steamAppId: 66666,
      });

      const game = getGameBySteamAppId(66666);
      assert.notStrictEqual(game, null);
      assert.strictEqual(game?.steam_app_id, 66666);
    });
  });

  describe('getAllGames', () => {
    beforeEach(() => {
      // Insert test games
      insertGame({ title: 'Alpha Game', slug: 'alpha-game', genres: ['Action'] });
      insertGame({ title: 'Beta Game', slug: 'beta-game', genres: ['RPG'] });
      insertGame({ title: 'Gamma Game', slug: 'gamma-game', genres: ['Action', 'RPG'] });
    });

    it('should return all games', () => {
      const { games, total } = getAllGames();
      assert.strictEqual(games.length, 3);
      assert.strictEqual(total, 3);
    });

    it('should filter by search term', () => {
      const { games, total } = getAllGames({ search: 'Beta' });
      assert.strictEqual(games.length, 1);
      assert.strictEqual(games[0].title, 'Beta Game');
      assert.strictEqual(total, 1);
    });

    it('should filter by genre', () => {
      const { games } = getAllGames({ genre: 'RPG' });
      assert.strictEqual(games.length, 2); // Beta and Gamma
    });

    it('should sort by title ascending', () => {
      const { games } = getAllGames({ sortBy: 'title', sortOrder: 'asc' });
      assert.strictEqual(games[0].title, 'Alpha Game');
      assert.strictEqual(games[2].title, 'Gamma Game');
    });

    it('should sort by title descending', () => {
      const { games } = getAllGames({ sortBy: 'title', sortOrder: 'desc' });
      assert.strictEqual(games[0].title, 'Gamma Game');
      assert.strictEqual(games[2].title, 'Alpha Game');
    });

    it('should paginate results', () => {
      const { games, total } = getAllGames({ limit: 2, offset: 0 });
      assert.strictEqual(games.length, 2);
      assert.strictEqual(total, 3);

      const { games: page2 } = getAllGames({ limit: 2, offset: 2 });
      assert.strictEqual(page2.length, 1);
    });

    it('should use default values when options not provided', () => {
      const { games } = getAllGames({});
      assert.strictEqual(games.length, 3);
    });
  });

  describe('getGameCount', () => {
    it('should return 0 for empty database', () => {
      assert.strictEqual(getGameCount(), 0);
    });

    it('should return correct count', () => {
      insertGame({ title: 'Game 1', slug: 'game-1' });
      insertGame({ title: 'Game 2', slug: 'game-2' });
      insertGame({ title: 'Game 3', slug: 'game-3' });

      assert.strictEqual(getGameCount(), 3);
    });
  });

  describe('deleteGame', () => {
    it('should return false for non-existent game', () => {
      const result = deleteGame(9999);
      assert.strictEqual(result, false);
    });

    it('should delete game and return true', () => {
      const id = insertGame({ title: 'To Delete', slug: 'to-delete' });
      assert.strictEqual(getGameCount(), 1);

      const result = deleteGame(id);
      assert.strictEqual(result, true);
      assert.strictEqual(getGameCount(), 0);
    });
  });

  describe('clearAllGames', () => {
    it('should remove all games', () => {
      insertGame({ title: 'Game 1', slug: 'game-1' });
      insertGame({ title: 'Game 2', slug: 'game-2' });

      assert.strictEqual(getGameCount(), 2);

      clearAllGames();

      assert.strictEqual(getGameCount(), 0);
    });

    it('should also clear game platforms', () => {
      const id = insertGame({ title: 'Game', slug: 'game', steamAppId: 12345 });
      addGamePlatform(id, 'steam', '12345', true);

      clearAllGames();

      const game = getGameById(id);
      assert.strictEqual(game, null);
    });
  });
});
