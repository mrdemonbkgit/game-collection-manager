import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  startCoverAudit,
  getCoverAuditStatus,
  getCoverAuditResults,
  startBatchCoverFix,
  getBatchFixStatus,
  type CoverAnalysis,
  type AuditProgress,
  type AuditSummary,
  type BatchFixProgress,
  type BatchFixResult,
} from '../services/syncService';
import { fetchGameById } from '../services/gamesService';
import type { Game } from '../types/game';

type ViewMode = 'failed' | 'flagged' | 'all';

interface CoverWithGame extends CoverAnalysis {
  game?: Game;
  loadingGame?: boolean;
}

export default function CoverAuditPage() {
  const [isAuditing, setIsAuditing] = useState(false);
  const [progress, setProgress] = useState<AuditProgress | null>(null);
  const [summary, setSummary] = useState<AuditSummary | null>(null);
  const [covers, setCovers] = useState<CoverWithGame[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('failed');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [skippedIds, setSkippedIds] = useState<Set<number>>(new Set());

  // Selection state
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Batch fix state
  const [isFixing, setIsFixing] = useState(false);
  const [fixProgress, setFixProgress] = useState<BatchFixProgress | null>(null);
  const [fixResult, setFixResult] = useState<BatchFixResult | null>(null);

  // Pagination state
  const [filteredTotal, setFilteredTotal] = useState(0);
  const [loadingMore, setLoadingMore] = useState(false);

  const initialLoadDone = useRef(false);
  const currentViewMode = useRef(viewMode);

  // Load results for a specific view mode
  const loadResults = async (mode: ViewMode) => {
    setLoading(true);
    setError(null);

    try {
      const minScore = mode === 'failed' ? 0 : mode === 'flagged' ? 40 : 0;
      const maxScore = mode === 'failed' ? 39 : mode === 'flagged' ? 69 : 100;

      // Use higher limits for failed/flagged tabs (manageable sizes)
      // Use reasonable limit for 'all' tab
      const limit = mode === 'all' ? 500 : 1000;

      const results = await getCoverAuditResults({
        minScore,
        maxScore,
        limit,
      });

      setSummary(results.summary);
      setFilteredTotal(results.pagination.filteredTotal);

      // Set covers without game info first
      const coversWithGames: CoverWithGame[] = results.results.map((c) => ({
        ...c,
        loadingGame: true,
      }));
      setCovers(coversWithGames);
      setLoading(false);

      // Clear selection when switching views
      setSelectedIds(new Set());

      // Then fetch game info in background (batch of 10)
      const batchSize = 10;
      for (let i = 0; i < coversWithGames.length; i += batchSize) {
        // Check if view mode changed while loading
        if (currentViewMode.current !== mode) break;

        const batch = coversWithGames.slice(i, i + batchSize);
        const games = await Promise.all(
          batch.map(async (cover) => {
            try {
              return await fetchGameById(cover.gameId);
            } catch {
              return undefined;
            }
          })
        );

        // Check again before updating state
        if (currentViewMode.current !== mode) break;

        setCovers((prev) => {
          const updated = [...prev];
          for (let j = 0; j < games.length; j++) {
            const idx = i + j;
            if (idx < updated.length) {
              updated[idx] = { ...updated[idx], game: games[j], loadingGame: false };
            }
          }
          return updated;
        });
      }
    } catch (err) {
      setError('Failed to load audit results. Run an audit first.');
      setLoading(false);
    }
  };

  // Load more results (pagination)
  const loadMore = async () => {
    if (loadingMore || covers.length >= filteredTotal) return;

    setLoadingMore(true);
    try {
      const mode = currentViewMode.current;
      const minScore = mode === 'failed' ? 0 : mode === 'flagged' ? 40 : 0;
      const maxScore = mode === 'failed' ? 39 : mode === 'flagged' ? 69 : 100;
      const limit = 500;
      const offset = covers.length;

      const results = await getCoverAuditResults({
        minScore,
        maxScore,
        limit,
        offset,
      });

      // Append new results
      const newCovers: CoverWithGame[] = results.results.map((c) => ({
        ...c,
        loadingGame: true,
      }));
      setCovers((prev) => [...prev, ...newCovers]);

      // Fetch game info for new covers in background
      const batchSize = 10;
      for (let i = 0; i < newCovers.length; i += batchSize) {
        if (currentViewMode.current !== mode) break;

        const batch = newCovers.slice(i, i + batchSize);
        const games = await Promise.all(
          batch.map(async (cover) => {
            try {
              return await fetchGameById(cover.gameId);
            } catch {
              return undefined;
            }
          })
        );

        if (currentViewMode.current !== mode) break;

        setCovers((prev) => {
          const updated = [...prev];
          for (let j = 0; j < games.length; j++) {
            const idx = offset + i + j;
            if (idx < updated.length) {
              updated[idx] = { ...updated[idx], game: games[j], loadingGame: false };
            }
          }
          return updated;
        });
      }
    } catch (err) {
      console.error('Failed to load more results:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // Check initial audit status on mount
  useEffect(() => {
    const checkStatus = async () => {
      try {
        const status = await getCoverAuditStatus();
        setIsAuditing(status.inProgress);
        setProgress(status.progress);

        if (!status.inProgress && status.progress?.phase === 'complete') {
          initialLoadDone.current = true;
          loadResults(viewMode);
        } else {
          setLoading(false);
        }
      } catch (err) {
        setError('Failed to check audit status');
        setLoading(false);
      }
    };

    checkStatus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Poll for progress while auditing
  useEffect(() => {
    if (!isAuditing) return;

    const interval = setInterval(async () => {
      try {
        const status = await getCoverAuditStatus();
        setProgress(status.progress);
        if (!status.inProgress) {
          setIsAuditing(false);
          initialLoadDone.current = true;
          loadResults(currentViewMode.current);
        }
      } catch (err) {
        console.error('Failed to get status:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuditing]);

  // Poll for batch fix progress
  useEffect(() => {
    if (!isFixing) return;

    const interval = setInterval(async () => {
      try {
        const status = await getBatchFixStatus();
        setFixProgress(status.progress);
        if (!status.inProgress) {
          setIsFixing(false);
          setFixResult(status.result);
          // Reload results to show updated covers
          if (status.result && status.result.success > 0) {
            loadResults(currentViewMode.current);
          }
        }
      } catch (err) {
        console.error('Failed to get fix status:', err);
      }
    }, 1000);

    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isFixing]);

  // Handle view mode changes
  useEffect(() => {
    currentViewMode.current = viewMode;
    if (initialLoadDone.current) {
      loadResults(viewMode);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewMode]);

  const handleStartAudit = async () => {
    setError(null);
    setIsAuditing(true);
    try {
      await startCoverAudit();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start audit');
      setIsAuditing(false);
    }
  };

  const handleToggleSelect = (gameId: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    const visibleIds = visibleCovers.filter((c) => c.game).map((c) => c.gameId);
    if (selectedIds.size === visibleIds.length) {
      // All selected, deselect all
      setSelectedIds(new Set());
    } else {
      // Select all visible
      setSelectedIds(new Set(visibleIds));
    }
  };

  const handleFixSelected = async () => {
    const gamesToFix = visibleCovers
      .filter((c) => selectedIds.has(c.gameId) && c.game)
      .map((c) => ({ gameId: c.gameId, title: c.game!.title }));

    if (gamesToFix.length === 0) {
      setError('No valid games selected for fixing');
      return;
    }

    setError(null);
    setFixResult(null);
    setIsFixing(true);

    try {
      await startBatchCoverFix(gamesToFix);
      // Clear selection after starting fix
      setSelectedIds(new Set());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start batch fix');
      setIsFixing(false);
    }
  };

  const handleSkip = (gameId: number) => {
    setSkippedIds((prev) => new Set(prev).add(gameId));
    // Also remove from selection
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(gameId);
      return next;
    });
  };

  const getIssueLabel = (issue: string) => {
    switch (issue) {
      case 'pillarbox_fill':
        return 'Pillarbox Fill';
      case 'low_entropy_edges':
        return 'Low Detail Edges';
      case 'horizontal_boundary':
        return 'Visible Boundary';
      case 'corrupt':
        return 'Corrupt Image';
      default:
        return issue;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-green-400';
    if (score >= 40) return 'text-yellow-400';
    return 'text-red-400';
  };

  const visibleCovers = covers.filter((c) => !skippedIds.has(c.gameId));
  const selectedCount = selectedIds.size;
  const allVisibleSelected =
    visibleCovers.filter((c) => c.game).length > 0 &&
    visibleCovers.filter((c) => c.game).every((c) => selectedIds.has(c.gameId));

  return (
    <div className="min-h-screen bg-steam-bg">
      {/* Header */}
      <div className="bg-steam-bg-dark border-b border-steam-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-steam-text">Cover Audit</h1>
            {summary && (
              <div className="flex gap-3 text-sm">
                <span className="text-green-400">{summary.passed} passed</span>
                <span className="text-yellow-400">{summary.flagged} flagged</span>
                <span className="text-red-400">{summary.failed} failed</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            {/* Selection counter and fix button */}
            {selectedCount > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-steam-accent font-medium">
                  {selectedCount} selected
                </span>
                <button
                  onClick={handleFixSelected}
                  disabled={isFixing}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isFixing ? 'Fixing...' : 'Fix Selected'}
                </button>
              </div>
            )}
            <Link
              to="/admin/covers/history"
              className="text-steam-text-muted hover:text-steam-text transition-colors"
            >
              Fix History
            </Link>
            <Link
              to="/admin"
              className="text-steam-text-muted hover:text-steam-text transition-colors"
            >
              Admin
            </Link>
            <Link
              to="/"
              className="text-steam-text-muted hover:text-steam-text transition-colors"
            >
              Library
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Controls */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('failed')}
              className={`px-4 py-2 rounded transition-colors ${
                viewMode === 'failed'
                  ? 'bg-red-600 text-white'
                  : 'bg-steam-bg-card text-steam-text-muted hover:bg-steam-border'
              }`}
            >
              Failed ({summary?.failed || 0})
            </button>
            <button
              onClick={() => setViewMode('flagged')}
              className={`px-4 py-2 rounded transition-colors ${
                viewMode === 'flagged'
                  ? 'bg-yellow-600 text-white'
                  : 'bg-steam-bg-card text-steam-text-muted hover:bg-steam-border'
              }`}
            >
              Flagged ({summary?.flagged || 0})
            </button>
            <button
              onClick={() => setViewMode('all')}
              className={`px-4 py-2 rounded transition-colors ${
                viewMode === 'all'
                  ? 'bg-steam-accent text-white'
                  : 'bg-steam-bg-card text-steam-text-muted hover:bg-steam-border'
              }`}
            >
              All ({summary?.total || 0})
            </button>
          </div>

          <div className="flex items-center gap-2">
            {visibleCovers.length > 0 && (
              <button
                onClick={handleSelectAll}
                className="px-3 py-2 bg-steam-bg-card text-steam-text-muted rounded hover:bg-steam-border transition-colors"
              >
                {allVisibleSelected ? 'Deselect All' : 'Select All'}
              </button>
            )}
            <button
              onClick={handleStartAudit}
              disabled={isAuditing}
              className="px-4 py-2 bg-steam-accent text-white rounded hover:bg-steam-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isAuditing ? 'Auditing...' : 'Run Audit'}
            </button>
          </div>
        </div>

        {/* Progress - Audit */}
        {isAuditing && progress && (
          <div className="bg-steam-bg-card rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-steam-text">
                Analyzing covers... {progress.completed}/{progress.total}
              </span>
              <span className="text-steam-text-muted">
                ~{Math.ceil(progress.estimatedSecondsRemaining)}s remaining
              </span>
            </div>
            <div className="w-full bg-steam-bg rounded-full h-2">
              <div
                className="bg-steam-accent h-2 rounded-full transition-all"
                style={{
                  width: `${(progress.completed / progress.total) * 100}%`,
                }}
              />
            </div>
            <div className="flex gap-4 mt-2 text-sm">
              <span className="text-green-400">Passed: {progress.passed}</span>
              <span className="text-yellow-400">Flagged: {progress.flagged}</span>
              <span className="text-red-400">Failed: {progress.failed}</span>
            </div>
          </div>
        )}

        {/* Progress - Batch Fix */}
        {isFixing && fixProgress && (
          <div className="bg-green-900/30 border border-green-700 rounded-lg p-6 mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-green-400">
                Fixing covers... {fixProgress.completed}/{fixProgress.total}
              </span>
              <span className="text-green-300 text-sm">
                {fixProgress.current}
              </span>
            </div>
            <div className="w-full bg-steam-bg rounded-full h-2">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{
                  width: `${(fixProgress.completed / fixProgress.total) * 100}%`,
                }}
              />
            </div>
          </div>
        )}

        {/* Fix Result */}
        {fixResult && !isFixing && (
          <div className={`${fixResult.failed > 0 ? 'bg-yellow-900/30 border-yellow-700' : 'bg-green-900/30 border-green-700'} border rounded-lg p-4 mb-6`}>
            <div className="flex items-center justify-between">
              <span className={fixResult.failed > 0 ? 'text-yellow-400' : 'text-green-400'}>
                Fix complete: {fixResult.success} success, {fixResult.failed} failed
              </span>
              <button
                onClick={() => setFixResult(null)}
                className={`${fixResult.failed > 0 ? 'text-yellow-400 hover:text-yellow-300' : 'text-green-400 hover:text-green-300'}`}
              >
                Dismiss
              </button>
            </div>
            {fixResult.failed > 0 && (
              <div className="mt-3 pt-3 border-t border-yellow-700/50">
                <p className="text-yellow-400 text-sm mb-2">Failed fixes:</p>
                <ul className="space-y-1 max-h-40 overflow-y-auto">
                  {fixResult.results
                    .filter((r) => !r.success)
                    .map((r) => (
                      <li key={r.gameId} className="text-sm text-yellow-300/80">
                        <span className="text-yellow-400">#{r.gameId}</span>: {r.error || 'Unknown error'}
                      </li>
                    ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && !isAuditing && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-steam-accent border-t-transparent rounded-full" />
          </div>
        )}

        {/* Results Grid */}
        {!loading && visibleCovers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {visibleCovers.map((cover) => {
              const isSelected = selectedIds.has(cover.gameId);
              return (
                <div
                  key={cover.gameId}
                  className={`bg-steam-bg-card rounded-lg overflow-hidden relative ${
                    isSelected ? 'ring-2 ring-steam-accent' : ''
                  }`}
                >
                  {/* Checkbox */}
                  <div className="absolute top-2 left-2 z-10">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => handleToggleSelect(cover.gameId)}
                      disabled={!cover.game}
                      className="w-5 h-5 rounded bg-steam-bg border-steam-border text-steam-accent focus:ring-steam-accent focus:ring-offset-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>

                  {/* Cover Image */}
                  <div
                    className="relative aspect-[2/3] bg-steam-bg cursor-pointer"
                    onClick={() => cover.game && handleToggleSelect(cover.gameId)}
                  >
                    <img
                      src={`/covers/${cover.gameId}.${cover.filePath.split('.').pop()}`}
                      alt={cover.game?.title || `Game ${cover.gameId}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    {/* Score Badge */}
                    <div
                      className={`absolute top-2 right-2 px-2 py-1 rounded text-sm font-bold ${getScoreColor(
                        cover.score
                      )} bg-black/70`}
                    >
                      {cover.score}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <h3 className="text-steam-text font-medium truncate mb-1">
                      {cover.loadingGame ? (
                        <span className="text-steam-text-muted">Loading...</span>
                      ) : (
                        cover.game?.title || `Game #${cover.gameId}`
                      )}
                    </h3>

                    {/* Issues */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {cover.issues.map((issue) => (
                        <span
                          key={issue}
                          className="text-xs px-2 py-0.5 rounded bg-red-900/50 text-red-300"
                        >
                          {getIssueLabel(issue)}
                        </span>
                      ))}
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleSkip(cover.gameId)}
                        className="flex-1 px-3 py-1.5 bg-steam-bg text-steam-text-muted text-sm rounded hover:bg-steam-border transition-colors"
                      >
                        Skip
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Load More / Pagination Info */}
        {!loading && visibleCovers.length > 0 && (
          <div className="mt-6 flex flex-col items-center gap-4">
            <p className="text-steam-text-muted">
              Showing {visibleCovers.length} of {filteredTotal} covers
            </p>
            {covers.length < filteredTotal && (
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="px-6 py-3 bg-steam-bg-card text-steam-text rounded-lg hover:bg-steam-border transition-colors disabled:opacity-50"
              >
                {loadingMore ? 'Loading...' : `Load More (${filteredTotal - covers.length} remaining)`}
              </button>
            )}
          </div>
        )}

        {/* Empty State */}
        {!loading && !isAuditing && visibleCovers.length === 0 && (
          <div className="text-center py-12">
            <p className="text-steam-text-muted mb-4">
              {summary
                ? `No covers in "${viewMode}" category`
                : 'No audit results found. Run an audit to analyze cover quality.'}
            </p>
            {!summary && (
              <button
                onClick={handleStartAudit}
                className="px-6 py-3 bg-steam-accent text-white rounded-lg hover:bg-steam-accent/80 transition-colors"
              >
                Run Cover Audit
              </button>
            )}
          </div>
        )}

        {/* Skipped Count */}
        {skippedIds.size > 0 && (
          <div className="fixed bottom-4 right-4 bg-steam-bg-card px-4 py-2 rounded-lg shadow-lg">
            <span className="text-steam-text-muted">
              Skipped: {skippedIds.size} covers
            </span>
            <button
              onClick={() => setSkippedIds(new Set())}
              className="ml-3 text-steam-accent hover:underline"
            >
              Show all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
