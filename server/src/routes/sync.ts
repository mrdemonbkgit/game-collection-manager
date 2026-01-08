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
import {
  importCatalog,
  validateCatalog,
  syncCatalog,
} from '../services/catalogService.js';
import {
  fetchMissingCovers,
  type CoverSyncProgress,
  type CoverSyncResult,
} from '../services/coverService.js';
import {
  migrateToVerticalCovers,
  type MigrationProgress,
  type MigrationResult,
} from '../services/coverMigrationService.js';
import {
  fetchCoversFromSteamGridDB,
  fixHorizontalCovers,
  type SteamGridDBProgress,
  type SteamGridDBResult,
} from '../services/steamGridDBService.js';
import { getGamesWithHorizontalCovers } from '../db/repositories/gameRepository.js';
import { getGamesWithoutCovers } from '../db/repositories/gameRepository.js';

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

// POST /api/sync/catalog - Import subscription catalog (Game Pass, EA Play, Ubisoft+)
router.post('/catalog', (req, res) => {
  try {
    // Validate the catalog format
    const catalog = validateCatalog(req.body);

    console.log(
      `Importing ${catalog.games.length} games from ${catalog.platform}...`
    );

    // Import the catalog
    const result = importCatalog(catalog);

    console.log(
      `Catalog import complete: ${result.added} added, ${result.linked} linked, ${result.errors} errors`
    );

    // Clear genre cache in case new genres were added
    clearGenreCache();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Catalog import error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/sync/catalog/sync - Sync catalog (remove games not in catalog)
router.post('/catalog/sync', (req, res) => {
  try {
    // Validate the catalog format
    const catalog = validateCatalog(req.body);

    console.log(
      `Syncing ${catalog.platform} catalog - removing games not in list of ${catalog.games.length}...`
    );

    // Sync the catalog (removes games not in catalog)
    const result = syncCatalog(catalog);

    console.log(
      `Catalog sync complete: ${result.removed} removed, ${result.orphanedDeleted} orphaned games deleted, ${result.remaining} remaining`
    );

    // Clear genre cache
    clearGenreCache();

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Catalog sync error:', error);
    res.status(400).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Cover sync state (in-memory)
let coverSyncState: {
  inProgress: boolean;
  progress: CoverSyncProgress | null;
  result: CoverSyncResult | null;
  startTime: number | null;
} = {
  inProgress: false,
  progress: null,
  result: null,
  startTime: null,
};

// GET /api/sync/covers/count - Get count of games without covers
router.get('/covers/count', (_req, res) => {
  try {
    const gamesWithoutCovers = getGamesWithoutCovers();
    res.json({
      success: true,
      data: {
        count: gamesWithoutCovers.length,
      },
    });
  } catch (error) {
    console.error('Error getting cover count:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/sync/covers - Fetch missing covers from Steam
router.post('/covers', async (_req, res) => {
  try {
    // Check if already in progress
    if (coverSyncState.inProgress) {
      res.status(409).json({
        success: false,
        error: 'Cover sync already in progress',
        progress: coverSyncState.progress,
      });
      return;
    }

    // Get count of games without covers
    const gamesWithoutCovers = getGamesWithoutCovers();

    if (gamesWithoutCovers.length === 0) {
      res.json({
        success: true,
        message: 'All games already have cover images',
        data: { total: 0, found: 0, notFound: 0 },
      });
      return;
    }

    // Initialize state
    coverSyncState = {
      inProgress: true,
      progress: {
        total: gamesWithoutCovers.length,
        completed: 0,
        found: 0,
        notFound: 0,
        currentGame: '',
      },
      result: null,
      startTime: Date.now(),
    };

    console.log(`Starting cover sync for ${gamesWithoutCovers.length} games...`);

    // Start sync in background
    fetchMissingCovers((progress) => {
      coverSyncState.progress = progress;
      if (progress.completed % 10 === 0 || progress.completed === progress.total) {
        console.log(
          `[Cover Sync] ${progress.completed}/${progress.total} - Found: ${progress.found}, Not found: ${progress.notFound}`
        );
      }
    })
      .then((result) => {
        coverSyncState.inProgress = false;
        coverSyncState.result = result;
        console.log(`Cover sync complete: ${result.found} found, ${result.notFound} not found`);
      })
      .catch((error) => {
        coverSyncState.inProgress = false;
        console.error('Cover sync error:', error);
      });

    // Return immediately with status
    res.json({
      success: true,
      message: 'Cover sync started',
      data: {
        total: gamesWithoutCovers.length,
        estimatedSeconds: Math.ceil(gamesWithoutCovers.length * 0.5), // ~0.5s per game
      },
    });
  } catch (error) {
    console.error('Error starting cover sync:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sync/covers/status - Get cover sync status
router.get('/covers/status', (_req, res) => {
  try {
    const elapsedMs = coverSyncState.startTime
      ? Date.now() - coverSyncState.startTime
      : 0;

    res.json({
      success: true,
      data: {
        inProgress: coverSyncState.inProgress,
        progress: coverSyncState.progress,
        result: coverSyncState.result,
        elapsedSeconds: Math.floor(elapsedMs / 1000),
      },
    });
  } catch (error) {
    console.error('Error getting cover sync status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Cover migration state (horizontal to vertical)
let coverMigrationState: {
  inProgress: boolean;
  progress: MigrationProgress | null;
  result: MigrationResult | null;
  startTime: number | null;
} = {
  inProgress: false,
  progress: null,
  result: null,
  startTime: null,
};

// POST /api/sync/covers/migrate - Migrate horizontal covers to vertical
router.post('/covers/migrate', async (_req, res) => {
  try {
    if (coverMigrationState.inProgress) {
      res.status(409).json({
        success: false,
        error: 'Cover migration already in progress',
        progress: coverMigrationState.progress,
      });
      return;
    }

    coverMigrationState = {
      inProgress: true,
      progress: null,
      result: null,
      startTime: Date.now(),
    };

    console.log('Starting cover migration to vertical format...');

    // Run migration in background
    migrateToVerticalCovers((progress) => {
      coverMigrationState.progress = progress;
      if (progress.completed % 100 === 0 || progress.completed === progress.total) {
        console.log(
          `[Cover Migration] ${progress.completed}/${progress.total} - Updated: ${progress.updated}, Skipped: ${progress.skipped}`
        );
      }
    })
      .then((result) => {
        coverMigrationState.inProgress = false;
        coverMigrationState.result = result;
        console.log(`Cover migration complete: ${result.updated} updated, ${result.skipped} skipped`);
      })
      .catch((error) => {
        coverMigrationState.inProgress = false;
        console.error('Cover migration error:', error);
      });

    res.json({
      success: true,
      message: 'Cover migration started',
    });
  } catch (error) {
    console.error('Error starting cover migration:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sync/covers/migrate/status - Get cover migration status
router.get('/covers/migrate/status', (_req, res) => {
  try {
    const elapsedMs = coverMigrationState.startTime
      ? Date.now() - coverMigrationState.startTime
      : 0;

    res.json({
      success: true,
      data: {
        inProgress: coverMigrationState.inProgress,
        progress: coverMigrationState.progress,
        result: coverMigrationState.result,
        elapsedSeconds: Math.floor(elapsedMs / 1000),
      },
    });
  } catch (error) {
    console.error('Error getting cover migration status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// SteamGridDB cover sync state
let steamGridDBState: {
  inProgress: boolean;
  progress: SteamGridDBProgress | null;
  result: SteamGridDBResult | null;
  startTime: number | null;
} = {
  inProgress: false,
  progress: null,
  result: null,
  startTime: null,
};

// POST /api/sync/covers/steamgriddb - Fetch covers from SteamGridDB
router.post('/covers/steamgriddb', async (_req, res) => {
  try {
    if (steamGridDBState.inProgress) {
      res.status(409).json({
        success: false,
        error: 'SteamGridDB sync already in progress',
        progress: steamGridDBState.progress,
      });
      return;
    }

    // Check if API key is configured
    if (!process.env.STEAMGRIDDB_API_KEY) {
      res.status(400).json({
        success: false,
        error: 'STEAMGRIDDB_API_KEY not configured in environment',
      });
      return;
    }

    const gamesWithoutCovers = getGamesWithoutCovers();

    if (gamesWithoutCovers.length === 0) {
      res.json({
        success: true,
        message: 'All games already have cover images',
        data: { total: 0, found: 0, notFound: 0 },
      });
      return;
    }

    steamGridDBState = {
      inProgress: true,
      progress: {
        total: gamesWithoutCovers.length,
        completed: 0,
        found: 0,
        notFound: 0,
        currentGame: '',
      },
      result: null,
      startTime: Date.now(),
    };

    console.log(`Starting SteamGridDB cover sync for ${gamesWithoutCovers.length} games...`);

    // Run in background
    fetchCoversFromSteamGridDB((progress) => {
      steamGridDBState.progress = progress;
      if (progress.completed % 10 === 0 || progress.completed === progress.total) {
        console.log(
          `[SteamGridDB] ${progress.completed}/${progress.total} - Found: ${progress.found}, Not found: ${progress.notFound}`
        );
      }
    })
      .then((result) => {
        steamGridDBState.inProgress = false;
        steamGridDBState.result = result;
        console.log(`SteamGridDB sync complete: ${result.found} found, ${result.notFound} not found`);
      })
      .catch((error) => {
        steamGridDBState.inProgress = false;
        console.error('SteamGridDB sync error:', error);
      });

    res.json({
      success: true,
      message: 'SteamGridDB cover sync started',
      data: {
        total: gamesWithoutCovers.length,
        estimatedSeconds: Math.ceil(gamesWithoutCovers.length * 0.5), // ~0.5s per game (2 API calls)
      },
    });
  } catch (error) {
    console.error('Error starting SteamGridDB sync:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sync/covers/steamgriddb/status - Get SteamGridDB sync status
router.get('/covers/steamgriddb/status', (_req, res) => {
  try {
    const elapsedMs = steamGridDBState.startTime
      ? Date.now() - steamGridDBState.startTime
      : 0;

    res.json({
      success: true,
      data: {
        inProgress: steamGridDBState.inProgress,
        progress: steamGridDBState.progress,
        result: steamGridDBState.result,
        elapsedSeconds: Math.floor(elapsedMs / 1000),
      },
    });
  } catch (error) {
    console.error('Error getting SteamGridDB sync status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Horizontal cover fix state
let horizontalFixState: {
  inProgress: boolean;
  progress: SteamGridDBProgress | null;
  result: SteamGridDBResult | null;
  startTime: number | null;
} = {
  inProgress: false,
  progress: null,
  result: null,
  startTime: null,
};

// POST /api/sync/covers/fix-horizontal - Fix horizontal covers via SteamGridDB
router.post('/covers/fix-horizontal', async (_req, res) => {
  try {
    if (horizontalFixState.inProgress) {
      res.status(409).json({
        success: false,
        error: 'Horizontal cover fix already in progress',
        progress: horizontalFixState.progress,
      });
      return;
    }

    if (!process.env.STEAMGRIDDB_API_KEY) {
      res.status(400).json({
        success: false,
        error: 'STEAMGRIDDB_API_KEY not configured in environment',
      });
      return;
    }

    const gamesWithHorizontal = getGamesWithHorizontalCovers();

    if (gamesWithHorizontal.length === 0) {
      res.json({
        success: true,
        message: 'No games with horizontal covers found',
        data: { total: 0, found: 0, notFound: 0 },
      });
      return;
    }

    horizontalFixState = {
      inProgress: true,
      progress: {
        total: gamesWithHorizontal.length,
        completed: 0,
        found: 0,
        notFound: 0,
        currentGame: '',
      },
      result: null,
      startTime: Date.now(),
    };

    console.log(`Starting horizontal cover fix for ${gamesWithHorizontal.length} games...`);

    // Run in background
    fixHorizontalCovers((progress) => {
      horizontalFixState.progress = progress;
      if (progress.completed % 5 === 0 || progress.completed === progress.total) {
        console.log(
          `[Fix Horizontal] ${progress.completed}/${progress.total} - Found: ${progress.found}, Not found: ${progress.notFound}`
        );
      }
    })
      .then((result) => {
        horizontalFixState.inProgress = false;
        horizontalFixState.result = result;
        console.log(`Horizontal cover fix complete: ${result.found} fixed, ${result.notFound} not found`);
      })
      .catch((error) => {
        horizontalFixState.inProgress = false;
        console.error('Horizontal cover fix error:', error);
      });

    res.json({
      success: true,
      message: 'Horizontal cover fix started',
      data: {
        total: gamesWithHorizontal.length,
        estimatedSeconds: Math.ceil(gamesWithHorizontal.length * 0.5),
      },
    });
  } catch (error) {
    console.error('Error starting horizontal cover fix:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sync/covers/fix-horizontal/status - Get horizontal fix status
router.get('/covers/fix-horizontal/status', (_req, res) => {
  try {
    const elapsedMs = horizontalFixState.startTime
      ? Date.now() - horizontalFixState.startTime
      : 0;

    res.json({
      success: true,
      data: {
        inProgress: horizontalFixState.inProgress,
        progress: horizontalFixState.progress,
        result: horizontalFixState.result,
        elapsedSeconds: Math.floor(elapsedMs / 1000),
      },
    });
  } catch (error) {
    console.error('Error getting horizontal fix status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
