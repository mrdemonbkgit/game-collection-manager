import { Router } from 'express';
import { syncSteamLibrary, quickSyncSteamLibrary } from '../services/steamService.js';
import {
  clearAllGames,
  getGameCount,
  clearGenreCache,
  getGamesWithoutGenres,
  updateGameMetadata,
  normalizeAllGenres,
} from '../db/repositories/gameRepository.js';
import {
  syncGenresFromSteamSpy,
  type GenreSyncProgress,
  type GenreSyncResult,
} from '../services/steamSpyService.js';

const router = Router();

// Genre sync state (in-memory for simplicity)
let genreSyncState: {
  inProgress: boolean;
  progress: GenreSyncProgress | null;
  result: GenreSyncResult | null;
  startTime: number | null;
} = {
  inProgress: false,
  progress: null,
  result: null,
  startTime: null,
};

// POST /api/sync/steam - Sync Steam library
router.post('/steam', async (req, res) => {
  try {
    const apiKey = process.env.STEAM_API_KEY;
    const steamId = process.env.STEAM_USER_ID;

    if (!apiKey || !steamId) {
      res.status(400).json({
        success: false,
        error: 'Steam API key and user ID must be configured in environment variables',
      });
      return;
    }

    const quick = req.query.quick === 'true';

    console.log(`Starting ${quick ? 'quick ' : ''}Steam sync for user ${steamId}...`);

    const result = quick
      ? await quickSyncSteamLibrary(apiKey, steamId, (progress) => {
          console.log(`[${progress.current}/${progress.total}] ${progress.currentGame}`);
        })
      : await syncSteamLibrary(apiKey, steamId, (progress) => {
          console.log(`[${progress.current}/${progress.total}] ${progress.currentGame}`);
        });

    console.log('Steam sync complete:', result);

    // Clear genre cache to pick up new genres
    clearGenreCache();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Steam sync error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/sync/steam/quick - Quick sync (basic info only, faster)
router.post('/steam/quick', async (_req, res) => {
  try {
    const apiKey = process.env.STEAM_API_KEY;
    const steamId = process.env.STEAM_USER_ID;

    if (!apiKey || !steamId) {
      res.status(400).json({
        success: false,
        error: 'Steam API key and user ID must be configured in environment variables',
      });
      return;
    }

    console.log(`Starting quick Steam sync for user ${steamId}...`);

    const result = await quickSyncSteamLibrary(apiKey, steamId, (progress) => {
      console.log(`[${progress.current}/${progress.total}] ${progress.currentGame}`);
    });

    console.log('Quick Steam sync complete:', result);

    // Clear genre cache to pick up new genres
    clearGenreCache();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Steam sync error:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sync/status - Get sync status
router.get('/status', (_req, res) => {
  try {
    const count = getGameCount();
    res.json({
      success: true,
      data: {
        totalGames: count,
        steamConfigured: !!(process.env.STEAM_API_KEY && process.env.STEAM_USER_ID),
      },
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/sync/reset - Clear all games (for testing)
router.delete('/reset', (_req, res) => {
  try {
    clearAllGames();
    res.json({
      success: true,
      message: 'All games cleared',
    });
  } catch (error) {
    console.error('Error clearing games:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/sync/genres - Sync genres and tags from SteamSpy
router.post('/genres', async (_req, res) => {
  try {
    // Check if already in progress
    if (genreSyncState.inProgress) {
      res.status(409).json({
        success: false,
        error: 'Genre sync already in progress',
        progress: genreSyncState.progress,
      });
      return;
    }

    // Get games without genres
    const gamesWithoutGenres = getGamesWithoutGenres();

    if (gamesWithoutGenres.length === 0) {
      res.json({
        success: true,
        message: 'All games already have genre data',
        data: { total: 0, success: 0, failed: 0, skipped: 0 },
      });
      return;
    }

    // Initialize state
    genreSyncState = {
      inProgress: true,
      progress: {
        total: gamesWithoutGenres.length,
        completed: 0,
        currentGame: '',
        estimatedMinutesRemaining: Math.ceil(gamesWithoutGenres.length / 120), // ~2 req/sec
      },
      result: null,
      startTime: Date.now(),
    };

    console.log(`Starting genre sync for ${gamesWithoutGenres.length} games...`);

    // Start sync in background (don't await)
    syncGenresFromSteamSpy(
      gamesWithoutGenres,
      // Progress callback
      (progress) => {
        genreSyncState.progress = progress;
        if (progress.completed % 100 === 0) {
          console.log(
            `[Genre Sync] ${progress.completed}/${progress.total} - ${progress.currentGame} (${progress.estimatedMinutesRemaining} min remaining)`
          );
        }
      },
      // Update callback
      (steamAppId, genres, tags) => {
        updateGameMetadata(steamAppId, genres, tags);
      }
    )
      .then((result) => {
        genreSyncState.inProgress = false;
        genreSyncState.result = result;
        clearGenreCache();
        console.log('Genre sync complete:', result);
      })
      .catch((error) => {
        genreSyncState.inProgress = false;
        console.error('Genre sync error:', error);
      });

    // Return immediately with status
    res.json({
      success: true,
      message: 'Genre sync started',
      data: {
        total: gamesWithoutGenres.length,
        estimatedMinutes: Math.ceil(gamesWithoutGenres.length / 120),
      },
    });
  } catch (error) {
    console.error('Error starting genre sync:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/sync/genres/normalize - Normalize genre casing
router.post('/genres/normalize', (_req, res) => {
  try {
    const updated = normalizeAllGenres();
    res.json({
      success: true,
      message: `Normalized ${updated} games`,
      data: { updated },
    });
  } catch (error) {
    console.error('Error normalizing genres:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sync/genres/status - Get genre sync status
router.get('/genres/status', (_req, res) => {
  try {
    const elapsedMs = genreSyncState.startTime
      ? Date.now() - genreSyncState.startTime
      : 0;

    res.json({
      success: true,
      data: {
        inProgress: genreSyncState.inProgress,
        progress: genreSyncState.progress,
        result: genreSyncState.result,
        elapsedSeconds: Math.floor(elapsedMs / 1000),
      },
    });
  } catch (error) {
    console.error('Error getting genre sync status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
