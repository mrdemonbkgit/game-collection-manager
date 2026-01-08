import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  getCoverFixHistory,
  type CoverFixHistoryItem,
} from '../services/syncService';

function formatTimeAgo(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export default function CoverFixHistoryPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<CoverFixHistoryItem[]>([]);
  const [totalGames, setTotalGames] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const data = await getCoverFixHistory();
        setItems(data.items);
        setTotalGames(data.totalGames);
        setTotalAttempts(data.totalAttempts);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load history');
      } finally {
        setLoading(false);
      }
    };

    fetchHistory();
  }, []);

  return (
    <div className="min-h-screen bg-steam-bg">
      {/* Header */}
      <div className="bg-steam-bg-dark border-b border-steam-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-steam-text">Cover Fix History</h1>
            {!loading && (
              <div className="flex gap-3 text-sm">
                <span className="text-steam-accent">{totalGames} games</span>
                <span className="text-steam-text-muted">{totalAttempts} total attempts</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Link
              to="/admin/covers"
              className="text-steam-text-muted hover:text-steam-text transition-colors"
            >
              Cover Audit
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
        {/* Error */}
        {error && (
          <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin h-8 w-8 border-2 border-steam-accent border-t-transparent rounded-full" />
          </div>
        )}

        {/* Empty State */}
        {!loading && items.length === 0 && (
          <div className="text-center py-12">
            <p className="text-steam-text-muted">No cover fix history yet.</p>
            <p className="text-steam-text-muted text-sm mt-2">
              Fix covers from the Cover Audit page to see history here.
            </p>
          </div>
        )}

        {/* Results Grid */}
        {!loading && items.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {items.map((item) => (
              <Link
                key={item.gameId}
                to={item.slug ? `/game/${item.slug}` : '#'}
                className="bg-steam-bg-card rounded-lg overflow-hidden hover:ring-2 hover:ring-steam-accent transition-all"
              >
                {/* Cover Image */}
                <div className="relative aspect-[2/3] bg-steam-bg">
                  <img
                    src={`/covers/${item.gameId}.jpg`}
                    alt={item.title}
                    className="w-full h-full object-cover"
                    loading="lazy"
                    onError={(e) => {
                      // Try png if jpg fails
                      const target = e.target as HTMLImageElement;
                      if (target.src.endsWith('.jpg')) {
                        target.src = `/covers/${item.gameId}.png`;
                      }
                    }}
                  />
                  {/* Attempt count badge */}
                  <div className="absolute top-2 right-2 px-2 py-1 rounded text-sm font-bold bg-black/70 text-steam-accent">
                    {item.attemptCount} {item.attemptCount === 1 ? 'try' : 'tries'}
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <h3 className="text-steam-text font-medium truncate text-sm">
                    {item.title}
                  </h3>
                  <p className="text-steam-text-muted text-xs mt-1">
                    {formatTimeAgo(item.lastTryTime)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
