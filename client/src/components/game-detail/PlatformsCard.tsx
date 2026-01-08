import { Game, PlatformType } from '../../types/game';

interface PlatformsCardProps {
  game: Game;
}

const PLATFORM_CONFIG: Record<PlatformType, { label: string; color: string; getStoreUrl: (game: Game) => string }> = {
  steam: {
    label: 'Steam',
    color: 'bg-[#1b2838]',
    getStoreUrl: (game) => `https://store.steampowered.com/app/${game.steamAppId}`,
  },
  gamepass: {
    label: 'Game Pass',
    color: 'bg-[#107C10]',
    getStoreUrl: (game) => `https://www.xbox.com/games/store/search/${encodeURIComponent(game.title)}`,
  },
  eaplay: {
    label: 'EA Play',
    color: 'bg-[#ff4747]',
    getStoreUrl: () => 'https://www.ea.com/games/library',
  },
  ubisoftplus: {
    label: 'Ubisoft+',
    color: 'bg-[#0070ff]',
    getStoreUrl: (game) => `https://store.ubisoft.com/search/?q=${encodeURIComponent(game.title)}`,
  },
};

export function PlatformsCard({ game }: PlatformsCardProps) {
  if (game.platforms.length === 0) {
    return null;
  }

  return (
    <div className="bg-steam-bg-card rounded-lg p-4">
      <h3 className="text-steam-text-muted text-sm font-medium mb-3 uppercase tracking-wide">
        Available On
      </h3>

      <div className="space-y-2">
        {game.platforms.map((platform) => {
          const config = PLATFORM_CONFIG[platform.platformType];
          if (!config) return null;

          return (
            <div
              key={platform.id}
              className="flex items-center justify-between p-2 bg-steam-bg/50 rounded"
            >
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${config.color}`} />
                <span className="text-steam-text text-sm">{config.label}</span>
              </div>
              <a
                href={config.getStoreUrl(game)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-steam-blue hover:text-blue-400 transition-colors"
              >
                Store
              </a>
            </div>
          );
        })}
      </div>
    </div>
  );
}
