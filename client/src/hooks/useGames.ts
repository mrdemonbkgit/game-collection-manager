import { useState, useEffect, useCallback, useRef } from 'react';
import { Game } from '../types/game';
import { fetchGames, FetchGamesParams } from '../services/gamesService';
import { debug, useRenderLogger, useStateLogger } from '../utils/debug';

interface UseGamesResult {
  games: Game[];
  total: number;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  loadMore: () => void;
  refresh: () => void;
}

const PAGE_SIZE = 50;
const THROTTLE_MS = 200;

export function useGames(
  params: Omit<FetchGamesParams, 'page' | 'pageSize'> = {}
): UseGamesResult {
  const [games, setGames] = useState<Game[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Debug: Track renders
  useRenderLogger('useGames', { page, loading, gamesLength: games.length, total });

  // Debug: Track state changes
  useStateLogger('useGames', 'loading', loading);
  useStateLogger('useGames', 'page', page);
  useStateLogger('useGames', 'gamesLength', games.length);

  // Stabilize params by comparing JSON - prevents infinite loop when caller
  // passes inline object like { sortBy: 'title' } which creates new ref each render
  const paramsRef = useRef(params);
  const paramsJson = JSON.stringify(params);
  const prevParamsJson = useRef(paramsJson);

  if (paramsJson !== prevParamsJson.current) {
    paramsRef.current = params;
    prevParamsJson.current = paramsJson;
    debug.log('info', 'useGames: params changed', params);
  }

  // Refs to prevent duplicate requests
  const isLoadingMoreRef = useRef(false);
  const lastLoadTimeRef = useRef(0);

  const hasMore = games.length < total;

  // Load games for a specific page
  // Note: Using paramsRef.current instead of params to avoid dependency changes
  const loadGames = useCallback(
    async (pageNum: number, append: boolean) => {
      console.log('[useGames] loadGames called:', { pageNum, append, params: paramsRef.current });
      debug.logCallback('useGames', 'loadGames', [{ pageNum, append, isLoadingMore: isLoadingMoreRef.current }]);

      // Throttle check for appending only
      const now = Date.now();
      const timeSinceLastLoad = now - lastLoadTimeRef.current;
      if (append && timeSinceLastLoad < THROTTLE_MS) {
        debug.log('info', `useGames.loadGames: THROTTLED (${timeSinceLastLoad}ms since last)`);
        return;
      }
      lastLoadTimeRef.current = now;

      // Prevent duplicate in-flight requests for append
      if (append && isLoadingMoreRef.current) {
        debug.log('info', 'useGames.loadGames: SKIPPED (already loading)');
        return;
      }

      try {
        debug.log('info', `useGames.loadGames: STARTING page ${pageNum}, append=${append}`);
        isLoadingMoreRef.current = true;
        setLoading(true); // Always set loading to true for guard in GameGrid
        setError(null);

        const result = await fetchGames({
          ...paramsRef.current, // Use ref to avoid dependency on params object
          page: pageNum,
          pageSize: PAGE_SIZE,
        });

        debug.log('info', `useGames.loadGames: SUCCESS page ${pageNum}`, {
          itemsReceived: result.items.length,
          total: result.total,
        });

        setGames((prev) => (append ? [...prev, ...result.items] : result.items));
        setTotal(result.total);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Failed to load games';
        debug.log('error', `useGames.loadGames: ERROR`, { error: errorMsg });
        setError(errorMsg);
      } finally {
        setLoading(false);
        isLoadingMoreRef.current = false;
        debug.log('info', 'useGames.loadGames: FINISHED');
      }
    },
    [] // Empty deps - params accessed via ref
  );

  // Load more games (for infinite scroll)
  const loadMore = useCallback(() => {
    debug.logCallback('useGames', 'loadMore', [{
      isLoadingMore: isLoadingMoreRef.current,
      hasMore,
      currentPage: page,
      gamesLength: games.length,
    }]);

    if (isLoadingMoreRef.current) {
      debug.log('info', 'useGames.loadMore: SKIPPED (already loading)');
      return;
    }
    if (!hasMore) {
      debug.log('info', 'useGames.loadMore: SKIPPED (no more data)');
      return;
    }

    const nextPage = page + 1;
    debug.log('warn', `useGames.loadMore: TRIGGERING page ${nextPage}`);
    setPage(nextPage);
    loadGames(nextPage, true);
  }, [page, hasMore, loadGames, games.length]);

  // Refresh/reset
  const refresh = useCallback(() => {
    setPage(1);
    setGames([]);
    setTotal(0);
    loadGames(1, false);
  }, [loadGames]);

  // Initial load and reload when params change
  useEffect(() => {
    console.log('[useGames] Initial load effect running, paramsJson:', paramsJson);
    debug.log('info', 'useGames: Initial/params-change load triggered');
    setPage(1);
    setGames([]);
    setTotal(0);
    loadGames(1, false);
  }, [paramsJson, loadGames]); // loadGames is stable (empty deps)

  return { games, total, loading, error, hasMore, loadMore, refresh };
}
