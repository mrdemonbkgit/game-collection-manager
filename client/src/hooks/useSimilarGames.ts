import { useState, useEffect, useRef } from 'react';
import { Game } from '../types/game';
import { fetchSimilarGames } from '../services/gamesService';

interface UseSimilarGamesResult {
  games: Game[];
  loading: boolean;
  error: string | null;
}

export function useSimilarGames(gameId: number | undefined, limit = 10): UseSimilarGamesResult {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!gameId) {
      setGames([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Abort any previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

    fetchSimilarGames(gameId, limit)
      .then((data) => {
        if (!abortController.signal.aborted) {
          setGames(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!abortController.signal.aborted) {
          setError(err instanceof Error ? err.message : 'Failed to load similar games');
          setLoading(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [gameId, limit]);

  return {
    games,
    loading,
    error,
  };
}
