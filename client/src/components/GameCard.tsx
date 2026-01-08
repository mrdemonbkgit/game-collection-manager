import { memo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Game } from '../types/game';
import { Collection } from '../types/collection';
import AddToCollectionDropdown from './AddToCollectionDropdown';

interface GameCardProps {
  game: Game;
  collections?: Collection[];
  gameCollectionIds?: number[];
  onAddToCollection?: (collectionId: number, gameId: number) => void;
}

// Steam cover image URLs
function getSteamLibraryCover(steamAppId: number): string {
  return `https://steamcdn-a.akamaihd.net/steam/apps/${steamAppId}/library_600x900.jpg`;
}

function getSteamHeader(steamAppId: number): string {
  return `https://steamcdn-a.akamaihd.net/steam/apps/${steamAppId}/header.jpg`;
}

// Fallback chain: 0=coverUrl, 1=libraryCover, 2=header, 3=text
function getImageUrl(
  game: Game,
  fallbackIndex: number
): string | null {
  switch (fallbackIndex) {
    case 0:
      return game.coverImageUrl;
    case 1:
      return game.steamAppId ? getSteamLibraryCover(game.steamAppId) : null;
    case 2:
      return game.steamAppId ? getSteamHeader(game.steamAppId) : null;
    default:
      return null;
  }
}

// Platform icon mapping
const PLATFORM_ICONS: Record<string, { src: string; alt: string }> = {
  steam: { src: '/icons/steam.png', alt: 'Steam' },
  gamepass: { src: '/icons/xbox.png', alt: 'Game Pass' },
  eaplay: { src: '/icons/ea.png', alt: 'EA Play' },
  ubisoftplus: { src: '/icons/ubisoft.png', alt: 'Ubisoft+' },
};

function GameCard({
  game,
  collections = [],
  gameCollectionIds = [],
  onAddToCollection,
}: GameCardProps) {
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);

  const imageUrl = getImageUrl(game, fallbackIndex);
  const showTextPlaceholder = fallbackIndex >= 3 || !imageUrl;

  const showAddButton = collections.length > 0 && onAddToCollection;

  const handleImageError = () => {
    if (fallbackIndex < 3) {
      setFallbackIndex((prev) => prev + 1);
    }
  };

  const handleImageLoad = () => {
    setIsLoaded(true);
  };

  return (
    <div data-testid="game-card" className="group relative w-full h-full">
      <Link to={`/game/${game.slug}`} className="block cursor-pointer">
        {/* Cover Image Container */}
        <div className="relative w-full h-[calc(100%-28px)] bg-steam-bg-card rounded overflow-hidden">
        {showTextPlaceholder ? (
          // Text placeholder (fallback 3)
          <div className="w-full h-full flex items-center justify-center text-steam-text-muted text-xs p-2 text-center">
            {game.title}
          </div>
        ) : (
          <>
            {/* Skeleton while loading */}
            {!isLoaded && (
              <div className="absolute inset-0 bg-steam-bg-card animate-pulse" />
            )}
            <img
              src={imageUrl!}
              alt={game.title}
              className={`w-full h-full object-cover transition-transform duration-200 group-hover:scale-[1.02] ${
                isLoaded ? 'opacity-100' : 'opacity-0'
              }`}
              loading="lazy"
              decoding="async"
              onError={handleImageError}
              onLoad={handleImageLoad}
            />
          </>
        )}

        {/* Hover overlay */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-200 pointer-events-none" />

        {/* Platform badges - show all platforms */}
        {game.platforms && game.platforms.length > 0 && (
          <div className="absolute top-1.5 left-1.5 flex gap-1">
            {game.platforms.map((platform) => {
              const icon = PLATFORM_ICONS[platform.platformType];
              if (!icon) return null;
              return (
                <div
                  key={platform.id}
                  className="bg-steam-bg/80 rounded px-1 py-0.5"
                  title={icon.alt}
                >
                  <img
                    src={icon.src}
                    alt={icon.alt}
                    className="w-3.5 h-3.5"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Add to Collection button */}
        {showAddButton && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDropdown(!showDropdown);
            }}
            className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 bg-steam-bg-dark/80 hover:bg-steam-bg-dark p-1.5 rounded transition-opacity"
            title="Add to Collection"
            data-testid={`add-to-collection-btn-${game.id}`}
          >
            <svg
              className="w-4 h-4 text-steam-accent"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
          </button>
        )}

      </div>

      {/* Title - fixed height, truncated */}
      <div className="mt-1 px-0.5 h-6">
        <h3 className="text-xs text-steam-text truncate group-hover:text-steam-accent transition-colors">
          {game.title}
        </h3>
      </div>
      </Link>

      {/* Collection dropdown - outside Link to prevent navigation */}
      {showDropdown && onAddToCollection && (
        <AddToCollectionDropdown
          gameId={game.id}
          collections={collections}
          gameCollectionIds={gameCollectionIds}
          onToggle={onAddToCollection}
          onClose={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}

// Memoize to prevent unnecessary re-renders in virtual list
export default memo(GameCard);
