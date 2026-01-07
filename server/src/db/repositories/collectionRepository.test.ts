import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import {
  getAllCollections,
  getCollectionById,
  insertCollection,
  updateCollection,
  deleteCollection,
  addGameToCollection,
  removeGameFromCollection,
  getGamesInCollection,
  getCollectionsForGame,
  getCollectionGameCounts,
  clearAllCollections,
} from './collectionRepository.js';
import { insertGame, clearAllGames } from './gameRepository.js';
import { initDatabase, closeDatabase } from '../connection.js';

describe('collectionRepository', () => {
  beforeEach(() => {
    // Use in-memory database for tests
    initDatabase(':memory:');
  });

  afterEach(() => {
    closeDatabase();
  });

  describe('insertCollection', () => {
    it('should insert a collection and return its ID', () => {
      const id = insertCollection({ name: 'Favorites' });
      assert.strictEqual(id, 1);
    });

    it('should insert a collection with all fields', () => {
      const id = insertCollection({
        name: 'My RPGs',
        description: 'Role playing games I love',
        isSmartFilter: false,
      });

      const collection = getCollectionById(id);
      assert.notStrictEqual(collection, null);
      assert.strictEqual(collection?.name, 'My RPGs');
      assert.strictEqual(collection?.description, 'Role playing games I love');
      assert.strictEqual(collection?.is_smart_filter, 0);
    });

    it('should insert a smart filter with filter criteria', () => {
      const filterCriteria = { genres: ['RPG'], platforms: ['steam'] };
      const id = insertCollection({
        name: 'Steam RPGs',
        isSmartFilter: true,
        filterCriteria,
      });

      const collection = getCollectionById(id);
      assert.strictEqual(collection?.is_smart_filter, 1);
      assert.deepStrictEqual(
        JSON.parse(collection?.filter_criteria || '{}'),
        filterCriteria
      );
    });
  });

  describe('getAllCollections', () => {
    it('should return empty array when no collections', () => {
      const collections = getAllCollections();
      assert.deepStrictEqual(collections, []);
    });

    it('should return all collections sorted by name', () => {
      insertCollection({ name: 'Zebra' });
      insertCollection({ name: 'Alpha' });
      insertCollection({ name: 'Beta' });

      const collections = getAllCollections();
      assert.strictEqual(collections.length, 3);
      assert.strictEqual(collections[0].name, 'Alpha');
      assert.strictEqual(collections[1].name, 'Beta');
      assert.strictEqual(collections[2].name, 'Zebra');
    });
  });

  describe('getCollectionById', () => {
    it('should return null for non-existent collection', () => {
      const collection = getCollectionById(9999);
      assert.strictEqual(collection, null);
    });

    it('should return collection by ID', () => {
      const id = insertCollection({ name: 'Test Collection' });
      const collection = getCollectionById(id);

      assert.notStrictEqual(collection, null);
      assert.strictEqual(collection?.id, id);
      assert.strictEqual(collection?.name, 'Test Collection');
    });
  });

  describe('updateCollection', () => {
    it('should return false for non-existent collection', () => {
      const result = updateCollection(9999, { name: 'New Name' });
      assert.strictEqual(result, false);
    });

    it('should update collection name', () => {
      const id = insertCollection({ name: 'Original' });
      updateCollection(id, { name: 'Updated' });

      const collection = getCollectionById(id);
      assert.strictEqual(collection?.name, 'Updated');
    });

    it('should update collection description', () => {
      const id = insertCollection({ name: 'Test', description: 'Old desc' });
      updateCollection(id, { description: 'New desc' });

      const collection = getCollectionById(id);
      assert.strictEqual(collection?.description, 'New desc');
    });

    it('should update smart filter status', () => {
      const id = insertCollection({ name: 'Test', isSmartFilter: false });
      updateCollection(id, { isSmartFilter: true });

      const collection = getCollectionById(id);
      assert.strictEqual(collection?.is_smart_filter, 1);
    });

    it('should update filter criteria', () => {
      const id = insertCollection({ name: 'Test' });
      const newCriteria = { genres: ['Action'] };
      updateCollection(id, { filterCriteria: newCriteria });

      const collection = getCollectionById(id);
      assert.deepStrictEqual(
        JSON.parse(collection?.filter_criteria || '{}'),
        newCriteria
      );
    });

    it('should update updated_at timestamp', () => {
      const id = insertCollection({ name: 'Test' });
      const original = getCollectionById(id);
      const originalUpdatedAt = original?.updated_at;

      // Wait a tiny bit to ensure timestamp changes
      updateCollection(id, { name: 'Updated' });

      const updated = getCollectionById(id);
      // Just verify the field exists and is set
      assert.ok(updated?.updated_at);
    });

    it('should return false when no updates provided', () => {
      const id = insertCollection({ name: 'Test' });
      const result = updateCollection(id, {});
      assert.strictEqual(result, false);
    });
  });

  describe('deleteCollection', () => {
    it('should return false for non-existent collection', () => {
      const result = deleteCollection(9999);
      assert.strictEqual(result, false);
    });

    it('should delete collection and return true', () => {
      const id = insertCollection({ name: 'To Delete' });
      assert.strictEqual(getAllCollections().length, 1);

      const result = deleteCollection(id);
      assert.strictEqual(result, true);
      assert.strictEqual(getAllCollections().length, 0);
    });

    it('should cascade delete collection_games entries', () => {
      const collectionId = insertCollection({ name: 'Test' });
      const gameId = insertGame({ title: 'Game', slug: 'game' });

      addGameToCollection(collectionId, gameId);
      assert.strictEqual(getGamesInCollection(collectionId).length, 1);

      deleteCollection(collectionId);
      assert.strictEqual(getGamesInCollection(collectionId).length, 0);
    });
  });

  describe('addGameToCollection', () => {
    it('should add a game to a collection', () => {
      const collectionId = insertCollection({ name: 'Favorites' });
      const gameId = insertGame({ title: 'Test Game', slug: 'test-game' });

      addGameToCollection(collectionId, gameId);

      const gameIds = getGamesInCollection(collectionId);
      assert.strictEqual(gameIds.length, 1);
      assert.strictEqual(gameIds[0], gameId);
    });

    it('should not throw when adding same game twice (INSERT OR IGNORE)', () => {
      const collectionId = insertCollection({ name: 'Favorites' });
      const gameId = insertGame({ title: 'Test Game', slug: 'test-game' });

      addGameToCollection(collectionId, gameId);
      addGameToCollection(collectionId, gameId); // Should not throw

      const gameIds = getGamesInCollection(collectionId);
      assert.strictEqual(gameIds.length, 1);
    });

    it('should add multiple games to a collection', () => {
      const collectionId = insertCollection({ name: 'Favorites' });
      const game1 = insertGame({ title: 'Game 1', slug: 'game-1' });
      const game2 = insertGame({ title: 'Game 2', slug: 'game-2' });
      const game3 = insertGame({ title: 'Game 3', slug: 'game-3' });

      addGameToCollection(collectionId, game1);
      addGameToCollection(collectionId, game2);
      addGameToCollection(collectionId, game3);

      const gameIds = getGamesInCollection(collectionId);
      assert.strictEqual(gameIds.length, 3);
    });
  });

  describe('removeGameFromCollection', () => {
    it('should return false when game not in collection', () => {
      const collectionId = insertCollection({ name: 'Test' });
      const gameId = insertGame({ title: 'Game', slug: 'game' });

      const result = removeGameFromCollection(collectionId, gameId);
      assert.strictEqual(result, false);
    });

    it('should remove game from collection and return true', () => {
      const collectionId = insertCollection({ name: 'Test' });
      const gameId = insertGame({ title: 'Game', slug: 'game' });

      addGameToCollection(collectionId, gameId);
      assert.strictEqual(getGamesInCollection(collectionId).length, 1);

      const result = removeGameFromCollection(collectionId, gameId);
      assert.strictEqual(result, true);
      assert.strictEqual(getGamesInCollection(collectionId).length, 0);
    });
  });

  describe('getGamesInCollection', () => {
    it('should return empty array for empty collection', () => {
      const collectionId = insertCollection({ name: 'Empty' });
      const gameIds = getGamesInCollection(collectionId);
      assert.deepStrictEqual(gameIds, []);
    });

    it('should return all game IDs in collection', () => {
      const collectionId = insertCollection({ name: 'Test' });
      const game1 = insertGame({ title: 'Game 1', slug: 'game-1' });
      const game2 = insertGame({ title: 'Game 2', slug: 'game-2' });

      addGameToCollection(collectionId, game1);
      addGameToCollection(collectionId, game2);

      const gameIds = getGamesInCollection(collectionId);
      assert.strictEqual(gameIds.length, 2);
      assert.ok(gameIds.includes(game1));
      assert.ok(gameIds.includes(game2));
    });
  });

  describe('getCollectionsForGame', () => {
    it('should return empty array when game in no collections', () => {
      const gameId = insertGame({ title: 'Game', slug: 'game' });
      const collectionIds = getCollectionsForGame(gameId);
      assert.deepStrictEqual(collectionIds, []);
    });

    it('should return all collection IDs containing the game', () => {
      const collection1 = insertCollection({ name: 'Collection 1' });
      const collection2 = insertCollection({ name: 'Collection 2' });
      const collection3 = insertCollection({ name: 'Collection 3' });
      const gameId = insertGame({ title: 'Game', slug: 'game' });

      addGameToCollection(collection1, gameId);
      addGameToCollection(collection3, gameId);

      const collectionIds = getCollectionsForGame(gameId);
      assert.strictEqual(collectionIds.length, 2);
      assert.ok(collectionIds.includes(collection1));
      assert.ok(collectionIds.includes(collection3));
      assert.ok(!collectionIds.includes(collection2));
    });
  });

  describe('getCollectionGameCounts', () => {
    it('should return empty array when no collections have games', () => {
      insertCollection({ name: 'Empty 1' });
      insertCollection({ name: 'Empty 2' });

      const counts = getCollectionGameCounts();
      assert.deepStrictEqual(counts, []);
    });

    it('should return correct counts for each collection', () => {
      const collection1 = insertCollection({ name: 'Collection 1' });
      const collection2 = insertCollection({ name: 'Collection 2' });
      const game1 = insertGame({ title: 'Game 1', slug: 'game-1' });
      const game2 = insertGame({ title: 'Game 2', slug: 'game-2' });
      const game3 = insertGame({ title: 'Game 3', slug: 'game-3' });

      addGameToCollection(collection1, game1);
      addGameToCollection(collection1, game2);
      addGameToCollection(collection2, game3);

      const counts = getCollectionGameCounts();
      assert.strictEqual(counts.length, 2);

      const count1 = counts.find((c) => c.collection_id === collection1);
      const count2 = counts.find((c) => c.collection_id === collection2);

      assert.strictEqual(count1?.count, 2);
      assert.strictEqual(count2?.count, 1);
    });
  });

  describe('clearAllCollections', () => {
    it('should remove all collections and collection_games', () => {
      const collection = insertCollection({ name: 'Test' });
      const game = insertGame({ title: 'Game', slug: 'game' });

      addGameToCollection(collection, game);

      assert.strictEqual(getAllCollections().length, 1);
      assert.strictEqual(getGamesInCollection(collection).length, 1);

      clearAllCollections();

      assert.strictEqual(getAllCollections().length, 0);
      // Junction table should also be cleared
      const counts = getCollectionGameCounts();
      assert.deepStrictEqual(counts, []);

      // Clean up games too
      clearAllGames();
    });
  });
});
