import { useState, useEffect, useCallback, useRef } from 'react';
import { Game } from '../types/game';
import { fetchGames, FetchGamesParams } from '../services/gamesService';

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

  // Refs to prevent duplicate requests
  const isLoadingMoreRef = useRef(false);
  const lastLoadTimeRef = useRef(0);

  const hasMore = games.length < total;

  // Load games for a specific page
  const loadGames = useCallback(
    async (pageNum: number, append: boolean) => {
      // Throttle check for appending only
      const now = Date.now();
      if (append && now - lastLoadTimeRef.current < THROTTLE_MS) {
        return;
      }
      lastLoadTimeRef.current = now;

      // Prevent duplicate in-flight requests for append
      if (append && isLoadingMoreRef.current) {
        return;
      }

      try {
        isLoadingMoreRef.current = true;
        setLoading(true); // Always set loading to true for guard in GameGrid
        setError(null);

        const result = await fetchGames({
          ...params,
          page: pageNum,
          pageSize: PAGE_SIZE,
        });

        setGames((prev) => (append ? [...prev, ...result.items] : result.items));
        setTotal(result.total);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load games');
      } finally {
        setLoading(false);
        isLoadingMoreRef.current = false;
      }
    },
    [params]
  );

  // Load more games (for infinite scroll)
  const loadMore = useCallback(() => {
    if (isLoadingMoreRef.current || !hasMore) {
      return;
    }
    const nextPage = page + 1;
    setPage(nextPage);
    loadGames(nextPage, true);
  }, [page, hasMore, loadGames]);

  // Refresh/reset
  const refresh = useCallback(() => {
    setPage(1);
    setGames([]);
    setTotal(0);
    loadGames(1, false);
  }, [loadGames]);

  // Initial load
  useEffect(() => {
    setPage(1);
    setGames([]);
    setTotal(0);
    loadGames(1, false);
  }, [loadGames]);

  return { games, total, loading, error, hasMore, loadMore, refresh };
}
