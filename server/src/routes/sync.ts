import { Router } from 'express';
import { syncSteamLibrary, quickSyncSteamLibrary } from '../services/steamService.js';
import { clearAllGames, getGameCount } from '../db/repositories/gameRepository.js';

const router = Router();

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

export default router;
