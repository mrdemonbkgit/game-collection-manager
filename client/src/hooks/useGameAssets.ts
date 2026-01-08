import { useState, useEffect, useRef } from 'react';
import { fetchGameAssets, SteamGridAssets } from '../services/gamesService';

interface UseGameAssetsResult {
  heroUrl: string | null;
  logoUrl: string | null;
  loading: boolean;
  error: string | null;
}

export function useGameAssets(gameId: number | undefined): UseGameAssetsResult {
  const [assets, setAssets] = useState<SteamGridAssets>({ heroUrl: null, logoUrl: null });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!gameId) {
      setAssets({ heroUrl: null, logoUrl: null });
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

    fetchGameAssets(gameId)
      .then((data) => {
        if (!abortController.signal.aborted) {
          setAssets(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (!abortController.signal.aborted) {
          // Don't show error for 404s (game not found on SteamGridDB)
          if (err instanceof Error && err.message.includes('404')) {
            setAssets({ heroUrl: null, logoUrl: null });
          } else {
            setError(err instanceof Error ? err.message : 'Failed to load assets');
          }
          setLoading(false);
        }
      });

    return () => {
      abortController.abort();
    };
  }, [gameId]);

  return {
    heroUrl: assets.heroUrl,
    logoUrl: assets.logoUrl,
    loading,
    error,
  };
}
