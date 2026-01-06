import { memo, useState } from 'react';
import { Game } from '../types/game';

interface GameCardProps {
  game: Game;
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

// Simple Steam icon SVG
function SteamIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2C6.48 2 2 6.48 2 12c0 4.84 3.44 8.87 8 9.8V15H8v-3h2V9.5C10 7.57 11.57 6 13.5 6H16v3h-2c-.55 0-1 .45-1 1v2h3l-.5 3H13v6.95c5.05-.5 9-4.76 9-9.95 0-5.52-4.48-10-10-10z" />
    </svg>
  );
}

function GameCard({ game }: GameCardProps) {
  const [fallbackIndex, setFallbackIndex] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  const imageUrl = getImageUrl(game, fallbackIndex);
  const showTextPlaceholder = fallbackIndex >= 3 || !imageUrl;

  const handleImageError = () => {
    if (fallbackIndex < 3) {
      setFallbackIndex((prev) => prev + 1);
    }
  };

  const handleImageLoad = () => {
    setIsLoaded(true);
  };

  return (
    <div data-testid="game-card" className="group relative w-full h-full cursor-pointer">
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

        {/* Platform badge - Steam icon */}
        {game.steamAppId && (
          <div className="absolute top-1.5 left-1.5 bg-steam-bg/80 rounded px-1 py-0.5">
            <SteamIcon className="w-3.5 h-3.5 text-steam-accent" />
          </div>
        )}
      </div>

      {/* Title - fixed height, truncated */}
      <div className="mt-1 px-0.5 h-6">
        <h3 className="text-xs text-steam-text truncate group-hover:text-steam-accent transition-colors">
          {game.title}
        </h3>
      </div>
    </div>
  );
}

// Memoize to prevent unnecessary re-renders in virtual list
export default memo(GameCard);
