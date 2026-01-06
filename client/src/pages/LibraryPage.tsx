import { useGames } from '../hooks/useGames';
import Header from '../components/Header';
import GameGrid from '../components/GameGrid';
import LoadingSpinner from '../components/LoadingSpinner';

export default function LibraryPage() {
  const { games, total, loading, error, hasMore, loadMore } = useGames({
    sortBy: 'title',
    sortOrder: 'asc',
  });

  // Error state
  if (error && games.length === 0) {
    return (
      <div className="h-full flex flex-col">
        <Header gameCount={0} />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p data-testid="error-message" className="text-red-400 mb-4">Error: {error}</p>
            <button
              data-testid="retry-button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-steam-accent text-white rounded hover:bg-steam-accent/80 transition-colors"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Initial loading state
  if (games.length === 0 && loading) {
    return (
      <div className="h-full flex flex-col">
        <Header gameCount={0} />
        <div className="flex-1 flex items-center justify-center">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  // Empty state (shouldn't happen with 2420 games, but needed for search)
  if (games.length === 0 && !loading) {
    return (
      <div className="h-full flex flex-col">
        <Header gameCount={0} />
        <div className="flex-1 flex items-center justify-center">
          <p data-testid="empty-message" className="text-steam-text-muted">No games found</p>
        </div>
      </div>
    );
  }

  // Main grid view
  return (
    <div className="h-full flex flex-col">
      <Header gameCount={total} />
      <main className="flex-1 py-4 min-h-0">
        <GameGrid
          games={games}
          total={total}
          hasMore={hasMore}
          loading={loading}
          onLoadMore={loadMore}
        />
      </main>
    </div>
  );
}
