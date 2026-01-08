import { useState, useEffect, useRef } from 'react';
import { Game } from '../types/game';
import { fetchGameBySlug } from '../services/gamesService';

interface UseGameResult {
  game: Game | null;
  loading: boolean;
  error: string | null;
}

export function useGame(slug: string | undefined): UseGameResult {
  const [game, setGame] = useState<Game | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    if (!slug) {
      setLoading(false);
      setError('No slug provided');
      return;
    }

    setLoading(true);
    setError(null);

    fetchGameBySlug(slug)
      .then((data) => {
        if (mountedRef.current) {
          setGame(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load game');
          setLoading(false);
        }
      });

    return () => {
      mountedRef.current = false;
    };
  }, [slug]);

  return {
    game,
    loading,
    error,
  };
}
