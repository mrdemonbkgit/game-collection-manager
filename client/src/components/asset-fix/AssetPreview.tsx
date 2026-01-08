import { Game } from '../../types/game';

interface AssetPreviewProps {
  game: Game;
  heroUrl: string | null;
  logoUrl: string | null;
}

export function AssetPreview({ game, heroUrl, logoUrl }: AssetPreviewProps) {
  // Format playtime
  const playtimeHours = Math.floor(game.playtimeMinutes / 60);
  const playtimeDisplay = playtimeHours > 0 ? `${playtimeHours} hours` : 'Not played';

  return (
    <div className="relative min-h-[50vh] lg:min-h-[60vh] overflow-hidden">
      {/* Background Image with smooth transition */}
      <div
        className="absolute inset-0 bg-cover bg-center transition-opacity duration-300"
        style={{
          backgroundImage: heroUrl ? `url(${heroUrl})` : 'none',
          opacity: heroUrl ? 1 : 0,
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
              className="max-h-32 lg:max-h-40 w-auto drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)] transition-opacity duration-300"
            />
          ) : (
            <h1 className="text-4xl lg:text-5xl font-bold text-white drop-shadow-lg">
              {game.title}
            </h1>
          )}
        </div>

        {/* Ownership & Playtime Bar - matches CinematicHero spacing */}
        <div className="flex flex-wrap items-center gap-4 mb-6">
          <div className="text-white/70 text-sm">
            <span className="text-white">{playtimeDisplay}</span>
            {playtimeHours > 0 && ' played'}
          </div>
        </div>

        {/* Placeholder for action buttons height - matches CinematicHero */}
        <div className="h-[42px]" />
      </div>

      {/* "Live Preview" badge */}
      <div className="absolute top-4 right-4 px-3 py-1 bg-black/60 text-white/80 text-xs rounded-full">
        Live Preview
      </div>
    </div>
  );
}
