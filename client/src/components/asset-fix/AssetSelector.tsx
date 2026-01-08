import { SteamGridAssetOption } from '../../services/gamesService';

interface AssetSelectorProps {
  title: string;
  options: SteamGridAssetOption[];
  selectedId: number | null;
  currentAssetId: number | null;
  onSelect: (id: number, previewUrl: string) => void;
  onLoadMore: () => void;
  hasMore: boolean;
  loading: boolean;
  total: number;
  aspectRatio: 'square' | 'wide';
  error: string | null;
}

export function AssetSelector({
  title,
  options,
  selectedId,
  currentAssetId,
  onSelect,
  onLoadMore,
  hasMore,
  loading,
  total,
  aspectRatio,
  error,
}: AssetSelectorProps) {
  const aspectClass = aspectRatio === 'square' ? 'aspect-square' : 'aspect-video';

  return (
    <div className="bg-steam-bg-card rounded-lg p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-white">{title}</h3>
        <span className="text-sm text-steam-text-muted">
          Showing {options.length} of {total}
        </span>
      </div>

      {/* Error State */}
      {error && (
        <div className="mb-4 p-3 bg-red-900/30 border border-red-700/50 text-red-200 rounded text-sm">
          {error}
        </div>
      )}

      {/* Empty State */}
      {!loading && options.length === 0 && !error && (
        <div className="py-12 text-center text-steam-text-muted">
          <p>No {title.toLowerCase().replace('choose ', '')} available on SteamGridDB</p>
        </div>
      )}

      {/* Grid */}
      {options.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {options.map((option) => {
            const isSelected = selectedId === option.id;
            const isCurrent = currentAssetId === option.id;

            return (
              <button
                key={option.id}
                onClick={() => onSelect(option.id, option.url)}
                className={`
                  relative overflow-hidden rounded-lg transition-all
                  ${isSelected
                    ? 'ring-2 ring-steam-accent ring-offset-2 ring-offset-steam-bg-card'
                    : 'hover:ring-2 hover:ring-white/30 hover:ring-offset-2 hover:ring-offset-steam-bg-card'
                  }
                `}
              >
                {/* Thumbnail */}
                <div className={`${aspectClass} bg-steam-bg`}>
                  <img
                    src={option.thumb}
                    alt={`Option by ${option.author}`}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>

                {/* Selected Checkmark */}
                {isSelected && (
                  <div className="absolute top-2 right-2 w-6 h-6 bg-steam-accent rounded-full flex items-center justify-center">
                    <svg
                      className="w-4 h-4 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  </div>
                )}

                {/* Current Badge */}
                {isCurrent && !isSelected && (
                  <div className="absolute top-2 left-2 px-2 py-0.5 bg-black/70 text-white text-xs rounded">
                    Current
                  </div>
                )}

                {/* Author & Score Overlay */}
                <div className="absolute bottom-0 inset-x-0 px-2 py-1 bg-gradient-to-t from-black/80 to-transparent">
                  <div className="flex items-center justify-between text-xs text-white/80">
                    <span className="truncate">{option.author}</span>
                    <span className="text-yellow-400">{option.score}</span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && options.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className={`${aspectClass} bg-steam-bg rounded-lg animate-pulse`}
            />
          ))}
        </div>
      )}

      {/* Load More Button */}
      {(hasMore || loading) && options.length > 0 && (
        <button
          onClick={onLoadMore}
          disabled={loading}
          className="w-full py-2 bg-steam-bg hover:bg-steam-bg/80 text-steam-text rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Loading...' : 'Load More'}
        </button>
      )}
    </div>
  );
}
