import { Game } from '../../types/game';

interface RatingsCardProps {
  game: Game;
}

// Steam-style sentiment labels based on percentage
function getSteamSentiment(rating: number): { label: string; color: string; bgColor: string; glowColor: string } {
  if (rating >= 95) return {
    label: 'Overwhelmingly Positive',
    color: 'text-blue-400',
    bgColor: 'from-blue-500/20 to-blue-600/10',
    glowColor: 'shadow-blue-500/30'
  };
  if (rating >= 85) return {
    label: 'Very Positive',
    color: 'text-emerald-400',
    bgColor: 'from-emerald-500/20 to-emerald-600/10',
    glowColor: 'shadow-emerald-500/30'
  };
  if (rating >= 80) return {
    label: 'Positive',
    color: 'text-green-400',
    bgColor: 'from-green-500/20 to-green-600/10',
    glowColor: 'shadow-green-500/30'
  };
  if (rating >= 70) return {
    label: 'Mostly Positive',
    color: 'text-lime-400',
    bgColor: 'from-lime-500/20 to-lime-600/10',
    glowColor: 'shadow-lime-500/30'
  };
  if (rating >= 40) return {
    label: 'Mixed',
    color: 'text-yellow-400',
    bgColor: 'from-yellow-500/20 to-yellow-600/10',
    glowColor: 'shadow-yellow-500/30'
  };
  if (rating >= 20) return {
    label: 'Mostly Negative',
    color: 'text-orange-400',
    bgColor: 'from-orange-500/20 to-orange-600/10',
    glowColor: 'shadow-orange-500/30'
  };
  return {
    label: 'Overwhelmingly Negative',
    color: 'text-red-400',
    bgColor: 'from-red-500/20 to-red-600/10',
    glowColor: 'shadow-red-500/30'
  };
}

function getMetacriticStyle(score: number): { bg: string; glow: string } {
  if (score >= 75) return { bg: 'bg-green-500', glow: 'shadow-green-500/50' };
  if (score >= 50) return { bg: 'bg-yellow-500', glow: 'shadow-yellow-500/50' };
  return { bg: 'bg-red-500', glow: 'shadow-red-500/50' };
}

function formatReviewCount(count: number): string {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
}

// Get actual hex color for the ring
function getRingColor(rating: number): string {
  if (rating >= 95) return '#60a5fa'; // blue-400
  if (rating >= 85) return '#34d399'; // emerald-400
  if (rating >= 80) return '#4ade80'; // green-400
  if (rating >= 70) return '#a3e635'; // lime-400
  if (rating >= 40) return '#facc15'; // yellow-400
  if (rating >= 20) return '#fb923c'; // orange-400
  return '#f87171'; // red-400
}

// Circular progress ring component
function CircularProgress({
  percentage,
  size = 100,
  strokeWidth = 8,
}: {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;
  const color = getRingColor(percentage);
  const gradientId = `progressGradient-${percentage}`;

  return (
    <svg width={size} height={size} className="transform -rotate-90">
      {/* Gradient definition */}
      <defs>
        <linearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor={color} stopOpacity={1} />
          <stop offset="100%" stopColor={color} stopOpacity={0.4} />
        </linearGradient>
      </defs>
      {/* Background circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="#1b2838"
        strokeWidth={strokeWidth}
        opacity={0.5}
      />
      {/* Progress circle */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={`url(#${gradientId})`}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        style={{ transition: 'stroke-dashoffset 1s ease-out' }}
      />
    </svg>
  );
}

export function RatingsCard({ game }: RatingsCardProps) {
  const hasMetacritic = game.metacriticScore !== null;
  const hasSteamRating = game.steamRating !== null;
  const encodedTitle = encodeURIComponent(game.title);

  if (!hasMetacritic && !hasSteamRating) {
    return (
      <div className="bg-steam-bg-card rounded-lg p-5">
        <h3 className="text-steam-text-muted text-sm font-medium mb-3 uppercase tracking-wide">
          Ratings
        </h3>
        <p className="text-steam-text-muted text-sm">No ratings available</p>
      </div>
    );
  }

  const steamSentiment = hasSteamRating ? getSteamSentiment(game.steamRating!) : null;
  const metacriticStyle = hasMetacritic ? getMetacriticStyle(game.metacriticScore!) : null;

  return (
    <div className="bg-steam-bg-card rounded-lg p-5">
      <h3 className="text-steam-text-muted text-sm font-medium mb-4 uppercase tracking-wide">
        Ratings
      </h3>

      <div className="flex flex-wrap gap-6">
        {/* Steam Rating - Circular Progress */}
        {hasSteamRating && steamSentiment && (
          <a
            href={`https://store.steampowered.com/app/${game.steamAppId}#reviews`}
            target="_blank"
            rel="noopener noreferrer"
            className={`group relative flex flex-col items-center p-4 rounded-xl bg-gradient-to-br ${steamSentiment.bgColor} hover:scale-105 transition-all duration-300`}
          >
            {/* Circular Progress */}
            <div className="relative">
              <CircularProgress
                percentage={game.steamRating!}
                size={90}
                strokeWidth={6}
              />
              {/* Center content - number and % on same line */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className={`text-2xl font-bold ${steamSentiment.color}`}>
                  {Math.round(game.steamRating!)}
                </span>
                <span className={`text-sm font-medium ${steamSentiment.color} ml-0.5 mt-1`}>%</span>
              </div>
            </div>

            {/* Sentiment Label */}
            <div className={`mt-3 text-sm font-medium ${steamSentiment.color} text-center`}>
              {steamSentiment.label}
            </div>

            {/* Review Count */}
            {game.steamRatingCount && (
              <div className="text-steam-text-muted text-xs mt-1">
                {formatReviewCount(game.steamRatingCount)} reviews
              </div>
            )}
          </a>
        )}

        {/* Metacritic Score - Badge Style */}
        {hasMetacritic && metacriticStyle && (
          <a
            href={game.metacriticUrl || `https://www.metacritic.com/search/${encodedTitle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex flex-col items-center p-4 rounded-xl bg-gradient-to-br from-gray-800/50 to-gray-900/30 hover:scale-105 transition-all duration-300"
          >
            {/* Score Badge */}
            <div className={`w-16 h-16 ${metacriticStyle.bg} rounded-lg flex items-center justify-center shadow-lg ${metacriticStyle.glow} group-hover:shadow-xl transition-shadow`}>
              <span className="text-white text-2xl font-bold">{game.metacriticScore}</span>
            </div>

            {/* Label */}
            <div className="mt-3 text-sm font-medium text-steam-text">
              Metacritic
            </div>
            <div className="text-steam-text-muted text-xs mt-0.5">
              {game.metacriticScore! >= 75 ? 'Must Play' : game.metacriticScore! >= 50 ? 'Mixed' : 'Skip'}
            </div>
          </a>
        )}
      </div>

      {/* External Review Links */}
      <div className="flex flex-wrap items-center gap-3 pt-4 mt-4 border-t border-steam-border/50">
        <span className="text-steam-text-muted text-xs">More reviews:</span>
        <a
          href={`https://opencritic.com/search?q=${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-steam-accent hover:text-steam-text transition-colors hover:underline"
        >
          OpenCritic
        </a>
        <a
          href={`https://www.ign.com/search?q=${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-steam-accent hover:text-steam-text transition-colors hover:underline"
        >
          IGN
        </a>
        <a
          href={`https://www.gamespot.com/search/?q=${encodedTitle}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-steam-accent hover:text-steam-text transition-colors hover:underline"
        >
          GameSpot
        </a>
      </div>
    </div>
  );
}
