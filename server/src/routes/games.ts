import { Router } from 'express';
import {
  getAllGames,
  getGameById,
  getGameBySlug,
  getGameCount,
  getDistinctGenres,
  getDistinctPlatforms,
  deleteGame,
  getPlatformsForGames,
  type GameQueryOptions,
} from '../db/repositories/gameRepository.js';

const router = Router();

// Sort options configuration
const SORT_OPTIONS = [
  { id: 'title-asc', label: 'Title A-Z', sortBy: 'title', sortOrder: 'asc' },
  { id: 'title-desc', label: 'Title Z-A', sortBy: 'title', sortOrder: 'desc' },
  { id: 'release-desc', label: 'Release Date (Newest)', sortBy: 'release_date', sortOrder: 'desc' },
  { id: 'release-asc', label: 'Release Date (Oldest)', sortBy: 'release_date', sortOrder: 'asc' },
  { id: 'metacritic-desc', label: 'Metacritic Score', sortBy: 'metacritic_score', sortOrder: 'desc' },
  { id: 'added-desc', label: 'Date Added', sortBy: 'created_at', sortOrder: 'desc' },
] as const;

// Static platform list (these are the supported platforms)
const STATIC_PLATFORMS = ['steam', 'gamepass', 'eaplay', 'ubisoftplus'];

// GET /api/games/filters - Get filter options
router.get('/filters', (_req, res) => {
  try {
    // Get platforms from DB or use static list
    const dbPlatforms = getDistinctPlatforms();
    const platforms = dbPlatforms.length > 0 ? dbPlatforms : STATIC_PLATFORMS;

    // Get genres from DB (cached)
    const genres = getDistinctGenres();

    res.json({
      success: true,
      data: {
        platforms,
        genres,
        sortOptions: SORT_OPTIONS,
      },
    });
  } catch (error) {
    console.error('Error fetching filter options:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Helper to parse CSV params
function parseCSVParam(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(v => v.trim()).filter(v => v.length > 0);
}

// GET /api/games - List all games with filtering
router.get('/', (req, res) => {
  try {
    // Parse multi-select params (plural takes precedence over singular)
    const platformsParam = req.query.platforms as string | undefined;
    const platformParam = req.query.platform as string | undefined;
    const platforms = parseCSVParam(platformsParam) || parseCSVParam(platformParam);

    const genresParam = req.query.genres as string | undefined;
    const genreParam = req.query.genre as string | undefined;
    const genres = parseCSVParam(genresParam) || parseCSVParam(genreParam);

    // Parse collections param
    const collectionsParam = req.query.collections as string | undefined;
    const collectionIds = collectionsParam
      ? collectionsParam.split(',').map(Number).filter(n => !isNaN(n))
      : undefined;

    const options: GameQueryOptions = {
      search: req.query.search as string | undefined,
      platforms: platforms.length > 0 ? platforms : undefined,
      platform: !platforms.length ? (platformParam || undefined) : undefined,
      genres: genres.length > 0 ? genres : undefined,
      genre: !genres.length ? (genreParam || undefined) : undefined,
      tag: req.query.tag as string | undefined,
      collectionIds,
      sortBy: req.query.sortBy as GameQueryOptions['sortBy'],
      sortOrder: req.query.sortOrder as GameQueryOptions['sortOrder'],
      limit: req.query.limit ? parseInt(req.query.limit as string, 10) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string, 10) : 0,
    };

    const { games, total } = getAllGames(options);

    // Get platforms for all games in one query
    const gameIds = games.map((g) => g.id);
    const platformsMap = getPlatformsForGames(gameIds);

    // Parse JSON fields and add platforms for response
    const parsedGames = games.map((game) => ({
      ...game,
      screenshots: JSON.parse(game.screenshots),
      genres: JSON.parse(game.genres),
      tags: JSON.parse(game.tags),
      platforms: platformsMap.get(game.id) || [],
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

// GET /api/games/slug/:slug - Get single game by slug
// IMPORTANT: This route MUST be before /:id to avoid slug being matched as an id
router.get('/slug/:slug', (req, res) => {
  try {
    const { slug } = req.params;

    const game = getGameBySlug(slug);

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
    console.error('Error fetching game by slug:', error);
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

// DELETE /api/games/:id - Delete a game by ID
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid game ID' });
      return;
    }

    const deleted = deleteGame(id);

    if (!deleted) {
      res.status(404).json({ success: false, error: 'Game not found' });
      return;
    }

    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting game:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
