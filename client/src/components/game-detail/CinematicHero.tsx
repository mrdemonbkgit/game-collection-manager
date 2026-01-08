import { Link } from 'react-router-dom';
import { Game } from '../../types/game';
import PlatformBadge from '../PlatformBadge';

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
  // Only use fallbacks AFTER assets have finished loading to avoid flash
  const fallbackUrl = game.screenshots[0]
    || (game.steamAppId ? `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg` : null);

  // If still loading assets, don't show fallback yet (prevents flash)
  const backgroundUrl = heroUrl || (assetsLoading ? null : fallbackUrl);

  // Format playtime
  const playtimeHours = Math.floor(game.playtimeMinutes / 60);
  const playtimeDisplay = playtimeHours > 0 ? `${playtimeHours} hours` : 'Not played';

  return (
    <div className="relative min-h-[50vh] lg:min-h-[60vh] overflow-hidden">
      {/* Background Image with smooth transition */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
        style={{
          backgroundImage: backgroundUrl ? `url(${backgroundUrl})` : 'none',
          opacity: backgroundUrl ? 1 : 0,
        }}
      >
        {/* Dark overlay for readability */}
        <div className="absolute inset-0 bg-black/40" />
      </div>
      {/* Gradient fallback (always behind) */}
      <div className="absolute inset-0 bg-gradient-to-br from-steam-bg via-steam-bg-card to-steam-bg -z-10" />

      {/* Gradient overlay at bottom */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-steam-bg via-steam-bg/80 to-transparent" />

      {/* Content Container */}
      <div className="relative z-10 flex flex-col justify-end min-h-[50vh] lg:min-h-[60vh] max-w-7xl mx-auto px-4 pb-8">
        {/* Logo or Title */}
        <div className="mb-4 min-h-[2.5rem] lg:min-h-[3rem]">
          {logoUrl ? (
            <img
              src={logoUrl}
              alt={game.title}
              className="max-h-32 lg:max-h-40 w-auto drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] animate-fade-in"
            />
          ) : !assetsLoading ? (
            // Only show text fallback AFTER assets finished loading
            <h1 className="text-4xl lg:text-5xl font-bold text-white drop-shadow-lg">
              {game.title}
            </h1>
          ) : null}
        </div>

        {/* Ownership & Playtime Bar */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          {/* Platform Badges */}
          {game.platforms.length > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-white/70 text-sm">Owned on</span>
              {game.platforms.map((platform) => (
                <PlatformBadge
                  key={platform.id}
                  platform={platform.platformType}
                  size="md"
                  showLabel={true}
                />
              ))}
            </div>
          )}

          {/* Playtime */}
          <div className="text-white/70 text-sm">
            <span className="text-white">{playtimeDisplay}</span>
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

          {/* Fix Assets */}
          <Link
            to={`/game/${game.slug}/fix-assets`}
            className="px-4 py-2.5 bg-steam-bg-card/80 hover:bg-steam-bg-card text-steam-text rounded transition-colors"
          >
            Fix Hero/Logo
          </Link>
        </div>
      </div>
    </div>
  );
}
