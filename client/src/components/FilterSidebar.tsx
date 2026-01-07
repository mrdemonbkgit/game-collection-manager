import { Collection, FilterCriteria } from '../types/collection';

interface FilterSidebarProps {
  platforms: string[];
  selectedPlatforms: string[];
  onTogglePlatform: (platform: string) => void;
  genres: string[];
  selectedGenres: string[];
  onToggleGenre: (genre: string) => void;
  collections: Collection[];
  selectedCollections: number[];
  onToggleCollection: (id: number) => void;
  onCreateCollection: () => void;
  onManageCollections: () => void;
  onApplySmartFilter?: (criteria: FilterCriteria) => void;
  onClearAll: () => void;
  hasActiveFilters: boolean;
  loading?: boolean;
}

// Platform display names
const PLATFORM_LABELS: Record<string, string> = {
  steam: 'Steam',
  gamepass: 'Game Pass',
  eaplay: 'EA Play',
  ubisoftplus: 'Ubisoft+',
};

export default function FilterSidebar({
  platforms,
  selectedPlatforms,
  onTogglePlatform,
  genres,
  selectedGenres,
  onToggleGenre,
  collections,
  selectedCollections,
  onToggleCollection,
  onCreateCollection,
  onManageCollections,
  onApplySmartFilter,
  onClearAll,
  hasActiveFilters,
  loading = false,
}: FilterSidebarProps) {
  const handleCollectionClick = (collection: Collection) => {
    if (collection.isSmartFilter && collection.filterCriteria && onApplySmartFilter) {
      // Smart filter: Apply saved criteria
      onApplySmartFilter(collection.filterCriteria);
    } else {
      // Regular collection: Toggle collection filter
      onToggleCollection(collection.id);
    }
  };
  return (
    <aside
      className="w-[280px] flex-shrink-0 bg-steam-bg-dark border-r border-steam-border overflow-y-auto"
      data-testid="filter-sidebar"
    >
      <div className="p-4 space-y-6">
        {/* Header with Clear button */}
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-steam-text uppercase tracking-wider">
            Filters
          </h2>
          {hasActiveFilters && (
            <button
              onClick={onClearAll}
              className="text-xs text-steam-accent hover:text-steam-text transition-colors"
              data-testid="clear-filters"
            >
              Clear All
            </button>
          )}
        </div>

        {loading ? (
          <div className="text-steam-text-muted text-sm">Loading filters...</div>
        ) : (
          <>
            {/* Platform Filter */}
            <div>
              <h3 className="text-sm font-medium text-steam-text mb-3">Platform</h3>
              <div className="space-y-2">
                {platforms.map((platform) => (
                  <label
                    key={platform}
                    className="flex items-center gap-2 cursor-pointer group"
                  >
                    <input
                      type="checkbox"
                      checked={selectedPlatforms.includes(platform)}
                      onChange={() => onTogglePlatform(platform)}
                      className="w-4 h-4 rounded border-steam-border bg-steam-bg-card text-steam-accent focus:ring-steam-accent focus:ring-offset-0 cursor-pointer"
                      data-testid={`platform-${platform}`}
                    />
                    <span className="text-sm text-steam-text-muted group-hover:text-steam-text transition-colors">
                      {PLATFORM_LABELS[platform] || platform}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            {/* Genre Filter */}
            <div>
              <h3 className="text-sm font-medium text-steam-text mb-3">Genre</h3>
              {genres.length === 0 ? (
                <p className="text-xs text-steam-text-muted italic">
                  No genres available — run full Steam sync
                </p>
              ) : (
                <div className="space-y-2">
                  {genres.map((genre) => (
                    <label
                      key={genre}
                      className="flex items-center gap-2 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={selectedGenres.includes(genre)}
                        onChange={() => onToggleGenre(genre)}
                        className="w-4 h-4 rounded border-steam-border bg-steam-bg-card text-steam-accent focus:ring-steam-accent focus:ring-offset-0 cursor-pointer"
                        data-testid={`genre-${genre.replace(/\s+/g, '-').toLowerCase()}`}
                      />
                      <span className="text-sm text-steam-text-muted group-hover:text-steam-text transition-colors">
                        {genre}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            {/* Collections Section */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-steam-text">Collections</h3>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onManageCollections}
                    className="text-xs text-steam-text-muted hover:text-steam-text transition-colors"
                    data-testid="manage-collections"
                  >
                    Manage
                  </button>
                  <button
                    onClick={onCreateCollection}
                    className="text-xs text-steam-accent hover:text-steam-text transition-colors"
                    data-testid="create-collection"
                  >
                    + New
                  </button>
                </div>
              </div>
              {collections.length === 0 ? (
                <p className="text-xs text-steam-text-muted italic">No collections yet</p>
              ) : (
                <div className="space-y-2">
                  {collections.map((collection) => (
                    <label
                      key={collection.id}
                      className="flex items-center gap-2 cursor-pointer group"
                    >
                      {collection.isSmartFilter ? (
                        // Smart filter: Click applies filters (show icon instead of checkbox)
                        <button
                          onClick={() => handleCollectionClick(collection)}
                          className="w-4 h-4 flex items-center justify-center text-steam-accent"
                          data-testid={`smart-filter-${collection.id}`}
                          title="Smart Filter"
                        >
                          ⚡
                        </button>
                      ) : (
                        // Regular collection: Checkbox toggle
                        <input
                          type="checkbox"
                          checked={selectedCollections.includes(collection.id)}
                          onChange={() => onToggleCollection(collection.id)}
                          className="w-4 h-4 rounded border-steam-border bg-steam-bg-card text-steam-accent focus:ring-steam-accent focus:ring-offset-0 cursor-pointer"
                          data-testid={`collection-${collection.id}`}
                        />
                      )}
                      <span
                        onClick={() => handleCollectionClick(collection)}
                        className="text-sm text-steam-text-muted group-hover:text-steam-text transition-colors flex-1 cursor-pointer"
                      >
                        {collection.name}
                      </span>
                      <span className="text-xs text-steam-text-muted">
                        {collection.isSmartFilter ? 'Smart' : collection.gameCount}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
