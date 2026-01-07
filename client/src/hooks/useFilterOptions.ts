import { useState, useEffect, useRef } from 'react';
import { fetchFilterOptions, FilterOptions, SortOption } from '../services/gamesService';

interface UseFilterOptionsResult {
  platforms: string[];
  genres: string[];
  sortOptions: SortOption[];
  loading: boolean;
  error: string | null;
}

// Cache the result to avoid refetching on every render
let cachedOptions: FilterOptions | null = null;
let cachePromise: Promise<FilterOptions> | null = null;

export function useFilterOptions(): UseFilterOptionsResult {
  const [options, setOptions] = useState<FilterOptions | null>(cachedOptions);
  const [loading, setLoading] = useState(!cachedOptions);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    // If we already have cached options, use them
    if (cachedOptions) {
      setOptions(cachedOptions);
      setLoading(false);
      return;
    }

    // If a fetch is already in progress, wait for it
    if (!cachePromise) {
      cachePromise = fetchFilterOptions();
    }

    cachePromise
      .then((data) => {
        cachedOptions = data;
        if (mountedRef.current) {
          setOptions(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to load filter options');
          setLoading(false);
        }
      });

    return () => {
      mountedRef.current = false;
    };
  }, []);

  return {
    platforms: options?.platforms ?? [],
    genres: options?.genres ?? [],
    sortOptions: options?.sortOptions ?? [],
    loading,
    error,
  };
}

// For testing: clear the cache
export function clearFilterOptionsCache(): void {
  cachedOptions = null;
  cachePromise = null;
}
