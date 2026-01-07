import { describe, it, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { initDatabase, closeDatabase } from '../db/connection.js';

describe('steamService', () => {
  let originalFetch: typeof globalThis.fetch;

  beforeEach(() => {
    // Use in-memory database for tests
    initDatabase(':memory:');
    // Save original fetch
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    closeDatabase();
    // Restore original fetch
    globalThis.fetch = originalFetch;
  });

  describe('fetchSteamOwnedGames', () => {
    it('should fetch and return owned games', async () => {
      const mockResponse = {
        response: {
          game_count: 2,
          games: [
            { appid: 123, name: 'Game 1', playtime_forever: 100, img_icon_url: 'icon1' },
            { appid: 456, name: 'Game 2', playtime_forever: 200, img_icon_url: 'icon2' },
          ],
        },
      };

      globalThis.fetch = mock.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockResponse),
        })
      ) as unknown as typeof fetch;

      const { fetchSteamOwnedGames } = await import('./steamService.js');
      const games = await fetchSteamOwnedGames('test-api-key', 'test-steam-id');

      assert.strictEqual(games.length, 2);
      assert.strictEqual(games[0].appid, 123);
      assert.strictEqual(games[0].name, 'Game 1');
      assert.strictEqual(games[1].playtime_forever, 200);
    });

    it('should throw error on API failure', async () => {
      globalThis.fetch = mock.fn(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        })
      ) as unknown as typeof fetch;

      const { fetchSteamOwnedGames } = await import('./steamService.js');

      await assert.rejects(
        () => fetchSteamOwnedGames('invalid-key', 'test-id'),
        /Steam API error: 401 Unauthorized/
      );
    });

    it('should throw error on invalid response', async () => {
      globalThis.fetch = mock.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ response: {} }),
        })
      ) as unknown as typeof fetch;

      const { fetchSteamOwnedGames } = await import('./steamService.js');

      await assert.rejects(
        () => fetchSteamOwnedGames('api-key', 'steam-id'),
        /Invalid response from Steam API/
      );
    });
  });

  describe('fetchSteamAppDetails', () => {
    it('should fetch app details successfully', async () => {
      const mockDetails = {
        '12345': {
          success: true,
          data: {
            name: 'Test Game',
            steam_appid: 12345,
            short_description: 'A test game',
            developers: ['Test Dev'],
            publishers: ['Test Pub'],
            genres: [{ id: '1', description: 'Action' }],
          },
        },
      };

      globalThis.fetch = mock.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockDetails),
        })
      ) as unknown as typeof fetch;

      const { fetchSteamAppDetails } = await import('./steamService.js');
      const details = await fetchSteamAppDetails(12345);

      assert.notStrictEqual(details, null);
      assert.strictEqual(details?.name, 'Test Game');
      assert.strictEqual(details?.developers?.[0], 'Test Dev');
    });

    it('should return null on fetch error', async () => {
      globalThis.fetch = mock.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        })
      ) as unknown as typeof fetch;

      const { fetchSteamAppDetails } = await import('./steamService.js');
      const details = await fetchSteamAppDetails(99999);

      assert.strictEqual(details, null);
    });

    it('should return null when success is false', async () => {
      globalThis.fetch = mock.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ '12345': { success: false } }),
        })
      ) as unknown as typeof fetch;

      const { fetchSteamAppDetails } = await import('./steamService.js');
      const details = await fetchSteamAppDetails(12345);

      assert.strictEqual(details, null);
    });
  });

  describe('syncSteamLibrary', () => {
    it('should sync games with progress callback', async () => {
      const mockOwnedGames = {
        response: {
          game_count: 2,
          games: [
            { appid: 111, name: 'Sync Game 1', playtime_forever: 50, img_icon_url: '' },
            { appid: 222, name: 'Sync Game 2', playtime_forever: 100, img_icon_url: '' },
          ],
        },
      };

      let fetchCallCount = 0;
      globalThis.fetch = mock.fn(() => {
        fetchCallCount++;
        if (fetchCallCount === 1) {
          return Promise.resolve({
            ok: true,
            json: () => Promise.resolve(mockOwnedGames),
          });
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ [fetchCallCount === 2 ? '111' : '222']: { success: false } }),
        });
      }) as unknown as typeof fetch;

      const { quickSyncSteamLibrary } = await import('./steamService.js');

      const progressUpdates: { current: number; currentGame: string }[] = [];
      const result = await quickSyncSteamLibrary('api-key', 'steam-id', (progress) => {
        progressUpdates.push({ current: progress.current, currentGame: progress.currentGame });
      });

      assert.strictEqual(result.totalGames, 2);
      assert.strictEqual(result.imported, 2);
      assert.strictEqual(result.failed, 0);
      assert.strictEqual(progressUpdates.length, 2);
      assert.strictEqual(progressUpdates[0].currentGame, 'Sync Game 1');
    });
  });
});
