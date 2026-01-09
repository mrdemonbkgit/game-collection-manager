import { useState, useEffect, useCallback } from 'react';
import { fetchApi } from '../services/api';

// Sync operation status from a single operation
export interface SyncOperationStatus {
  inProgress: boolean;
  progress: {
    total: number;
    completed: number;
    currentGame?: string;
  } | null;
  result: {
    total?: number;
    imported?: number;
    updated?: number;
    failed?: number;
    skipped?: number;
    downloaded?: number;
    [key: string]: unknown;
  } | null;
  elapsedSeconds: number;
}

// Steam sync status (extended)
export interface SteamSyncStatus extends SyncOperationStatus {
  isQuick?: boolean;
  error?: string | null;
}

// All sync operations status
export interface AllSyncStatus {
  steam: SteamSyncStatus;
  genres: SyncOperationStatus;
  ratings: SyncOperationStatus;
  covers: SyncOperationStatus;
  coverCache: SyncOperationStatus;
  assets: SyncOperationStatus;
  igdb: SyncOperationStatus;
  steamgrid: SyncOperationStatus;
  screenshots: SyncOperationStatus;
}

// API key configuration
export interface SyncConfig {
  hasSteamKey: boolean;
  hasSteamUserId: boolean;
  hasSteamGridDBKey: boolean;
  hasIGDBKeys: boolean;
}

// Database asset stats
export interface CategoryStats {
  total: number;
  percentage: number;
  [key: string]: number;
}

export interface DbStats {
  totalGames: number;
  library: CategoryStats & { withSteamMetadata: number; withoutSteamMetadata: number };
  genres: CategoryStats & { withGenres: number; withoutGenres: number };
  ratings: CategoryStats & { withRatings: number; withoutRatings: number };
  covers: CategoryStats & { withCovers: number; withoutCovers: number; cached: number; cachedPercentage: number };
  igdb: CategoryStats & { withIGDB: number; withoutIGDB: number };
  steamgrid: CategoryStats & { enriched: number; notEnriched: number };
  assets: { heroes: number; logos: number; icons: number; heroPercentage: number; logoPercentage: number };
  screenshots: { gamesWithScreenshots: number; totalScreenshots: number; percentage: number };
}

// Hook return type
export interface UseSyncStatusReturn {
  status: AllSyncStatus | null;
  config: SyncConfig | null;
  dbStats: DbStats | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  isAnyInProgress: boolean;
}

const DEFAULT_STATUS: SyncOperationStatus = {
  inProgress: false,
  progress: null,
  result: null,
  elapsedSeconds: 0,
};

const INITIAL_STATUS: AllSyncStatus = {
  steam: { ...DEFAULT_STATUS, isQuick: false, error: null },
  genres: DEFAULT_STATUS,
  ratings: DEFAULT_STATUS,
  covers: DEFAULT_STATUS,
  coverCache: DEFAULT_STATUS,
  assets: DEFAULT_STATUS,
  igdb: DEFAULT_STATUS,
  steamgrid: DEFAULT_STATUS,
  screenshots: DEFAULT_STATUS,
};

export function useSyncStatus(pollingInterval = 2000): UseSyncStatusReturn {
  const [status, setStatus] = useState<AllSyncStatus | null>(null);
  const [config, setConfig] = useState<SyncConfig | null>(null);
  const [dbStats, setDbStats] = useState<DbStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const [statusRes, configRes, dbStatsRes] = await Promise.all([
        fetchApi<{ success: boolean; data: AllSyncStatus }>('/sync/all-status'),
        fetchApi<{ success: boolean; data: SyncConfig }>('/sync/config'),
        fetchApi<{ success: boolean; data: DbStats }>('/sync/db-stats'),
      ]);
      setStatus(statusRes.data);
      setConfig(configRes.data);
      setDbStats(dbStatsRes.data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch sync status');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Check if any operation is in progress
  const isAnyInProgress = status
    ? Object.values(status).some((op) => op.inProgress)
    : false;

  // Polling when any operation is in progress
  useEffect(() => {
    if (!isAnyInProgress) return;

    const interval = setInterval(fetchStatus, pollingInterval);
    return () => clearInterval(interval);
  }, [isAnyInProgress, pollingInterval, fetchStatus]);

  return {
    status: status || INITIAL_STATUS,
    config,
    dbStats,
    loading,
    error,
    refresh: fetchStatus,
    isAnyInProgress,
  };
}

// Sync operation trigger functions
export async function triggerSteamQuickSync(): Promise<void> {
  await fetchApi('/sync/steam/quick', { method: 'POST' });
}

export async function triggerSteamFullSync(): Promise<void> {
  await fetchApi('/sync/steam', { method: 'POST' });
}

export async function triggerGenreSync(): Promise<void> {
  await fetchApi('/sync/genres', { method: 'POST' });
}

export async function triggerRatingSync(): Promise<void> {
  await fetchApi('/sync/ratings', { method: 'POST' });
}

export async function triggerCoverSync(): Promise<void> {
  await fetchApi('/sync/covers', { method: 'POST' });
}

export async function triggerCoverCacheSync(): Promise<void> {
  await fetchApi('/sync/covers/cache', { method: 'POST' });
}

export async function triggerAssetSync(): Promise<void> {
  await fetchApi('/sync/assets', { method: 'POST' });
}

export async function triggerIGDBSync(): Promise<void> {
  await fetchApi('/sync/igdb', { method: 'POST' });
}

export async function triggerSteamGridDBSync(): Promise<void> {
  await fetchApi('/sync/steamgrid/enrich', { method: 'POST' });
}

export async function triggerScreenshotSync(): Promise<void> {
  await fetchApi('/sync/screenshots', { method: 'POST' });
}

export async function abortSync(operation: string): Promise<void> {
  await fetchApi(`/sync/abort/${operation}`, { method: 'POST' });
}
