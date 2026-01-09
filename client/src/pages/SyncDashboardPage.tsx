import { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  useSyncStatus,
  triggerSteamQuickSync,
  triggerSteamFullSync,
  triggerGenreSync,
  triggerRatingSync,
  triggerCoverSync,
  triggerCoverCacheSync,
  triggerAssetSync,
  triggerIGDBSync,
  triggerSteamGridDBSync,
  triggerScreenshotSync,
  abortSync,
  type SyncConfig,
  type AllSyncStatus,
} from '../hooks/useSyncStatus';
import { fetchApi } from '../services/api';
import SyncStatusCard, {
  type SyncOperationConfig,
} from '../components/sync/SyncStatusCard';

// Helper to wait for a specific sync operation to complete
async function waitForSyncCompletion(
  operationId: string,
  pollInterval = 2000,
  maxWaitMs = 10 * 60 * 60 * 1000 // 10 hours max
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    await new Promise(resolve => setTimeout(resolve, pollInterval));

    try {
      const res = await fetchApi<{ success: boolean; data: AllSyncStatus }>('/sync/all-status');
      const opStatus = res.data[operationId as keyof AllSyncStatus];

      if (!opStatus?.inProgress) {
        return; // Sync completed
      }
    } catch {
      // Continue polling even on error
    }
  }

  throw new Error(`Timeout waiting for ${operationId} to complete`);
}

// Sync operation definitions
const SYNC_OPERATIONS: SyncOperationConfig[] = [
  {
    id: 'steam',
    name: 'Steam Library',
    description: 'Full metadata sync from Steam',
    requiredKeys: ['steam'],
  },
  {
    id: 'genres',
    name: 'Genres & Tags',
    description: 'SteamSpy genres and tags',
    requiredKeys: ['steam'],
  },
  {
    id: 'ratings',
    name: 'Steam Ratings',
    description: 'User review percentages',
    requiredKeys: ['steam'],
  },
  {
    id: 'covers',
    name: 'Cover URLs',
    description: 'Fetch missing cover URLs from Steam',
    requiredKeys: ['steam'],
  },
  {
    id: 'coverCache',
    name: 'Cover Cache',
    description: 'Download covers to local disk',
  },
  {
    id: 'assets',
    name: 'Heroes & Logos',
    description: 'Predownload hero images and logos',
    requiredKeys: ['steamgrid'],
  },
  {
    id: 'igdb',
    name: 'IGDB Metadata',
    description: 'Universal game metadata from IGDB',
    requiredKeys: ['igdb'],
  },
  {
    id: 'steamgrid',
    name: 'SteamGridDB',
    description: 'Icons, asset counts, and enrichment',
    requiredKeys: ['steamgrid'],
  },
  {
    id: 'screenshots',
    name: 'Screenshots',
    description: 'Download screenshots locally',
  },
];

// Trigger functions map
const TRIGGER_FUNCTIONS: Record<string, () => Promise<void>> = {
  steam: triggerSteamFullSync,
  genres: triggerGenreSync,
  ratings: triggerRatingSync,
  covers: triggerCoverSync,
  coverCache: triggerCoverCacheSync,
  assets: triggerAssetSync,
  igdb: triggerIGDBSync,
  steamgrid: triggerSteamGridDBSync,
  screenshots: triggerScreenshotSync,
};

// Check if operation has required keys
function hasRequiredKeys(
  operation: SyncOperationConfig,
  config: SyncConfig | null
): { ok: boolean; reason?: string } {
  if (!config) return { ok: false, reason: 'Loading config...' };
  if (!operation.requiredKeys) return { ok: true };

  const missing: string[] = [];
  for (const key of operation.requiredKeys) {
    if (key === 'steam' && (!config.hasSteamKey || !config.hasSteamUserId)) {
      missing.push('Steam API key');
    }
    if (key === 'steamgrid' && !config.hasSteamGridDBKey) {
      missing.push('SteamGridDB API key');
    }
    if (key === 'igdb' && !config.hasIGDBKeys) {
      missing.push('IGDB API keys');
    }
  }

  if (missing.length > 0) {
    return { ok: false, reason: `Missing: ${missing.join(', ')}` };
  }
  return { ok: true };
}

export default function SyncDashboardPage() {
  const { status, config, dbStats, loading, error, refresh, isAnyInProgress } =
    useSyncStatus();
  const [actionError, setActionError] = useState<string | null>(null);
  const [initialSyncRunning, setInitialSyncRunning] = useState(false);
  const [includeScreenshots, setIncludeScreenshots] = useState(false);

  // Handle starting a sync operation
  const handleStart = useCallback(
    async (operationId: string) => {
      setActionError(null);
      try {
        const trigger = TRIGGER_FUNCTIONS[operationId];
        if (trigger) {
          await trigger();
          // Wait a moment then refresh status
          setTimeout(refresh, 500);
        }
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : 'Failed to start sync'
        );
      }
    },
    [refresh]
  );

  // Handle stopping a sync operation
  const handleStop = useCallback(
    async (operationId: string) => {
      setActionError(null);
      try {
        await abortSync(operationId);
        setTimeout(refresh, 500);
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : 'Failed to stop sync'
        );
      }
    },
    [refresh]
  );

  // Current step for initial sync progress display
  const [currentSyncStep, setCurrentSyncStep] = useState<string | null>(null);

  // Initial Sync - runs all syncs in order, waiting for each to complete
  const handleInitialSync = useCallback(async () => {
    setInitialSyncRunning(true);
    setActionError(null);
    setCurrentSyncStep(null);

    // Order with statusKey for polling
    const order: Array<{
      fn: () => Promise<void>;
      name: string;
      statusKey: keyof AllSyncStatus;
      needsSteamGrid?: boolean;
      needsIGDB?: boolean;
    }> = [
      { fn: triggerSteamQuickSync, name: 'Steam Quick Sync', statusKey: 'steam' },
      { fn: triggerSteamFullSync, name: 'Steam Full Sync', statusKey: 'steam' },
      { fn: triggerCoverSync, name: 'Cover URLs', statusKey: 'covers' },
      { fn: triggerCoverCacheSync, name: 'Cover Cache', statusKey: 'coverCache' },
      { fn: triggerAssetSync, name: 'Heroes & Logos', statusKey: 'assets', needsSteamGrid: true },
      { fn: triggerRatingSync, name: 'Ratings', statusKey: 'ratings' },
      { fn: triggerGenreSync, name: 'Genres', statusKey: 'genres' },
      { fn: triggerIGDBSync, name: 'IGDB', statusKey: 'igdb', needsIGDB: true },
      { fn: triggerSteamGridDBSync, name: 'SteamGridDB', statusKey: 'steamgrid', needsSteamGrid: true },
    ];

    if (includeScreenshots) {
      order.push({ fn: triggerScreenshotSync, name: 'Screenshots', statusKey: 'screenshots' });
    }

    try {
      for (const step of order) {
        // Skip if missing required keys
        if (step.needsSteamGrid && config && !config.hasSteamGridDBKey) continue;
        if (step.needsIGDB && config && !config.hasIGDBKeys) continue;

        console.log(`[Initial Sync] Starting: ${step.name}`);
        setCurrentSyncStep(step.name);

        // Trigger the sync (returns immediately for background jobs)
        await step.fn();

        // Wait for the sync to complete by polling
        await waitForSyncCompletion(step.statusKey);

        console.log(`[Initial Sync] Completed: ${step.name}`);
        refresh();

        // Brief pause between operations
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      setCurrentSyncStep(null);
      console.log('[Initial Sync] All syncs completed');
    } catch (err) {
      setActionError(
        `Initial sync failed: ${err instanceof Error ? err.message : 'Unknown error'}`
      );
    } finally {
      setInitialSyncRunning(false);
      setCurrentSyncStep(null);
    }
  }, [config, includeScreenshots, refresh]);

  // Incremental Sync - just quick sync + missing data
  const handleIncrementalSync = useCallback(async () => {
    setActionError(null);
    try {
      await triggerSteamQuickSync();
      setTimeout(refresh, 500);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to start sync'
      );
    }
  }, [refresh]);

  if (loading && !status) {
    return (
      <div className="min-h-screen bg-steam-bg flex items-center justify-center">
        <div className="text-steam-text-muted">Loading sync status...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-steam-bg">
      {/* Header */}
      <div className="bg-steam-bg-dark border-b border-steam-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-steam-text">Sync Dashboard</h1>
          <Link
            to="/"
            className="text-steam-text-muted hover:text-steam-text transition-colors"
          >
            Back to Library
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Error Display */}
        {(error || actionError) && (
          <div className="mb-6 bg-red-900/30 border border-red-700 rounded-lg p-4">
            <p className="text-red-400">{error || actionError}</p>
          </div>
        )}

        {/* API Key Status Banner */}
        {config && (
          <div className="mb-6 bg-steam-bg-card rounded-lg p-4">
            <h2 className="text-sm font-medium text-steam-text-muted mb-2">
              API Keys Status
            </h2>
            <div className="flex flex-wrap gap-4">
              <KeyStatus
                label="Steam"
                active={config.hasSteamKey && config.hasSteamUserId}
              />
              <KeyStatus label="SteamGridDB" active={config.hasSteamGridDBKey} />
              <KeyStatus label="IGDB" active={config.hasIGDBKeys} />
            </div>
          </div>
        )}

        {/* Database Status */}
        {dbStats && (
          <div className="mb-8 bg-steam-bg-card rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-steam-text">
                Database Status
              </h2>
              <span className="text-2xl font-bold text-steam-accent">
                {dbStats.totalGames.toLocaleString()} games
              </span>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-4">
              <StatCard
                label="Steam Metadata"
                value={dbStats.library.withSteamMetadata}
                total={dbStats.library.total}
                percentage={dbStats.library.percentage}
              />
              <StatCard
                label="Genres"
                value={dbStats.genres.withGenres}
                total={dbStats.genres.total}
                percentage={dbStats.genres.percentage}
              />
              <StatCard
                label="Ratings"
                value={dbStats.ratings.withRatings}
                total={dbStats.ratings.total}
                percentage={dbStats.ratings.percentage}
              />
              <StatCard
                label="Cover URLs"
                value={dbStats.covers.withCovers}
                total={dbStats.covers.total}
                percentage={dbStats.covers.percentage}
              />
              <StatCard
                label="Covers Cached"
                value={dbStats.covers.cached}
                total={dbStats.covers.total}
                percentage={dbStats.covers.cachedPercentage}
              />
              <StatCard
                label="IGDB Data"
                value={dbStats.igdb.withIGDB}
                total={dbStats.igdb.total}
                percentage={dbStats.igdb.percentage}
              />
              <StatCard
                label="SteamGridDB"
                value={dbStats.steamgrid.enriched}
                total={dbStats.steamgrid.total}
                percentage={dbStats.steamgrid.percentage}
              />
              <StatCard
                label="Heroes"
                value={dbStats.assets.heroes}
                total={dbStats.totalGames}
                percentage={dbStats.assets.heroPercentage}
              />
              <StatCard
                label="Logos"
                value={dbStats.assets.logos}
                total={dbStats.totalGames}
                percentage={dbStats.assets.logoPercentage}
              />
              <StatCard
                label="Screenshots"
                value={dbStats.screenshots.gamesWithScreenshots}
                total={dbStats.totalGames}
                percentage={dbStats.screenshots.percentage}
                subtitle={`${dbStats.screenshots.totalScreenshots.toLocaleString()} files`}
              />
            </div>
          </div>
        )}

        {/* Main Actions */}
        <div className="mb-8 flex flex-wrap gap-4 items-center">
          <button
            onClick={handleInitialSync}
            disabled={initialSyncRunning || isAnyInProgress}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              initialSyncRunning || isAnyInProgress
                ? 'bg-steam-border text-steam-text-muted cursor-not-allowed'
                : 'bg-steam-accent text-white hover:bg-steam-accent/80'
            }`}
          >
            {initialSyncRunning
              ? currentSyncStep
                ? `Running: ${currentSyncStep}`
                : 'Starting Initial Sync...'
              : 'Initial Sync'}
          </button>
          <button
            onClick={handleIncrementalSync}
            disabled={isAnyInProgress}
            className={`px-6 py-3 rounded-lg font-medium transition-colors ${
              isAnyInProgress
                ? 'bg-steam-border text-steam-text-muted cursor-not-allowed'
                : 'bg-steam-bg-light text-steam-text hover:bg-steam-border'
            }`}
          >
            Incremental Sync
          </button>
          <label className="flex items-center gap-2 text-steam-text-muted">
            <input
              type="checkbox"
              checked={includeScreenshots}
              onChange={(e) => setIncludeScreenshots(e.target.checked)}
              className="w-4 h-4 rounded bg-steam-bg border-steam-border"
            />
            Include Screenshots (large download)
          </label>
        </div>

        {/* Sync Operation Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {status &&
            SYNC_OPERATIONS.map((op) => {
              const opStatus = status[op.id as keyof typeof status];
              const keyCheck = hasRequiredKeys(op, config);
              const isDisabled =
                !keyCheck.ok ||
                (isAnyInProgress &&
                  !opStatus?.inProgress &&
                  !initialSyncRunning);

              return (
                <SyncStatusCard
                  key={op.id}
                  config={op}
                  status={opStatus || { inProgress: false, progress: null, result: null, elapsedSeconds: 0 }}
                  onStart={() => handleStart(op.id)}
                  onStop={() => handleStop(op.id)}
                  disabled={isDisabled}
                  disabledReason={
                    !keyCheck.ok
                      ? keyCheck.reason
                      : isAnyInProgress
                        ? 'Another sync is in progress'
                        : undefined
                  }
                />
              );
            })}
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-steam-bg-card rounded-lg p-6">
          <h2 className="text-lg font-medium text-steam-text mb-3">
            Sync Order (Optimal)
          </h2>
          <div className="grid md:grid-cols-2 gap-6 text-sm">
            <div>
              <h3 className="text-steam-accent font-medium mb-2">
                Initial Sync (First-Time Setup)
              </h3>
              <ol className="list-decimal list-inside text-steam-text-muted space-y-1">
                <li>Steam Quick Sync (library)</li>
                <li>Steam Full Sync (metadata)</li>
                <li>Cover URLs</li>
                <li>Cover Cache</li>
                <li>Heroes & Logos</li>
                <li>Ratings</li>
                <li>Genres</li>
                <li>IGDB Metadata</li>
                <li>SteamGridDB Enrichment</li>
                <li>Screenshots (optional)</li>
              </ol>
            </div>
            <div>
              <h3 className="text-steam-accent font-medium mb-2">
                Incremental Sync (Regular Updates)
              </h3>
              <ul className="text-steam-text-muted space-y-1">
                <li>- Detect new games via Quick Sync</li>
                <li>- Update playtime for existing games</li>
                <li>- Run missing sync operations manually</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Key status indicator
function KeyStatus({ label, active }: { label: string; active: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2 h-2 rounded-full ${active ? 'bg-green-500' : 'bg-red-500'}`}
      />
      <span className={active ? 'text-steam-text' : 'text-steam-text-muted'}>
        {label}
      </span>
    </div>
  );
}

// Database stat card
function StatCard({
  label,
  value,
  total,
  percentage,
  subtitle,
}: {
  label: string;
  value: number;
  total: number;
  percentage: number;
  subtitle?: string;
}) {
  // Color based on percentage
  const getColor = (pct: number) => {
    if (pct >= 90) return 'text-green-400';
    if (pct >= 50) return 'text-yellow-400';
    if (pct > 0) return 'text-orange-400';
    return 'text-steam-text-muted';
  };

  return (
    <div className="bg-steam-bg rounded-lg p-3">
      <div className="text-xs text-steam-text-muted mb-1">{label}</div>
      <div className="flex items-baseline gap-1">
        <span className={`text-lg font-bold ${getColor(percentage)}`}>
          {percentage}%
        </span>
        <span className="text-xs text-steam-text-muted">
          ({value.toLocaleString()}/{total.toLocaleString()})
        </span>
      </div>
      {subtitle && (
        <div className="text-xs text-steam-text-muted mt-1">{subtitle}</div>
      )}
      {/* Mini progress bar */}
      <div className="h-1 bg-steam-bg-dark rounded-full mt-2 overflow-hidden">
        <div
          className={`h-full transition-all ${
            percentage >= 90
              ? 'bg-green-500'
              : percentage >= 50
                ? 'bg-yellow-500'
                : percentage > 0
                  ? 'bg-orange-500'
                  : 'bg-steam-border'
          }`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
