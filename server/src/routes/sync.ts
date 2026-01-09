import { Router } from 'express';
import { syncSteamLibrary, quickSyncSteamLibrary, fetchSteamReviews } from '../services/steamService.js';
import {
  clearAllGames,
  getGameCount,
  clearGenreCache,
  getGamesWithoutGenres,
  updateGameMetadata,
  normalizeAllGenres,
  updateGameSteamRating,
  getGamesWithoutRatings,
  getAllSteamGames,
  updateIGDBMetadata,
  getGamesWithoutIGDBMetadata,
  getIGDBSyncStats,
  getGamesWithScreenshots,
  getScreenshotSyncStats,
  getGamesWithoutCovers as getGamesWithoutCoversRepo,
  getGamesWithoutSteamMetadata,
} from '../db/repositories/gameRepository.js';
import {
  getGameBySteamId,
  searchGameByTitle,
  convertIGDBGameToMetadata,
  type IGDBSyncProgress,
  type IGDBSyncResult,
} from '../services/igdbService.js';
import {
  enrichGameWithSteamGridDB,
  getGamesWithoutSteamGridDBEnrichment,
  getSteamGridDBSyncStats,
  type SteamGridDBEnrichProgress,
  type SteamGridDBEnrichResult,
} from '../services/steamGridDBService.js';
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
  fixSingleCover,
  fixMultipleCovers,
  getCoverFixHistory,
  clearTriedCovers,
  predownloadAllAssets,
  type SteamGridDBProgress,
  type SteamGridDBResult,
  type PredownloadProgress,
  type PredownloadResult,
} from '../services/steamGridDBService.js';
import { getGamesWithHorizontalCovers } from '../db/repositories/gameRepository.js';
import { getGamesWithoutCovers } from '../db/repositories/gameRepository.js';
import {
  downloadCovers,
  getCacheStats,
  clearCache,
} from '../services/localCoverService.js';
import {
  downloadGameScreenshots,
  hasLocalScreenshots,
  getAssetCacheStats,
} from '../services/localAssetsService.js';
import { getAllGames } from '../db/repositories/gameRepository.js';

const router = Router();

// Steam sync state (in-memory)
interface SteamSyncProgress {
  total: number;
  current: number;
  currentGame: string;
}

interface SteamSyncResult {
  totalGames: number;
  imported: number;
  updated: number;
  failed: number;
}

let steamSyncState: {
  inProgress: boolean;
  isQuick: boolean;
  progress: SteamSyncProgress | null;
  result: SteamSyncResult | null;
  startTime: number | null;
  error: string | null;
} = {
  inProgress: false,
  isQuick: false,
  progress: null,
  result: null,
  startTime: null,
  error: null,
};

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

// POST /api/sync/steam - Full Steam library sync (background job)
router.post('/steam', async (_req, res) => {
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

    // Check if already in progress
    if (steamSyncState.inProgress) {
      res.status(409).json({
        success: false,
        error: 'Steam sync already in progress',
        progress: steamSyncState.progress,
      });
      return;
    }

    // Initialize state
    steamSyncState = {
      inProgress: true,
      isQuick: false,
      progress: { total: 0, current: 0, currentGame: 'Starting...' },
      result: null,
      startTime: Date.now(),
      error: null,
    };

    console.log(`Starting full Steam sync for user ${steamId}...`);

    // Return immediately, run sync in background
    res.json({
      success: true,
      message: 'Steam full sync started in background',
    });

    // Run sync in background (don't await in the request handler)
    syncSteamLibrary(apiKey, steamId, (progress) => {
      steamSyncState.progress = {
        total: progress.total,
        current: progress.current,
        currentGame: progress.currentGame,
      };
      if (progress.current % 100 === 0) {
        console.log(`[Steam Sync] ${progress.current}/${progress.total} - ${progress.currentGame}`);
      }
    })
      .then((result) => {
        console.log('Steam sync complete:', result);
        steamSyncState.inProgress = false;
        steamSyncState.result = result;
        clearGenreCache();
      })
      .catch((error) => {
        console.error('Steam sync error:', error);
        steamSyncState.inProgress = false;
        steamSyncState.error = error instanceof Error ? error.message : 'Unknown error';
      });
  } catch (error) {
    console.error('Steam sync error:', error);
    steamSyncState.inProgress = false;
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sync/steam/status - Get Steam sync status
router.get('/steam/status', (_req, res) => {
  try {
    const elapsedMs = steamSyncState.startTime
      ? Date.now() - steamSyncState.startTime
      : 0;

    res.json({
      success: true,
      data: {
        inProgress: steamSyncState.inProgress,
        isQuick: steamSyncState.isQuick,
        progress: steamSyncState.progress,
        result: steamSyncState.result,
        error: steamSyncState.error,
        elapsedSeconds: Math.floor(elapsedMs / 1000),
      },
    });
  } catch (error) {
    console.error('Error getting steam sync status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/sync/steam/quick - Quick sync (basic info only, faster, background)
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

    // Check if already in progress
    if (steamSyncState.inProgress) {
      res.status(409).json({
        success: false,
        error: 'Steam sync already in progress',
        progress: steamSyncState.progress,
      });
      return;
    }

    // Initialize state
    steamSyncState = {
      inProgress: true,
      isQuick: true,
      progress: { total: 0, current: 0, currentGame: 'Starting...' },
      result: null,
      startTime: Date.now(),
      error: null,
    };

    console.log(`Starting quick Steam sync for user ${steamId}...`);

    // Return immediately
    res.json({
      success: true,
      message: 'Steam quick sync started in background',
    });

    // Run in background
    quickSyncSteamLibrary(apiKey, steamId, (progress) => {
      steamSyncState.progress = {
        total: progress.total,
        current: progress.current,
        currentGame: progress.currentGame,
      };
    })
      .then((result) => {
        console.log('Quick Steam sync complete:', result);
        steamSyncState.inProgress = false;
        steamSyncState.result = result;
        clearGenreCache();
      })
      .catch((error) => {
        console.error('Quick Steam sync error:', error);
        steamSyncState.inProgress = false;
        steamSyncState.error = error instanceof Error ? error.message : 'Unknown error';
      });
  } catch (error) {
    console.error('Steam sync error:', error);
    steamSyncState.inProgress = false;
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

// ============================================================================
// Steam Ratings Sync Endpoints
// ============================================================================

interface RatingsSyncProgress {
  total: number;
  completed: number;
  updated: number;
  failed: number;
  currentGame: string;
}

interface RatingsSyncResult {
  total: number;
  updated: number;
  failed: number;
  skipped: number;
}

// Ratings sync state (in-memory)
let ratingsSyncState: {
  inProgress: boolean;
  progress: RatingsSyncProgress | null;
  result: RatingsSyncResult | null;
  startTime: number | null;
} = {
  inProgress: false,
  progress: null,
  result: null,
  startTime: null,
};

// Rate limit delay for Steam Reviews API (same as Store API)
const RATINGS_RATE_LIMIT = 1500; // 1.5 seconds

function delayMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// POST /api/sync/ratings - Sync Steam ratings for all games
router.post('/ratings', async (req, res) => {
  try {
    if (ratingsSyncState.inProgress) {
      res.status(409).json({
        success: false,
        error: 'Ratings sync already in progress',
        progress: ratingsSyncState.progress,
      });
      return;
    }

    // Check if we should only sync missing ratings or all
    const fullSync = req.query.full === 'true';
    const games = fullSync ? getAllSteamGames() : getGamesWithoutRatings();

    if (games.length === 0) {
      res.json({
        success: true,
        message: fullSync ? 'No Steam games found' : 'All games already have ratings',
        data: { total: 0, updated: 0, failed: 0, skipped: 0 },
      });
      return;
    }

    ratingsSyncState = {
      inProgress: true,
      progress: {
        total: games.length,
        completed: 0,
        updated: 0,
        failed: 0,
        currentGame: '',
      },
      result: null,
      startTime: Date.now(),
    };

    console.log(`Starting ratings sync for ${games.length} games (full=${fullSync})...`);

    // Run in background
    (async () => {
      let updated = 0;
      let failed = 0;
      let skipped = 0;

      for (let i = 0; i < games.length; i++) {
        const game = games[i];

        ratingsSyncState.progress = {
          total: games.length,
          completed: i,
          updated,
          failed,
          currentGame: game.title,
        };

        try {
          // Rate limit
          if (i > 0) {
            await delayMs(RATINGS_RATE_LIMIT);
          }

          const reviews = await fetchSteamReviews(game.steamAppId);

          if (reviews && reviews.totalReviews > 0) {
            updateGameSteamRating(game.steamAppId, reviews.rating, reviews.totalReviews);
            updated++;
          } else {
            skipped++;
          }
        } catch (error) {
          console.warn(`Failed to fetch ratings for ${game.title}:`, error);
          failed++;
        }

        // Log progress every 50 games
        if ((i + 1) % 50 === 0 || i === games.length - 1) {
          console.log(
            `[Ratings Sync] ${i + 1}/${games.length} - Updated: ${updated}, Failed: ${failed}, Skipped: ${skipped}`
          );
        }
      }

      ratingsSyncState.inProgress = false;
      ratingsSyncState.result = {
        total: games.length,
        updated,
        failed,
        skipped,
      };
      ratingsSyncState.progress = {
        total: games.length,
        completed: games.length,
        updated,
        failed,
        currentGame: '',
      };

      console.log(`Ratings sync complete: ${updated} updated, ${failed} failed, ${skipped} skipped`);
    })().catch((error) => {
      ratingsSyncState.inProgress = false;
      console.error('Ratings sync error:', error);
    });

    // Calculate estimated time
    const estimatedMinutes = Math.ceil((games.length * RATINGS_RATE_LIMIT) / 1000 / 60);

    res.json({
      success: true,
      message: 'Ratings sync started',
      data: {
        total: games.length,
        estimatedMinutes,
        fullSync,
      },
    });
  } catch (error) {
    console.error('Error starting ratings sync:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sync/ratings/status - Get ratings sync status
router.get('/ratings/status', (_req, res) => {
  try {
    const elapsedMs = ratingsSyncState.startTime
      ? Date.now() - ratingsSyncState.startTime
      : 0;

    // Also get count of games without ratings
    const gamesWithoutRatings = getGamesWithoutRatings();

    res.json({
      success: true,
      data: {
        inProgress: ratingsSyncState.inProgress,
        progress: ratingsSyncState.progress,
        result: ratingsSyncState.result,
        elapsedSeconds: Math.floor(elapsedMs / 1000),
        gamesWithoutRatings: gamesWithoutRatings.length,
      },
    });
  } catch (error) {
    console.error('Error getting ratings sync status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sync/ratings/count - Get count of games without ratings
router.get('/ratings/count', (_req, res) => {
  try {
    const gamesWithoutRatings = getGamesWithoutRatings();
    const allSteamGames = getAllSteamGames();

    res.json({
      success: true,
      data: {
        withoutRatings: gamesWithoutRatings.length,
        totalSteamGames: allSteamGames.length,
        withRatings: allSteamGames.length - gamesWithoutRatings.length,
      },
    });
  } catch (error) {
    console.error('Error getting ratings count:', error);
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

// Local cover cache state
let localCacheState: {
  inProgress: boolean;
  progress: { completed: number; total: number; current: string } | null;
  result: {
    total: number;
    success: number;
    failed: number;
    skipped: number;
    errors: Array<{ gameId: number; error: string }>;
  } | null;
  startTime: number | null;
} = {
  inProgress: false,
  progress: null,
  result: null,
  startTime: null,
};

// POST /api/sync/covers/cache - Download covers to local cache
router.post('/covers/cache', async (_req, res) => {
  try {
    if (localCacheState.inProgress) {
      res.status(409).json({
        success: false,
        error: 'Cover caching already in progress',
        progress: localCacheState.progress,
      });
      return;
    }

    // Get all games with covers
    const { games } = getAllGames({ limit: 10000 });
    const gamesWithCovers = games
      .filter((g): g is typeof g & { cover_image_url: string } =>
        !!g.cover_image_url && !g.cover_image_url.startsWith('/covers/'))
      .map((g) => ({ id: g.id, coverUrl: g.cover_image_url }));

    if (gamesWithCovers.length === 0) {
      res.json({
        success: true,
        message: 'No remote covers to cache',
        data: { total: 0, success: 0, failed: 0, skipped: 0 },
      });
      return;
    }

    localCacheState = {
      inProgress: true,
      progress: { completed: 0, total: gamesWithCovers.length, current: '' },
      result: null,
      startTime: Date.now(),
    };

    console.log(`Starting local cover cache for ${gamesWithCovers.length} games...`);

    // Run in background
    downloadCovers(gamesWithCovers, (completed, total, current) => {
      localCacheState.progress = { completed, total, current };
      if (completed % 100 === 0 || completed === total) {
        console.log(`[Cover Cache] ${completed}/${total}`);
      }
    })
      .then((result) => {
        localCacheState.inProgress = false;
        localCacheState.result = result;
        console.log(
          `Cover caching complete: ${result.success} success, ${result.failed} failed, ${result.skipped} skipped`
        );
      })
      .catch((error) => {
        localCacheState.inProgress = false;
        console.error('Cover caching error:', error);
      });

    res.json({
      success: true,
      message: 'Cover caching started',
      data: {
        total: gamesWithCovers.length,
        estimatedSeconds: Math.ceil(gamesWithCovers.length * 0.1), // ~0.1s per game
      },
    });
  } catch (error) {
    console.error('Error starting cover cache:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sync/covers/cache/status - Get local cache status
router.get('/covers/cache/status', (_req, res) => {
  try {
    const elapsedMs = localCacheState.startTime
      ? Date.now() - localCacheState.startTime
      : 0;

    const stats = getCacheStats();

    res.json({
      success: true,
      data: {
        inProgress: localCacheState.inProgress,
        progress: localCacheState.progress,
        result: localCacheState.result,
        elapsedSeconds: Math.floor(elapsedMs / 1000),
        cache: stats,
      },
    });
  } catch (error) {
    console.error('Error getting cover cache status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/sync/covers/cache - Clear local cover cache
router.delete('/covers/cache', (_req, res) => {
  try {
    const result = clearCache();
    res.json({
      success: true,
      message: `Deleted ${result.deleted} cached covers`,
      data: result,
    });
  } catch (error) {
    console.error('Error clearing cover cache:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Cover Fix Endpoints (SteamGridDB)
// ============================================================================

// POST /api/sync/covers/fix/:gameId - Fix a single cover via SteamGridDB
router.post('/covers/fix/:gameId', async (req, res) => {
  try {
    if (!process.env.STEAMGRIDDB_API_KEY) {
      res.status(400).json({
        success: false,
        error: 'STEAMGRIDDB_API_KEY not configured in environment',
      });
      return;
    }

    const gameId = parseInt(req.params.gameId, 10);
    if (isNaN(gameId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid game ID',
      });
      return;
    }

    const { searchTerm, title } = req.body || {};

    // Get game title if not provided
    const gameTitle = title || searchTerm || `Game ${gameId}`;

    console.log(`Fixing cover for game ${gameId} (${gameTitle})...`);

    const result = await fixSingleCover(gameId, gameTitle, searchTerm);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    console.error('Error fixing cover:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Batch fix state
let batchFixState: {
  inProgress: boolean;
  progress: { completed: number; total: number; current: string } | null;
  result: {
    total: number;
    success: number;
    failed: number;
    results: Array<{
      success: boolean;
      gameId: number;
      coverUrl?: string;
      error?: string;
    }>;
  } | null;
  startTime: number | null;
} = {
  inProgress: false,
  progress: null,
  result: null,
  startTime: null,
};

// POST /api/sync/covers/fix-batch - Fix multiple covers via SteamGridDB
router.post('/covers/fix-batch', async (req, res) => {
  try {
    if (!process.env.STEAMGRIDDB_API_KEY) {
      res.status(400).json({
        success: false,
        error: 'STEAMGRIDDB_API_KEY not configured in environment',
      });
      return;
    }

    if (batchFixState.inProgress) {
      res.status(409).json({
        success: false,
        error: 'Batch fix already in progress',
        progress: batchFixState.progress,
      });
      return;
    }

    const { games } = req.body || {};
    if (!Array.isArray(games) || games.length === 0) {
      res.status(400).json({
        success: false,
        error: 'games array is required',
      });
      return;
    }

    // Validate games array
    const validGames = games.filter(
      (g): g is { gameId: number; title: string } =>
        typeof g.gameId === 'number' && typeof g.title === 'string'
    );

    if (validGames.length === 0) {
      res.status(400).json({
        success: false,
        error: 'No valid games in array. Each must have gameId (number) and title (string)',
      });
      return;
    }

    batchFixState = {
      inProgress: true,
      progress: { completed: 0, total: validGames.length, current: '' },
      result: null,
      startTime: Date.now(),
    };

    console.log(`Starting batch cover fix for ${validGames.length} games...`);

    // Run in background
    fixMultipleCovers(validGames, (completed, total, current) => {
      batchFixState.progress = { completed, total, current };
      console.log(`[Batch Fix] ${completed}/${total} - ${current}`);
    })
      .then((result) => {
        batchFixState.inProgress = false;
        batchFixState.result = result;
        console.log(
          `Batch fix complete: ${result.success} success, ${result.failed} failed`
        );
      })
      .catch((error) => {
        batchFixState.inProgress = false;
        console.error('Batch fix error:', error);
      });

    res.json({
      success: true,
      message: 'Batch fix started',
      data: {
        total: validGames.length,
        estimatedSeconds: Math.ceil(validGames.length * 1), // ~1s per game (2 API calls + rate limit)
      },
    });
  } catch (error) {
    console.error('Error starting batch fix:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sync/covers/fix-batch/status - Get batch fix status
router.get('/covers/fix-batch/status', (_req, res) => {
  try {
    const elapsedMs = batchFixState.startTime
      ? Date.now() - batchFixState.startTime
      : 0;

    res.json({
      success: true,
      data: {
        inProgress: batchFixState.inProgress,
        progress: batchFixState.progress,
        result: batchFixState.result,
        elapsedSeconds: Math.floor(elapsedMs / 1000),
      },
    });
  } catch (error) {
    console.error('Error getting batch fix status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/sync/covers/fix-history/:gameId - Clear fix history for a specific game
router.delete('/covers/fix-history/:gameId', (req, res) => {
  try {
    const gameId = parseInt(req.params.gameId, 10);
    if (isNaN(gameId)) {
      res.status(400).json({
        success: false,
        error: 'Invalid game ID',
      });
      return;
    }

    clearTriedCovers(gameId);

    res.json({
      success: true,
      message: `Cleared fix history for game ${gameId}`,
    });
  } catch (error) {
    console.error('Error clearing fix history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sync/covers/fix-history - Get cover fix history with game details
router.get('/covers/fix-history', (_req, res) => {
  try {
    const history = getCoverFixHistory();
    const gameIds = Object.keys(history).map(Number);

    // Get game details for all games in history
    const { games: allGames } = getAllGames({ limit: 10000 });
    const gameMap = new Map(allGames.map(g => [g.id, g]));

    const items = gameIds.map(gameId => {
      const game = gameMap.get(gameId);
      const entry = history[String(gameId)];
      return {
        gameId,
        title: game?.title || `Unknown Game #${gameId}`,
        slug: game?.slug,
        triedGridIds: entry.gridIds,
        triedUrls: entry.triedUrls || [],
        attemptCount: entry.gridIds.length,
        lastTryTime: entry.lastTryTime,
      };
    }).sort((a, b) => b.lastTryTime - a.lastTryTime); // Sort by most recent first

    res.json({
      success: true,
      data: {
        totalGames: items.length,
        totalAttempts: items.reduce((sum, i) => sum + i.attemptCount, 0),
        items,
      },
    });
  } catch (error) {
    console.error('Error getting cover fix history:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// Hero/Logo Asset Predownload Endpoints
// ============================================================================

// Asset predownload state
let assetPredownloadState: {
  inProgress: boolean;
  progress: PredownloadProgress | null;
  result: PredownloadResult | null;
  startTime: number | null;
} = {
  inProgress: false,
  progress: null,
  result: null,
  startTime: null,
};

// POST /api/sync/assets - Predownload heroes and logos for all games
router.post('/assets', async (_req, res) => {
  try {
    if (assetPredownloadState.inProgress) {
      res.status(409).json({
        success: false,
        error: 'Asset predownload already in progress',
        progress: assetPredownloadState.progress,
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

    assetPredownloadState = {
      inProgress: true,
      progress: null,
      result: null,
      startTime: Date.now(),
    };

    console.log('Starting hero/logo asset predownload...');

    // Run in background
    predownloadAllAssets((progress) => {
      assetPredownloadState.progress = progress;
      if (progress.completed % 50 === 0 || progress.completed === progress.total) {
        console.log(
          `[Asset Predownload] ${progress.completed}/${progress.total} - Downloaded: ${progress.downloaded}, Skipped: ${progress.skipped}, Failed: ${progress.failed}`
        );
      }
    })
      .then((result) => {
        assetPredownloadState.inProgress = false;
        assetPredownloadState.result = result;
        console.log(
          `Asset predownload complete: ${result.downloaded} downloaded, ${result.skipped} skipped, ${result.failed} failed`
        );
      })
      .catch((error) => {
        assetPredownloadState.inProgress = false;
        console.error('Asset predownload error:', error);
      });

    res.json({
      success: true,
      message: 'Asset predownload started',
    });
  } catch (error) {
    console.error('Error starting asset predownload:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sync/assets/status - Get asset predownload status
router.get('/assets/status', (_req, res) => {
  try {
    const elapsedMs = assetPredownloadState.startTime
      ? Date.now() - assetPredownloadState.startTime
      : 0;

    res.json({
      success: true,
      data: {
        inProgress: assetPredownloadState.inProgress,
        progress: assetPredownloadState.progress,
        result: assetPredownloadState.result,
        elapsedSeconds: Math.floor(elapsedMs / 1000),
      },
    });
  } catch (error) {
    console.error('Error getting asset predownload status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// IGDB Sync Endpoints
// ============================================================================

// IGDB sync state (in-memory)
let igdbSyncState: {
  inProgress: boolean;
  progress: IGDBSyncProgress | null;
  result: IGDBSyncResult | null;
  startTime: number | null;
} = {
  inProgress: false,
  progress: null,
  result: null,
  startTime: null,
};

// GET /api/sync/igdb/count - Get count of games with/without IGDB data
router.get('/igdb/count', (_req, res) => {
  try {
    const stats = getIGDBSyncStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting IGDB sync count:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/sync/igdb - Sync IGDB metadata for all games
router.post('/igdb', async (_req, res) => {
  try {
    // Check required credentials
    if (!process.env.TWITCH_CLIENT_ID || !process.env.TWITCH_CLIENT_SECRET) {
      res.status(400).json({
        success: false,
        error: 'TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET must be configured for IGDB sync',
      });
      return;
    }

    // Check if already in progress
    if (igdbSyncState.inProgress) {
      res.status(409).json({
        success: false,
        error: 'IGDB sync already in progress',
        progress: igdbSyncState.progress,
      });
      return;
    }

    // Get games without IGDB metadata
    const gamesToSync = getGamesWithoutIGDBMetadata();

    if (gamesToSync.length === 0) {
      res.json({
        success: true,
        message: 'All games already have IGDB metadata',
        data: { totalGames: 0, matched: 0, notFound: 0, errors: [] },
      });
      return;
    }

    // Initialize state
    igdbSyncState = {
      inProgress: true,
      progress: {
        total: gamesToSync.length,
        current: 0,
        currentGame: '',
        matched: 0,
        failed: 0,
      },
      result: null,
      startTime: Date.now(),
    };

    console.log(`[IGDB] Starting sync for ${gamesToSync.length} games...`);

    // Run sync in background
    (async () => {
      const result: IGDBSyncResult = {
        totalGames: gamesToSync.length,
        matched: 0,
        notFound: 0,
        errors: [],
      };

      for (let i = 0; i < gamesToSync.length; i++) {
        const game = gamesToSync[i];

        // Update progress
        igdbSyncState.progress = {
          total: gamesToSync.length,
          current: i + 1,
          currentGame: game.title,
          matched: result.matched,
          failed: result.notFound + result.errors.length,
        };

        try {
          let igdbResult = null;

          // Try Steam ID lookup first (if available)
          if (game.steamAppId) {
            igdbResult = await getGameBySteamId(game.steamAppId);
          }

          // Fall back to title search
          if (!igdbResult) {
            igdbResult = await searchGameByTitle(game.title);
          }

          if (igdbResult) {
            const metadata = convertIGDBGameToMetadata(igdbResult.game, igdbResult.confidence);
            updateIGDBMetadata(game.id, metadata);
            result.matched++;

            if ((i + 1) % 50 === 0 || i + 1 === gamesToSync.length) {
              console.log(`[IGDB] Progress: ${i + 1}/${gamesToSync.length} - Matched: ${result.matched}`);
            }
          } else {
            result.notFound++;
          }
        } catch (error) {
          result.errors.push({
            gameId: game.id,
            title: game.title,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      igdbSyncState.inProgress = false;
      igdbSyncState.result = result;
      console.log(`[IGDB] Sync complete: ${result.matched} matched, ${result.notFound} not found, ${result.errors.length} errors`);
    })().catch((error) => {
      igdbSyncState.inProgress = false;
      console.error('[IGDB] Sync error:', error);
    });

    // Return immediately
    res.json({
      success: true,
      message: 'IGDB sync started',
      data: {
        total: gamesToSync.length,
        estimatedMinutes: Math.ceil(gamesToSync.length * 0.5 / 60), // ~0.5s per game with rate limiting
      },
    });
  } catch (error) {
    console.error('Error starting IGDB sync:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sync/igdb/status - Get IGDB sync status
router.get('/igdb/status', (_req, res) => {
  try {
    const elapsedMs = igdbSyncState.startTime
      ? Date.now() - igdbSyncState.startTime
      : 0;

    res.json({
      success: true,
      data: {
        inProgress: igdbSyncState.inProgress,
        progress: igdbSyncState.progress,
        result: igdbSyncState.result,
        elapsedSeconds: Math.floor(elapsedMs / 1000),
      },
    });
  } catch (error) {
    console.error('Error getting IGDB sync status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// SteamGridDB Enrichment Endpoints
// ============================================================================

// SteamGridDB enrichment state (in-memory)
let steamgridEnrichState: {
  inProgress: boolean;
  progress: SteamGridDBEnrichProgress | null;
  result: SteamGridDBEnrichResult | null;
  startTime: number | null;
} = {
  inProgress: false,
  progress: null,
  result: null,
  startTime: null,
};

// GET /api/sync/steamgrid/count - Get count of games with/without SteamGridDB enrichment
router.get('/steamgrid/count', (_req, res) => {
  try {
    const stats = getSteamGridDBSyncStats();
    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('Error getting SteamGridDB sync count:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/sync/steamgrid/enrich - Enrich all games with SteamGridDB data
router.post('/steamgrid/enrich', async (_req, res) => {
  try {
    // Check API key
    if (!process.env.STEAMGRIDDB_API_KEY) {
      res.status(400).json({
        success: false,
        error: 'STEAMGRIDDB_API_KEY must be configured for SteamGridDB enrichment',
      });
      return;
    }

    // Check if already in progress
    if (steamgridEnrichState.inProgress) {
      res.status(409).json({
        success: false,
        error: 'SteamGridDB enrichment already in progress',
        progress: steamgridEnrichState.progress,
      });
      return;
    }

    // Get games without enrichment
    const gamesToEnrich = getGamesWithoutSteamGridDBEnrichment();

    if (gamesToEnrich.length === 0) {
      res.json({
        success: true,
        message: 'All games already have SteamGridDB enrichment data',
        data: { totalGames: 0, enriched: 0, notFound: 0, errors: [] },
      });
      return;
    }

    // Initialize state
    steamgridEnrichState = {
      inProgress: true,
      progress: {
        total: gamesToEnrich.length,
        current: 0,
        currentGame: '',
        enriched: 0,
        failed: 0,
      },
      result: null,
      startTime: Date.now(),
    };

    console.log(`[SteamGridDB] Starting enrichment for ${gamesToEnrich.length} games...`);

    // Run enrichment in background
    (async () => {
      const result: SteamGridDBEnrichResult = {
        totalGames: gamesToEnrich.length,
        enriched: 0,
        notFound: 0,
        errors: [],
      };

      for (let i = 0; i < gamesToEnrich.length; i++) {
        const game = gamesToEnrich[i];

        // Update progress
        steamgridEnrichState.progress = {
          total: gamesToEnrich.length,
          current: i + 1,
          currentGame: game.title,
          enriched: result.enriched,
          failed: result.notFound + result.errors.length,
        };

        try {
          const enrichResult = await enrichGameWithSteamGridDB(
            game.id,
            game.title,
            game.steamAppId,
            game.steamgridId
          );

          if (enrichResult.success) {
            result.enriched++;

            if ((i + 1) % 50 === 0 || i + 1 === gamesToEnrich.length) {
              console.log(`[SteamGridDB] Progress: ${i + 1}/${gamesToEnrich.length} - Enriched: ${result.enriched}`);
            }
          } else {
            result.notFound++;
          }
        } catch (error) {
          result.errors.push({
            gameId: game.id,
            title: game.title,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      steamgridEnrichState.inProgress = false;
      steamgridEnrichState.result = result;
      console.log(`[SteamGridDB] Enrichment complete: ${result.enriched} enriched, ${result.notFound} not found, ${result.errors.length} errors`);
    })().catch((error) => {
      steamgridEnrichState.inProgress = false;
      console.error('[SteamGridDB] Enrichment error:', error);
    });

    // Return immediately
    res.json({
      success: true,
      message: 'SteamGridDB enrichment started',
      data: {
        total: gamesToEnrich.length,
        estimatedMinutes: Math.ceil(gamesToEnrich.length * 1.5 / 60), // ~1.5s per game (multiple API calls)
      },
    });
  } catch (error) {
    console.error('Error starting SteamGridDB enrichment:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sync/steamgrid/enrich/status - Get SteamGridDB enrichment status
router.get('/steamgrid/enrich/status', (_req, res) => {
  try {
    const elapsedMs = steamgridEnrichState.startTime
      ? Date.now() - steamgridEnrichState.startTime
      : 0;

    res.json({
      success: true,
      data: {
        inProgress: steamgridEnrichState.inProgress,
        progress: steamgridEnrichState.progress,
        result: steamgridEnrichState.result,
        elapsedSeconds: Math.floor(elapsedMs / 1000),
      },
    });
  } catch (error) {
    console.error('Error getting SteamGridDB enrichment status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// =====================
// Screenshot Sync
// =====================

// Screenshot sync progress types
interface ScreenshotSyncProgress {
  total: number;
  completed: number;
  downloaded: number;
  skipped: number;
  failed: number;
  currentGame: string;
}

interface ScreenshotSyncResult {
  total: number;
  downloaded: number;
  skipped: number;
  failed: number;
  screenshotsDownloaded: number;
}

// Screenshot sync state (in-memory)
let screenshotSyncState: {
  inProgress: boolean;
  progress: ScreenshotSyncProgress | null;
  result: ScreenshotSyncResult | null;
  startTime: number | null;
} = {
  inProgress: false,
  progress: null,
  result: null,
  startTime: null,
};

// GET /api/sync/screenshots/count - Get screenshot sync stats
router.get('/screenshots/count', (_req, res) => {
  try {
    const stats = getScreenshotSyncStats();
    const cacheStats = getAssetCacheStats();
    res.json({
      success: true,
      data: {
        gamesWithScreenshots: stats.withScreenshots,
        totalScreenshots: stats.totalScreenshots,
        totalGames: stats.total,
        cached: cacheStats.screenshots,
      },
    });
  } catch (error) {
    console.error('Error getting screenshot count:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/sync/screenshots - Download screenshots locally
router.post('/screenshots', async (_req, res) => {
  try {
    if (screenshotSyncState.inProgress) {
      res.status(409).json({
        success: false,
        error: 'Screenshot sync already in progress',
        progress: screenshotSyncState.progress,
      });
      return;
    }

    const gamesWithScreenshots = getGamesWithScreenshots();

    // Filter to games that don't have local screenshots yet
    const gamesToSync = gamesWithScreenshots.filter((g) => !hasLocalScreenshots(g.id));

    if (gamesToSync.length === 0) {
      res.json({
        success: true,
        message: 'All screenshots already downloaded',
        data: { total: 0, downloaded: 0, skipped: gamesWithScreenshots.length, failed: 0 },
      });
      return;
    }

    // Initialize state
    screenshotSyncState = {
      inProgress: true,
      progress: {
        total: gamesToSync.length,
        completed: 0,
        downloaded: 0,
        skipped: 0,
        failed: 0,
        currentGame: '',
      },
      result: null,
      startTime: Date.now(),
    };

    const totalScreenshots = gamesToSync.reduce((acc, g) => acc + g.screenshots.length, 0);
    console.log(`[Screenshot Sync] Starting download for ${gamesToSync.length} games (${totalScreenshots} screenshots)...`);

    // Start sync in background
    (async () => {
      let downloaded = 0;
      let skipped = 0;
      let failed = 0;
      let screenshotsDownloaded = 0;

      for (const game of gamesToSync) {
        screenshotSyncState.progress = {
          ...screenshotSyncState.progress!,
          currentGame: game.title,
        };

        try {
          const result = await downloadGameScreenshots(game.id, game.screenshots);
          if (result.downloaded > 0) {
            downloaded++;
            screenshotsDownloaded += result.downloaded;
          } else if (result.localUrls.length > 0) {
            skipped++;
          } else {
            failed++;
          }
        } catch (error) {
          console.error(`[Screenshot Sync] Error downloading screenshots for ${game.title}:`, error);
          failed++;
        }

        screenshotSyncState.progress = {
          total: gamesToSync.length,
          completed: downloaded + skipped + failed,
          downloaded,
          skipped,
          failed,
          currentGame: game.title,
        };

        // Log progress every 50 games
        if ((downloaded + skipped + failed) % 50 === 0) {
          console.log(
            `[Screenshot Sync] ${downloaded + skipped + failed}/${gamesToSync.length} - Downloaded: ${downloaded}, Skipped: ${skipped}, Failed: ${failed}`
          );
        }
      }

      screenshotSyncState.inProgress = false;
      screenshotSyncState.result = {
        total: gamesToSync.length,
        downloaded,
        skipped,
        failed,
        screenshotsDownloaded,
      };
      console.log(
        `[Screenshot Sync] Complete: ${downloaded} games (${screenshotsDownloaded} screenshots), ${skipped} skipped, ${failed} failed`
      );
    })().catch((error) => {
      screenshotSyncState.inProgress = false;
      console.error('[Screenshot Sync] Error:', error);
    });

    // Return immediately
    res.json({
      success: true,
      message: 'Screenshot sync started',
      data: {
        total: gamesToSync.length,
        totalScreenshots,
        estimatedMinutes: Math.ceil(totalScreenshots * 0.5 / 60), // ~0.5s per screenshot
      },
    });
  } catch (error) {
    console.error('Error starting screenshot sync:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sync/screenshots/status - Get screenshot sync status
router.get('/screenshots/status', (_req, res) => {
  try {
    const elapsedMs = screenshotSyncState.startTime
      ? Date.now() - screenshotSyncState.startTime
      : 0;

    res.json({
      success: true,
      data: {
        inProgress: screenshotSyncState.inProgress,
        progress: screenshotSyncState.progress,
        result: screenshotSyncState.result,
        elapsedSeconds: Math.floor(elapsedMs / 1000),
      },
    });
  } catch (error) {
    console.error('Error getting screenshot sync status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// ============================================================================
// UNIFIED STATUS & CONFIG ENDPOINTS (Sync Dashboard)
// ============================================================================

// Helper to get elapsed seconds
function getElapsedSeconds(startTime: number | null): number {
  return startTime ? Math.floor((Date.now() - startTime) / 1000) : 0;
}

// GET /api/sync/all-status - Aggregated status of all sync operations
router.get('/all-status', (_req, res) => {
  try {
    res.json({
      success: true,
      data: {
        steam: {
          inProgress: steamSyncState.inProgress,
          isQuick: steamSyncState.isQuick,
          progress: steamSyncState.progress,
          result: steamSyncState.result,
          error: steamSyncState.error,
          elapsedSeconds: getElapsedSeconds(steamSyncState.startTime),
        },
        genres: {
          inProgress: genreSyncState.inProgress,
          progress: genreSyncState.progress,
          result: genreSyncState.result,
          elapsedSeconds: getElapsedSeconds(genreSyncState.startTime),
        },
        ratings: {
          inProgress: ratingsSyncState.inProgress,
          progress: ratingsSyncState.progress,
          result: ratingsSyncState.result,
          elapsedSeconds: getElapsedSeconds(ratingsSyncState.startTime),
        },
        covers: {
          inProgress: coverSyncState.inProgress,
          progress: coverSyncState.progress,
          result: coverSyncState.result,
          elapsedSeconds: getElapsedSeconds(coverSyncState.startTime),
        },
        coverCache: {
          inProgress: localCacheState.inProgress,
          progress: localCacheState.progress,
          result: localCacheState.result,
          elapsedSeconds: getElapsedSeconds(localCacheState.startTime),
        },
        assets: {
          inProgress: assetPredownloadState.inProgress,
          progress: assetPredownloadState.progress,
          result: assetPredownloadState.result,
          elapsedSeconds: getElapsedSeconds(assetPredownloadState.startTime),
        },
        igdb: {
          inProgress: igdbSyncState.inProgress,
          progress: igdbSyncState.progress,
          result: igdbSyncState.result,
          elapsedSeconds: getElapsedSeconds(igdbSyncState.startTime),
        },
        steamgrid: {
          inProgress: steamgridEnrichState.inProgress,
          progress: steamgridEnrichState.progress,
          result: steamgridEnrichState.result,
          elapsedSeconds: getElapsedSeconds(steamgridEnrichState.startTime),
        },
        screenshots: {
          inProgress: screenshotSyncState.inProgress,
          progress: screenshotSyncState.progress,
          result: screenshotSyncState.result,
          elapsedSeconds: getElapsedSeconds(screenshotSyncState.startTime),
        },
      },
    });
  } catch (error) {
    console.error('Error getting all sync status:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sync/db-stats - Comprehensive database asset statistics
router.get('/db-stats', (_req, res) => {
  try {
    const totalGames = getGameCount();
    const gamesWithoutGenres = getGamesWithoutGenres().length;
    const gamesWithoutRatings = getGamesWithoutRatings().length;
    const gamesWithoutCovers = getGamesWithoutCoversRepo().length;
    const gamesWithoutSteamMetadata = getGamesWithoutSteamMetadata().length;
    const igdbStats = getIGDBSyncStats();
    const steamgridStats = getSteamGridDBSyncStats();
    const screenshotStats = getScreenshotSyncStats();
    const coverCacheStats = getCacheStats();
    const assetCacheStats = getAssetCacheStats();

    res.json({
      success: true,
      data: {
        totalGames,
        library: {
          total: totalGames,
          withSteamMetadata: totalGames - gamesWithoutSteamMetadata,
          withoutSteamMetadata: gamesWithoutSteamMetadata,
          percentage: totalGames > 0 ? Math.round(((totalGames - gamesWithoutSteamMetadata) / totalGames) * 100) : 0,
        },
        genres: {
          total: totalGames,
          withGenres: totalGames - gamesWithoutGenres,
          withoutGenres: gamesWithoutGenres,
          percentage: totalGames > 0 ? Math.round(((totalGames - gamesWithoutGenres) / totalGames) * 100) : 0,
        },
        ratings: {
          total: totalGames,
          withRatings: totalGames - gamesWithoutRatings,
          withoutRatings: gamesWithoutRatings,
          percentage: totalGames > 0 ? Math.round(((totalGames - gamesWithoutRatings) / totalGames) * 100) : 0,
        },
        covers: {
          total: totalGames,
          withCovers: totalGames - gamesWithoutCovers,
          withoutCovers: gamesWithoutCovers,
          percentage: totalGames > 0 ? Math.round(((totalGames - gamesWithoutCovers) / totalGames) * 100) : 0,
          cached: coverCacheStats.totalFiles,
          cachedPercentage: totalGames > 0 ? Math.round((coverCacheStats.totalFiles / totalGames) * 100) : 0,
        },
        igdb: {
          total: igdbStats.total,
          withIGDB: igdbStats.withIGDB,
          withoutIGDB: igdbStats.withoutIGDB,
          percentage: igdbStats.total > 0 ? Math.round((igdbStats.withIGDB / igdbStats.total) * 100) : 0,
        },
        steamgrid: {
          total: steamgridStats.total,
          enriched: steamgridStats.enriched,
          notEnriched: steamgridStats.notEnriched,
          percentage: steamgridStats.total > 0 ? Math.round((steamgridStats.enriched / steamgridStats.total) * 100) : 0,
        },
        assets: {
          heroes: assetCacheStats.heroes.count,
          logos: assetCacheStats.logos.count,
          icons: assetCacheStats.icons.count,
          heroPercentage: totalGames > 0 ? Math.round((assetCacheStats.heroes.count / totalGames) * 100) : 0,
          logoPercentage: totalGames > 0 ? Math.round((assetCacheStats.logos.count / totalGames) * 100) : 0,
        },
        screenshots: {
          gamesWithScreenshots: screenshotStats.withScreenshots,
          totalScreenshots: screenshotStats.totalScreenshots,
          percentage: screenshotStats.total > 0 ? Math.round((screenshotStats.withScreenshots / screenshotStats.total) * 100) : 0,
        },
      },
    });
  } catch (error) {
    console.error('Error getting db stats:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/sync/config - API key availability status
router.get('/config', (_req, res) => {
  try {
    res.json({
      success: true,
      data: {
        hasSteamKey: !!process.env.STEAM_API_KEY,
        hasSteamUserId: !!process.env.STEAM_USER_ID,
        hasSteamGridDBKey: !!process.env.STEAMGRIDDB_API_KEY,
        hasIGDBKeys: !!(process.env.TWITCH_CLIENT_ID && process.env.TWITCH_CLIENT_SECRET),
      },
    });
  } catch (error) {
    console.error('Error getting sync config:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Abort flags for each sync operation
const abortFlags: Record<string, boolean> = {
  steam: false,
  genres: false,
  ratings: false,
  covers: false,
  coverCache: false,
  assets: false,
  igdb: false,
  steamgrid: false,
  screenshots: false,
};

// Check if abort was requested for an operation
export function isAbortRequested(operation: string): boolean {
  return abortFlags[operation] ?? false;
}

// POST /api/sync/abort/:operation - Abort a running sync operation
router.post('/abort/:operation', (req, res) => {
  try {
    const { operation } = req.params;

    if (!(operation in abortFlags)) {
      res.status(400).json({
        success: false,
        error: `Unknown operation: ${operation}. Valid operations: ${Object.keys(abortFlags).join(', ')}`,
      });
      return;
    }

    // Set the abort flag
    abortFlags[operation] = true;
    console.log(`[Sync] Abort requested for: ${operation}`);

    res.json({
      success: true,
      message: `Abort requested for ${operation}. Operation will stop shortly.`,
    });
  } catch (error) {
    console.error('Error aborting sync:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Reset abort flag (called when starting a new sync)
export function resetAbortFlag(operation: string): void {
  if (operation in abortFlags) {
    abortFlags[operation] = false;
  }
}

export default router;
