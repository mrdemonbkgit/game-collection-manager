interface FilterSidebarProps {
  platforms: string[];
  selectedPlatforms: string[];
  onTogglePlatform: (platform: string) => void;
  genres: string[];
  selectedGenres: string[];
  onToggleGenre: (genre: string) => void;
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
  onClearAll,
  hasActiveFilters,
  loading = false,
}: FilterSidebarProps) {
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
          </>
        )}
      </div>
    </aside>
  );
}
