import { Router } from 'express';
import {
  getAllGames,
  getGameById,
  getGameCount,
  type GameQueryOptions,
} from '../db/repositories/gameRepository.js';

const router = Router();

// GET /api/games - List all games with filtering
router.get('/', (req, res) => {
  try {
    const options: GameQueryOptions = {
      search: req.query.search as string | undefined,
      platform: req.query.platform as string | undefined,
      genre: req.query.genre as string | undefined,
      tag: req.query.tag as string | undefined,
      sortBy: req.query.sortBy as GameQueryOptions['sortBy'],
      sortOrder: req.query.sortOrder as GameQueryOptions['sortOrder'],
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    const { games, total } = getAllGames(options);

    // Parse JSON fields for response
    const parsedGames = games.map((game) => ({
      ...game,
      screenshots: JSON.parse(game.screenshots),
      genres: JSON.parse(game.genres),
      tags: JSON.parse(game.tags),
    }));

    res.json({
      success: true,
      data: {
        items: parsedGames,
        total,
        page: Math.floor((options.offset || 0) / (options.limit || 50)) + 1,
        pageSize: options.limit || 50,
        totalPages: Math.ceil(total / (options.limit || 50)),
      },
    });
  } catch (error) {
    console.error('Error fetching games:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/games/count - Get total game count
router.get('/count', (_req, res) => {
  try {
    const count = getGameCount();
    res.json({ success: true, data: { count } });
  } catch (error) {
    console.error('Error getting game count:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/games/:id - Get single game by ID
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid game ID' });
      return;
    }

    const game = getGameById(id);

    if (!game) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }

    // Parse JSON fields
    const parsedGame = {
      ...game,
      screenshots: JSON.parse(game.screenshots),
      genres: JSON.parse(game.genres),
      tags: JSON.parse(game.tags),
    };

    res.json({ success: true, data: parsedGame });
  } catch (error) {
    console.error('Error fetching game:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
