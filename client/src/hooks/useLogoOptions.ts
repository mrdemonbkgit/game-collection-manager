import { useState, useEffect, useCallback, useRef } from 'react';
import {
  fetchLogoOptions,
  SteamGridAssetOption,
} from '../services/gamesService';

interface UseLogoOptionsResult {
  options: SteamGridAssetOption[];
  total: number;
  hasMore: boolean;
  currentAssetId: number | null;
  currentLocalUrl: string | null;
  loading: boolean;
  error: string | null;
  fetchMore: () => Promise<void>;
  reset: () => void;
}

export function useLogoOptions(gameId: number | undefined): UseLogoOptionsResult {
  const [options, setOptions] = useState<SteamGridAssetOption[]>([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [currentAssetId, setCurrentAssetId] = useState<number | null>(null);
  const [currentLocalUrl, setCurrentLocalUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchPage = useCallback(async (offset: number, append: boolean) => {
    if (!gameId) return;

    // Abort previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    setLoading(true);
    setError(null);

    try {
      const response = await fetchLogoOptions(gameId, 6, offset);

      if (!abortControllerRef.current?.signal.aborted) {
        if (append) {
          setOptions(prev => [...prev, ...response.options]);
        } else {
          setOptions(response.options);
        }
        setTotal(response.total);
        setHasMore(response.hasMore);
        setCurrentAssetId(response.currentAssetId);
        setCurrentLocalUrl(response.currentLocalUrl);
        offsetRef.current = offset + response.options.length;
      }
    } catch (err) {
      if (!abortControllerRef.current?.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Failed to fetch logo options');
      }
    } finally {
      if (!abortControllerRef.current?.signal.aborted) {
        setLoading(false);
      }
    }
  }, [gameId]);

  // Initial fetch
  useEffect(() => {
    if (gameId) {
      offsetRef.current = 0;
      fetchPage(0, false);
    } else {
      setOptions([]);
      setTotal(0);
      setHasMore(false);
      setCurrentAssetId(null);
      setCurrentLocalUrl(null);
    }

    return () => {
      abortControllerRef.current?.abort();
    };
  }, [gameId, fetchPage]);

  const fetchMore = useCallback(async () => {
    if (!loading && hasMore) {
      await fetchPage(offsetRef.current, true);
    }
  }, [loading, hasMore, fetchPage]);

  const reset = useCallback(() => {
    offsetRef.current = 0;
    fetchPage(0, false);
  }, [fetchPage]);

  return {
    options,
    total,
    hasMore,
    currentAssetId,
    currentLocalUrl,
    loading,
    error,
    fetchMore,
    reset,
  };
}
