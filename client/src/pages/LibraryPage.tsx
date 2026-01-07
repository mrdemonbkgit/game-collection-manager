import { useState, useEffect, useCallback } from 'react';
import { useGames } from '../hooks/useGames';
import { useFilterParams } from '../hooks/useFilterParams';
import { useFilterOptions } from '../hooks/useFilterOptions';
import { useCollections, clearCollectionsCache } from '../hooks/useCollections';
import { fetchGameCount } from '../services/gamesService';
import {
  createCollection,
  updateCollection,
  deleteCollection,
  addGameToCollection,
} from '../services/collectionsService';
import { Collection, CreateCollectionInput, FilterCriteria } from '../types/collection';
import Header from '../components/Header';
import FilterSidebar from '../components/FilterSidebar';
import GameGrid from '../components/GameGrid';
import LoadingSpinner from '../components/LoadingSpinner';
import CollectionModal from '../components/CollectionModal';
import ManageCollectionsModal from '../components/ManageCollectionsModal';

export default function LibraryPage() {
  // Filter state from URL
  const {
    filters,
    setSearch,
    setPlatforms,
    togglePlatform,
    setGenres,
    toggleGenre,
    toggleCollection,
    setSort,
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

  // Collections from API
  const { collections, refresh: refreshCollections } = useCollections();

  // Collection modal state
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [showManageModal, setShowManageModal] = useState(false);

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
    collections: filters.collectionIds.length > 0 ? filters.collectionIds : undefined,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
  });

  // Handle creating a collection
  const handleCreateCollection = useCallback(
    async (input: CreateCollectionInput) => {
      try {
        await createCollection(input);
        clearCollectionsCache();
        refreshCollections();
        setShowCollectionModal(false);
      } catch (err) {
        console.error('Failed to create collection:', err);
      }
    },
    [refreshCollections]
  );

  // Handle adding/removing a game from a collection
  const handleToggleGameInCollection = useCallback(
    async (collectionId: number, gameId: number) => {
      // For now, we just add. To toggle, we'd need to track which games are in which collections.
      // This is a simplification - in a full implementation we'd check membership first.
      try {
        await addGameToCollection(collectionId, gameId);
        clearCollectionsCache();
        refreshCollections();
      } catch (err) {
        console.error('Failed to toggle game in collection:', err);
      }
    },
    [refreshCollections]
  );

  // Handle editing a collection
  const handleEditCollection = useCallback(
    async (collection: Collection, input: CreateCollectionInput) => {
      try {
        await updateCollection(collection.id, input);
        clearCollectionsCache();
        refreshCollections();
      } catch (err) {
        console.error('Failed to update collection:', err);
      }
    },
    [refreshCollections]
  );

  // Handle deleting a collection
  const handleDeleteCollection = useCallback(
    async (id: number) => {
      try {
        await deleteCollection(id);
        clearCollectionsCache();
        refreshCollections();
      } catch (err) {
        console.error('Failed to delete collection:', err);
      }
    },
    [refreshCollections]
  );

  // Handle applying smart filter criteria
  const handleApplySmartFilter = useCallback(
    (criteria: FilterCriteria) => {
      // Clear existing filters first
      clearFilters();

      // Apply the saved criteria
      if (criteria.search) setSearch(criteria.search);
      if (criteria.platforms?.length) setPlatforms(criteria.platforms);
      if (criteria.genres?.length) setGenres(criteria.genres);
      if (criteria.sortBy && criteria.sortOrder) {
        setSort(criteria.sortBy as 'title' | 'release_date' | 'metacritic_score' | 'created_at', criteria.sortOrder as 'asc' | 'desc');
      }
    },
    [clearFilters, setSearch, setPlatforms, setGenres, setSort]
  );

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
      collections={collections}
      selectedCollections={filters.collectionIds}
      onToggleCollection={toggleCollection}
      onCreateCollection={() => setShowCollectionModal(true)}
      onManageCollections={() => setShowManageModal(true)}
      onApplySmartFilter={handleApplySmartFilter}
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
            collections={collections}
            onAddToCollection={handleToggleGameInCollection}
          />
        </main>
      </div>

      {/* Collection Modal */}
      <CollectionModal
        isOpen={showCollectionModal}
        onClose={() => setShowCollectionModal(false)}
        onSave={handleCreateCollection}
        currentFilters={filters}
      />

      {/* Manage Collections Modal */}
      <ManageCollectionsModal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        collections={collections}
        onEdit={handleEditCollection}
        onDelete={handleDeleteCollection}
        onCreate={() => {
          setShowManageModal(false);
          setShowCollectionModal(true);
        }}
      />
    </div>
  );
}
