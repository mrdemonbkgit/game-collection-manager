import { Game } from '../../types/game';

interface CinematicHeroProps {
  game: Game;
  heroUrl: string | null;
  logoUrl: string | null;
  assetsLoading: boolean;
  onPlay?: () => void;
  onAddToCollection: () => void;
}

export function CinematicHero({
  game,
  heroUrl,
  logoUrl,
  assetsLoading,
  onPlay,
  onAddToCollection,
}: CinematicHeroProps) {
  // Background image priority: hero > first screenshot > Steam header > gradient
  const backgroundUrl = heroUrl
    || game.screenshots[0]
    || (game.steamAppId ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg` : null);

  // Format playtime
  const playtimeHours = Math.floor(game.playtimeMinutes / 60);
  const playtimeDisplay = playtimeHours > 0 ? `${playtimeHours} hours` : 'Not played';

  // Get platform badges
  const platformBadges = game.platforms.map((p) => ({
    type: p.platformType,
    label: {
      steam: 'Steam',
      gamepass: 'Game Pass',
      eaplay: 'EA Play',
      ubisoftplus: 'Ubisoft+',
    }[p.platformType],
  }));

  return (
    <div className="relative min-h-[50vh] lg:min-h-[60vh] overflow-hidden">
      {/* Background Image */}
      {backgroundUrl ? (
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${backgroundUrl})` }}
        >
          {/* Dark overlay for readability */}
          <div className="absolute inset-0 bg-black/40" />
        </div>
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-steam-bg via-steam-bg-card to-steam-bg" />
      )}

      {/* Gradient overlay at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-steam-bg via-steam-bg/80 to-transparent" />

      {/* Content Container */}
      <div className="relative z-10 flex flex-col justify-end min-h-[50vh] lg:min-h-[60vh] max-w-7xl mx-auto px-4 pb-8">
        {/* Logo or Title */}
        <div className="mb-4">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={game.title}
              className="max-h-32 lg:max-h-40 w-auto drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
            />
          ) : (
            <h1 className="text-4xl lg:text-5xl font-bold text-white drop-shadow-lg">
              {game.title}
            </h1>
          )}
          {assetsLoading && (
            <div className="mt-2 text-steam-text-muted text-sm">Loading assets...</div>
          )}
        </div>

        {/* Ownership & Playtime Bar */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Platform Badges */}
          {platformBadges.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-steam-text-muted text-sm">Owned on</span>
              {platformBadges.map((badge) => (
                <span
                  key={badge.type}
                  className="px-2 py-1 bg-steam-bg-card/80 rounded text-sm font-medium text-steam-text"
                >
                  {badge.label}
                </span>
              ))}
            </div>
          )}

          {/* Playtime */}
          <div className="text-steam-text-muted text-sm">
            <span className="text-steam-text">{playtimeDisplay}</span>
            {playtimeHours > 0 && ' played'}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Play Button - Only show for Steam games */}
          {game.steamAppId && (
            <button
              onClick={onPlay}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded transition-colors"
            >
              Play
            </button>
          )}

          {/* Add to Collection */}
          <button
            onClick={onAddToCollection}
            className="px-4 py-2.5 bg-steam-bg-card/80 hover:bg-steam-bg-card text-steam-text rounded transition-colors"
          >
            + Collection
          </button>

          {/* View on Steam Store */}
          {game.steamAppId && (
            <a
              href={`https://store.steampowered.com/app/${game.steamAppId}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2.5 bg-steam-bg-card/80 hover:bg-steam-bg-card text-steam-text rounded transition-colors"
            >
              Steam Store
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
