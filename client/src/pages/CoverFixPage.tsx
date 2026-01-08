import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  fixCoverFromSteamGridDB,
  getCoverFixHistory,
  type CoverFixHistoryItem,
} from '../services/syncService';
import { fetchApi } from '../services/api';

interface Game {
  id: number;
  title: string;
  slug: string;
  cover_image_url: string | null;
}

interface GamesResponse {
  items: Game[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

const PAGE_SIZE = 100;

export default function CoverFixPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [fixHistory, setFixHistory] = useState<Map<number, CoverFixHistoryItem>>(new Map());
  const [fixingId, setFixingId] = useState<number | null>(null);
  const [fixResult, setFixResult] = useState<{ gameId: number; success: boolean; message: string } | null>(null);
  const [coverTimestamps, setCoverTimestamps] = useState<Map<number, number>>(new Map());

  const fetchGames = useCallback(async (page: number) => {
    setLoading(true);
    setError(null);
    try {
      const offset = (page - 1) * PAGE_SIZE;
      const response = await fetchApi<{ success: boolean; data: GamesResponse }>(
        `/games?limit=${PAGE_SIZE}&offset=${offset}&sortBy=title&sortOrder=asc`
      );
      setGames(response.data.items);
      setTotal(response.data.total);
      setTotalPages(response.data.totalPages);
      setCurrentPage(page);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load games');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const data = await getCoverFixHistory();
      const historyMap = new Map<number, CoverFixHistoryItem>();
      for (const item of data.items) {
        historyMap.set(item.gameId, item);
      }
      setFixHistory(historyMap);
    } catch (err) {
      console.error('Failed to load fix history:', err);
    }
  }, []);

  useEffect(() => {
    fetchGames(1);
    fetchHistory();
  }, [fetchGames, fetchHistory]);

  const handleFix = async (gameId: number, title: string) => {
    setFixingId(gameId);
    setFixResult(null);
    try {
      const result = await fixCoverFromSteamGridDB(gameId, title);
      setFixResult({
        gameId,
        success: result.success,
        message: result.success ? 'Cover updated!' : (result.error || 'Failed'),
      });
      // Update timestamp to refresh cover image
      setCoverTimestamps(prev => new Map(prev).set(gameId, Date.now()));
      // Refresh history
      await fetchHistory();
    } catch (err) {
      setFixResult({
        gameId,
        success: false,
        message: err instanceof Error ? err.message : 'Failed to fix cover',
      });
    } finally {
      setFixingId(null);
    }
  };

  const goToPage = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      fetchGames(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const getCoverUrl = (game: Game) => {
    const timestamp = coverTimestamps.get(game.id);
    const cacheBuster = timestamp ? `?t=${timestamp}` : '';
    // Try local cover first (jpg then png)
    return `/covers/${game.id}.jpg${cacheBuster}`;
  };

  return (
    <div className="min-h-screen bg-steam-bg">
      {/* Header */}
      <div className="bg-steam-bg-dark border-b border-steam-border sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold text-steam-text">Cover Fix</h1>
            {!loading && (
              <div className="flex gap-3 text-sm">
                <span className="text-steam-accent">{total} games</span>
                <span className="text-steam-text-muted">
                  Page {currentPage} of {totalPages}
                </span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-4">
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

        {/* Pagination - Top */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mb-6">
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-steam-bg-card text-steam-text rounded hover:bg-steam-bg-card/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-steam-bg-card text-steam-text rounded hover:bg-steam-bg-card/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="px-4 py-1.5 text-steam-text">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-steam-bg-card text-steam-text rounded hover:bg-steam-bg-card/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-steam-bg-card text-steam-text rounded hover:bg-steam-bg-card/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        )}

        {/* Games Grid */}
        {!loading && games.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {games.map((game) => {
              const isFixing = fixingId === game.id;
              const result = fixResult?.gameId === game.id ? fixResult : null;
              const history = fixHistory.get(game.id);

              return (
                <div
                  key={game.id}
                  className="bg-steam-bg-card rounded-lg overflow-hidden"
                >
                  {/* Cover Image */}
                  <Link
                    to={`/game/${game.slug}`}
                    className="block relative aspect-[2/3] bg-steam-bg hover:opacity-90 transition-opacity"
                  >
                    <img
                      src={getCoverUrl(game)}
                      alt={game.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        // Try png if jpg fails
                        if (target.src.includes('.jpg')) {
                          const timestamp = coverTimestamps.get(game.id);
                          const cacheBuster = timestamp ? `?t=${timestamp}` : '';
                          target.src = `/covers/${game.id}.png${cacheBuster}`;
                        } else if (!target.src.includes('placeholder')) {
                          // Fallback to remote cover or placeholder
                          target.src = game.cover_image_url || '/placeholder-cover.png';
                        }
                      }}
                    />
                    {/* Attempt count badge */}
                    {history && history.attemptCount > 0 && (
                      <div className="absolute top-2 right-2 px-2 py-1 rounded text-xs font-bold bg-black/70 text-steam-accent">
                        {history.attemptCount} {history.attemptCount === 1 ? 'fix' : 'fixes'}
                      </div>
                    )}
                  </Link>

                  {/* Info */}
                  <div className="p-3">
                    <h3 className="text-steam-text font-medium truncate text-sm" title={game.title}>
                      {game.title}
                    </h3>

                    {/* Fix Result */}
                    {result && (
                      <p className={`text-xs mt-1 ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                        {result.message}
                      </p>
                    )}

                    {/* Fix Button */}
                    <button
                      onClick={() => handleFix(game.id, game.title)}
                      disabled={isFixing}
                      className="mt-2 w-full px-3 py-1.5 bg-steam-accent text-white text-sm rounded hover:bg-steam-accent/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {isFixing ? 'Fixing...' : 'Fix Cover'}
                    </button>

                    {/* Tried URLs */}
                    {history && history.triedUrls.length > 0 && (
                      <details className="mt-2" open>
                        <summary className="text-steam-accent text-xs cursor-pointer hover:underline">
                          {history.triedUrls.length} URL{history.triedUrls.length > 1 ? 's' : ''} tried
                        </summary>
                        <ul className="mt-1 space-y-1">
                          {history.triedUrls.map((url, i) => (
                            <li key={i}>
                              <a
                                href={url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs text-steam-text-muted hover:text-steam-accent truncate block"
                              >
                                {url.split('/').pop()}
                              </a>
                            </li>
                          ))}
                        </ul>
                      </details>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Pagination - Bottom */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 mt-6">
            <button
              onClick={() => goToPage(1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-steam-bg-card text-steam-text rounded hover:bg-steam-bg-card/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              First
            </button>
            <button
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage === 1}
              className="px-3 py-1.5 bg-steam-bg-card text-steam-text rounded hover:bg-steam-bg-card/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Prev
            </button>
            <span className="px-4 py-1.5 text-steam-text">
              {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-steam-bg-card text-steam-text rounded hover:bg-steam-bg-card/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
            <button
              onClick={() => goToPage(totalPages)}
              disabled={currentPage === totalPages}
              className="px-3 py-1.5 bg-steam-bg-card text-steam-text rounded hover:bg-steam-bg-card/80 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Last
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
