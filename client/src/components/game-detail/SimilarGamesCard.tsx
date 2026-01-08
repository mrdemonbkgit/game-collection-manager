import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useSimilarGames } from '../../hooks/useSimilarGames';

interface SimilarGamesCardProps {
  gameId: number;
}

export function SimilarGamesCard({ gameId }: SimilarGamesCardProps) {
  const { games, loading, error } = useSimilarGames(gameId, 10);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Don't render if no similar games and not loading
  if (!loading && games.length === 0) {
    return null;
  }

  const scroll = (direction: 'left' | 'right') => {
    if (scrollContainerRef.current) {
      const scrollAmount = 200;
      scrollContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <div className="bg-steam-bg-card rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-steam-text-muted text-sm font-medium uppercase tracking-wide">
          Similar Games
        </h3>
      </div>

      {loading ? (
        <div className="flex gap-3 overflow-hidden">
          {[...Array(5)].map((_, i) => (
            <div
              key={i}
              className="flex-shrink-0 w-32 h-44 bg-steam-bg animate-pulse rounded"
            />
          ))}
        </div>
      ) : error ? (
        <p className="text-steam-text-muted text-sm">Failed to load similar games</p>
      ) : (
        <div className="relative group">
          {/* Scroll Buttons */}
          <button
            onClick={() => scroll('left')}
            className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/70 hover:bg-black rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Scroll left"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <button
            onClick={() => scroll('right')}
            className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 bg-black/70 hover:bg-black rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
            aria-label="Scroll right"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>

          {/* Games Carousel */}
          <div
            ref={scrollContainerRef}
            className="flex gap-3 overflow-x-auto scrollbar-hide scroll-smooth pb-2"
          >
            {games.map((game) => (
              <Link
                key={game.id}
                to={`/games/${game.slug}`}
                className="flex-shrink-0 w-32 group/card"
              >
                <div className="relative aspect-[3/4] rounded overflow-hidden bg-steam-bg mb-2">
                  {game.coverImageUrl ? (
                    <img
                      src={game.coverImageUrl}
                      alt={game.title}
                      className="w-full h-full object-cover transition-transform group-hover/card:scale-105"
                      loading="lazy"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-steam-text-muted">
                      <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                  {/* Hover Overlay */}
                  <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/20 transition-colors" />
                </div>
                <h4 className="text-steam-text text-xs font-medium line-clamp-2 group-hover/card:text-white transition-colors">
                  {game.title}
                </h4>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
