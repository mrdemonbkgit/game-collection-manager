import { Game } from '../../types/game';

interface RatingsCardProps {
  game: Game;
}

function getMetacriticColor(score: number): string {
  if (score >= 75) return 'bg-green-600';
  if (score >= 50) return 'bg-yellow-600';
  return 'bg-red-600';
}

export function RatingsCard({ game }: RatingsCardProps) {
  const hasMetacritic = game.metacriticScore !== null;
  const hasSteamRating = game.steamRating !== null;
  const encodedTitle = encodeURIComponent(game.title);

  if (!hasMetacritic && !hasSteamRating) {
    return (
      <div className="bg-steam-bg-card rounded-lg p-4">
        <h3 className="text-steam-text-muted text-sm font-medium mb-3 uppercase tracking-wide">
          Ratings
        </h3>
        <p className="text-steam-text-muted text-sm">No ratings available</p>
      </div>
    );
  }

  return (
    <div className="bg-steam-bg-card rounded-lg p-4">
      <h3 className="text-steam-text-muted text-sm font-medium mb-3 uppercase tracking-wide">
        Ratings
      </h3>

      {/* Ratings Grid */}
      <div className="flex gap-6 mb-4">
        {/* Metacritic Score */}
        {hasMetacritic && (
          <div className="flex flex-col items-center">
            <a
              href={game.metacriticUrl || `https://www.metacritic.com/search/${encodedTitle}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`w-14 h-14 ${getMetacriticColor(game.metacriticScore!)} rounded flex items-center justify-center hover:opacity-90 transition-opacity`}
            >
              <span className="text-white text-xl font-bold">{game.metacriticScore}</span>
            </a>
            <span className="text-steam-text-muted text-xs mt-1">Metacritic</span>
          </div>
        )}

        {/* Steam Rating */}
        {hasSteamRating && (
          <div className="flex flex-col items-center">
            <a
              href={`https://store.steampowered.com/app/${game.steamAppId}#reviews`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center hover:opacity-90 transition-opacity"
            >
              <div className="text-xl font-bold text-steam-text">
                {Math.round(game.steamRating!)}%
              </div>
              {game.steamRatingCount && (
                <div className="text-steam-text-muted text-xs">
                  ({(game.steamRatingCount / 1000).toFixed(1)}k)
                </div>
              )}
            </a>
            <span className="text-steam-text-muted text-xs mt-1">Steam</span>
          </div>
        )}
      </div>

      {/* External Review Links */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-steam-border">
        <a
          href={`https://opencritic.com/search?q=${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-steam-text-muted hover:text-steam-text transition-colors"
        >
          OpenCritic
        </a>
        <span className="text-steam-border">|</span>
        <a
          href={`https://www.ign.com/search?q=${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-steam-text-muted hover:text-steam-text transition-colors"
        >
          IGN
        </a>
        <span className="text-steam-border">|</span>
        <a
          href={`https://www.gamespot.com/search/?q=${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-steam-text-muted hover:text-steam-text transition-colors"
        >
          GameSpot
        </a>
      </div>
    </div>
  );
}
