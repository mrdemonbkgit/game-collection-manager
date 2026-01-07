import { useState, useEffect, useRef, useCallback } from 'react';
import { fetchCollections } from '../services/collectionsService';
import { Collection } from '../types/collection';

interface UseCollectionsResult {
  collections: Collection[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

// Module-level cache (same pattern as useFilterOptions)
let cachedCollections: Collection[] | null = null;
let cachePromise: Promise<Collection[]> | null = null; // Prevent duplicate requests

export function useCollections(): UseCollectionsResult {
  const [collections, setCollections] = useState<Collection[]>(
    cachedCollections || []
  );
  const [loading, setLoading] = useState(!cachedCollections);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (cachedCollections) {
      setCollections(cachedCollections);
      setLoading(false);
      return;
    }

    // Use shared promise to prevent duplicate requests
    if (!cachePromise) {
      cachePromise = fetchCollections();
    }

    cachePromise
      .then((data) => {
        cachedCollections = data;
        if (mountedRef.current) {
          setCollections(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mountedRef.current) {
          setError(
            err instanceof Error ? err.message : 'Failed to load collections'
          );
          setLoading(false);
        }
      });
  }, []);

  const refresh = useCallback(() => {
    cachedCollections = null;
    cachePromise = null;
    setLoading(true);
    setError(null);

    fetchCollections()
      .then((data) => {
        cachedCollections = data;
        if (mountedRef.current) {
          setCollections(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mountedRef.current) {
          setError(
            err instanceof Error ? err.message : 'Failed to load collections'
          );
          setLoading(false);
        }
      });
  }, []);

  return { collections, loading, error, refresh };
}

export function clearCollectionsCache(): void {
  cachedCollections = null;
  cachePromise = null;
}
