import { Router } from 'express';
import {
  getAllCollections,
  getCollectionById,
  insertCollection,
  updateCollection,
  deleteCollection,
  addGameToCollection,
  removeGameFromCollection,
  getGamesInCollection,
  getCollectionGameCounts,
} from '../db/repositories/collectionRepository.js';
import { getAllGames } from '../db/repositories/gameRepository.js';

const router = Router();

// GET /api/collections - List all collections with game counts
router.get('/', (_req, res) => {
  try {
    const collections = getAllCollections();
    const counts = getCollectionGameCounts();

    // Merge counts into collection responses
    const countsMap = new Map(counts.map((c) => [c.collection_id, c.count]));
    const data = collections.map((c) => ({
      ...c,
      game_count: countsMap.get(c.id) || 0,
    }));

    res.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching collections:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/collections/:id - Get single collection
router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid collection ID' });
      return;
    }

    const collection = getCollectionById(id);

    if (!collection) {
      res.status(404).json({ success: false, error: 'Collection not found' });
      return;
    }

    // Get game count for this collection
    const counts = getCollectionGameCounts();
    const countEntry = counts.find((c) => c.collection_id === id);

    res.json({
      success: true,
      data: {
        ...collection,
        game_count: countEntry?.count || 0,
      },
    });
  } catch (error) {
    console.error('Error fetching collection:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/collections - Create collection
router.post('/', (req, res) => {
  try {
    const { name, description, is_smart_filter, filter_criteria } = req.body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      res.status(400).json({ success: false, error: 'Name is required' });
      return;
    }

    const id = insertCollection({
      name: name.trim(),
      description: description || undefined,
      isSmartFilter: is_smart_filter === 1 || is_smart_filter === true,
      filterCriteria: filter_criteria ? JSON.parse(filter_criteria) : undefined,
    });

    const collection = getCollectionById(id);

    res.status(201).json({
      success: true,
      data: {
        ...collection,
        game_count: 0,
      },
    });
  } catch (error) {
    console.error('Error creating collection:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// PUT /api/collections/:id - Update collection
router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid collection ID' });
      return;
    }

    const existing = getCollectionById(id);
    if (!existing) {
      res.status(404).json({ success: false, error: 'Collection not found' });
      return;
    }

    const { name, description, is_smart_filter, filter_criteria } = req.body;

    const updates: {
      name?: string;
      description?: string;
      isSmartFilter?: boolean;
      filterCriteria?: Record<string, unknown>;
    } = {};

    if (name !== undefined) {
      if (typeof name !== 'string' || name.trim().length === 0) {
        res.status(400).json({ success: false, error: 'Name cannot be empty' });
        return;
      }
      updates.name = name.trim();
    }

    if (description !== undefined) {
      updates.description = description;
    }

    if (is_smart_filter !== undefined) {
      updates.isSmartFilter = is_smart_filter === 1 || is_smart_filter === true;
    }

    if (filter_criteria !== undefined) {
      updates.filterCriteria = filter_criteria ? JSON.parse(filter_criteria) : undefined;
    }

    updateCollection(id, updates);

    const collection = getCollectionById(id);
    const counts = getCollectionGameCounts();
    const countEntry = counts.find((c) => c.collection_id === id);

    res.json({
      success: true,
      data: {
        ...collection,
        game_count: countEntry?.count || 0,
      },
    });
  } catch (error) {
    console.error('Error updating collection:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/collections/:id - Delete collection
router.delete('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);

    if (isNaN(id)) {
      res.status(400).json({ success: false, error: 'Invalid collection ID' });
      return;
    }

    const deleted = deleteCollection(id);

    if (!deleted) {
      res.status(404).json({ success: false, error: 'Collection not found' });
      return;
    }

    res.json({ success: true, data: { deleted: true } });
  } catch (error) {
    console.error('Error deleting collection:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// POST /api/collections/:id/games/:gameId - Add game to collection
router.post('/:id/games/:gameId', (req, res) => {
  try {
    const collectionId = parseInt(req.params.id, 10);
    const gameId = parseInt(req.params.gameId, 10);

    if (isNaN(collectionId) || isNaN(gameId)) {
      res.status(400).json({ success: false, error: 'Invalid ID' });
      return;
    }

    const collection = getCollectionById(collectionId);
    if (!collection) {
      res.status(404).json({ success: false, error: 'Collection not found' });
      return;
    }

    addGameToCollection(collectionId, gameId);

    res.json({ success: true, data: { added: true } });
  } catch (error) {
    console.error('Error adding game to collection:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// DELETE /api/collections/:id/games/:gameId - Remove game from collection
router.delete('/:id/games/:gameId', (req, res) => {
  try {
    const collectionId = parseInt(req.params.id, 10);
    const gameId = parseInt(req.params.gameId, 10);

    if (isNaN(collectionId) || isNaN(gameId)) {
      res.status(400).json({ success: false, error: 'Invalid ID' });
      return;
    }

    const removed = removeGameFromCollection(collectionId, gameId);

    res.json({ success: true, data: { removed } });
  } catch (error) {
    console.error('Error removing game from collection:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// GET /api/collections/:id/games - List games in collection (paginated)
router.get('/:id/games', (req, res) => {
  try {
    const collectionId = parseInt(req.params.id, 10);

    if (isNaN(collectionId)) {
      res.status(400).json({ success: false, error: 'Invalid collection ID' });
      return;
    }

    const collection = getCollectionById(collectionId);
    if (!collection) {
      res.status(404).json({ success: false, error: 'Collection not found' });
      return;
    }

    const gameIds = getGamesInCollection(collectionId);

    if (gameIds.length === 0) {
      res.json({
        success: true,
        data: {
          items: [],
          total: 0,
          page: 1,
          pageSize: 50,
          totalPages: 0,
        },
      });
      return;
    }

    // Get games filtered by collection
    const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string, 10) : 0;

    const { games, total } = getAllGames({
      collectionIds: [collectionId],
      limit,
      offset,
    });

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
        page: Math.floor(offset / limit) + 1,
        pageSize: limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error fetching games in collection:', error);
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
