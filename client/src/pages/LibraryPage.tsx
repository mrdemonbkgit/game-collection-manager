import { useState, useEffect } from 'react';
import { useGames } from '../hooks/useGames';
import { useFilterParams } from '../hooks/useFilterParams';
import { useFilterOptions } from '../hooks/useFilterOptions';
import { fetchGameCount } from '../services/gamesService';
import Header from '../components/Header';
import FilterSidebar from '../components/FilterSidebar';
import GameGrid from '../components/GameGrid';
import LoadingSpinner from '../components/LoadingSpinner';

export default function LibraryPage() {
  // Filter state from URL
  const {
    filters,
    setSearch,
    togglePlatform,
    toggleGenre,
    setSortById,
    clearFilters,
    hasActiveFilters,
  } = useFilterParams();

  // Filter options from API
  const {
    platforms,
    genres,
    sortOptions,
    loading: optionsLoading,
  } = useFilterOptions();

  // Total count (unfiltered) - fetched once on mount
  const [totalCount, setTotalCount] = useState(0);
  useEffect(() => {
    fetchGameCount().then(setTotalCount).catch(console.error);
  }, []);

  // Games with filters applied
  const { games, total, loading, error, hasMore, loadMore } = useGames({
    search: filters.search || undefined,
    platforms: filters.platforms.length > 0 ? filters.platforms : undefined,
    genres: filters.genres.length > 0 ? filters.genres : undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  });

  // Build current sort ID for the dropdown
  const sortByToId: Record<string, string> = {
    title: 'title',
    release_date: 'release',
    metacritic_score: 'metacritic',
    created_at: 'added',
  };
  const currentSortId = `${sortByToId[filters.sortBy] || filters.sortBy}-${filters.sortOrder}`;

  // Header component for all states
  const headerElement = (
    <Header
      totalCount={totalCount}
      filteredCount={total}
      searchValue={filters.search}
      onSearchChange={setSearch}
      sortOptions={sortOptions}
      currentSortId={currentSortId}
      onSortChange={setSortById}
      loading={optionsLoading}
    />
  );

  // Sidebar component for all states
  const sidebarElement = (
    <FilterSidebar
      platforms={platforms}
      selectedPlatforms={filters.platforms}
      onTogglePlatform={togglePlatform}
      genres={genres}
      selectedGenres={filters.genres}
      onToggleGenre={toggleGenre}
      onClearAll={clearFilters}
      hasActiveFilters={hasActiveFilters}
      loading={optionsLoading}
    />
  );

  // Error state
  if (error && games.length === 0) {
    return (
      <div className="h-full flex flex-col">
        {headerElement}
        <div className="flex-1 flex min-h-0">
          {sidebarElement}
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
      </div>
    );
  }

  // Initial loading state
  if (games.length === 0 && loading) {
    return (
      <div className="h-full flex flex-col">
        {headerElement}
        <div className="flex-1 flex min-h-0">
          {sidebarElement}
          <div className="flex-1 flex items-center justify-center">
            <LoadingSpinner />
          </div>
        </div>
      </div>
    );
  }

  // Empty state (no results for current filters)
  if (games.length === 0 && !loading) {
    return (
      <div className="h-full flex flex-col">
        {headerElement}
        <div className="flex-1 flex min-h-0">
          {sidebarElement}
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <p data-testid="empty-message" className="text-steam-text-muted mb-4">
                No games found matching your filters
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="text-sm text-steam-accent hover:text-steam-text transition-colors"
                >
                  Clear all filters
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Main grid view
  return (
    <div className="h-full flex flex-col">
      {headerElement}
      <div className="flex-1 flex min-h-0">
        {sidebarElement}
        <main className="flex-1 flex flex-col py-4 min-h-0">
          <GameGrid
            games={games}
            total={total}
            hasMore={hasMore}
            loading={loading}
            onLoadMore={loadMore}
          />
        </main>
      </div>
    </div>
  );
}
