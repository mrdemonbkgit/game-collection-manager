import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../hooks/useGame';
import LoadingSpinner from '../components/LoadingSpinner';
import PlatformBadge from '../components/PlatformBadge';
import ScreenshotsGallery from '../components/ScreenshotsGallery';

// Steam URLs
function getSteamStoreUrl(steamAppId: number): string {
  return `https://store.steampowered.com/app/${steamAppId}`;
}

function getSteamLibraryCover(steamAppId: number): string {
  return `https://steamcdn-a.akamaihd.net/steam/apps/${steamAppId}/library_600x900.jpg`;
}

function getSteamHeader(steamAppId: number): string {
  return `https://steamcdn-a.akamaihd.net/steam/apps/${steamAppId}/header.jpg`;
}

// Format date nicely
function formatDate(dateString: string | null): string {
  if (!dateString) return 'Unknown';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
}

// Format playtime
function formatPlaytime(minutes: number): string {
  if (minutes === 0) return 'Never played';
  const hours = Math.floor(minutes / 60);
  if (hours === 0) return `${minutes} minutes`;
  return `${hours.toLocaleString()} hours`;
}

export default function GameDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { game, loading, error } = useGame(slug);

  // Back button handler - use browser history to preserve filters
  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-steam-bg flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-steam-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl text-steam-text mb-4">Game Not Found</h1>
          <p className="text-steam-text-muted mb-6">{error || 'The game you are looking for does not exist.'}</p>
          <button
            onClick={handleBack}
            className="px-4 py-2 bg-steam-accent text-white rounded hover:bg-steam-accent/80 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Determine cover image with fallbacks
  const coverImage =
    game.coverImageUrl ||
    (game.steamAppId ? getSteamLibraryCover(game.steamAppId) : null) ||
    (game.steamAppId ? getSteamHeader(game.steamAppId) : null);

  return (
    <div className="min-h-screen bg-steam-bg">
      {/* Back button */}
      <div className="sticky top-0 z-10 bg-steam-bg-dark border-b border-steam-border">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-steam-text-muted hover:text-steam-text transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Library
          </button>
        </div>
      </div>

      {/* Hero Section */}
      <div className="bg-steam-bg-dark">
        <div className="max-w-7xl mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row gap-8">
            {/* Cover Image */}
            <div className="flex-shrink-0 w-full md:w-64">
              {coverImage ? (
                <img
                  src={coverImage}
                  alt={game.title}
                  className="w-full rounded shadow-lg"
                  onError={(e) => {
                    // Hide broken image
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                <div className="w-full aspect-[2/3] bg-steam-bg-card rounded flex items-center justify-center">
                  <span className="text-steam-text-muted text-sm text-center px-4">
                    {game.title}
                  </span>
                </div>
              )}
            </div>

            {/* Title + Metadata */}
            <div className="flex-1">
              <h1 className="text-3xl md:text-4xl font-bold text-steam-text mb-4">
                {game.title}
              </h1>

              {/* Metadata grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-6">
                {game.developer && (
                  <div>
                    <span className="text-steam-text-muted">Developer:</span>{' '}
                    <span className="text-steam-text">{game.developer}</span>
                  </div>
                )}
                {game.publisher && (
                  <div>
                    <span className="text-steam-text-muted">Publisher:</span>{' '}
                    <span className="text-steam-text">{game.publisher}</span>
                  </div>
                )}
                <div>
                  <span className="text-steam-text-muted">Release Date:</span>{' '}
                  <span className="text-steam-text">{formatDate(game.releaseDate)}</span>
                </div>
                <div>
                  <span className="text-steam-text-muted">Playtime:</span>{' '}
                  <span className="text-steam-text">{formatPlaytime(game.playtimeMinutes)}</span>
                </div>
              </div>

              {/* Platform Badges */}
              {game.platforms.length > 0 && (
                <div className="flex flex-wrap gap-2 mb-6">
                  {game.platforms.map((platform) => (
                    <PlatformBadge
                      key={platform.id}
                      platform={platform.platformType}
                      size="md"
                    />
                  ))}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap gap-3">
                {game.steamAppId && (
                  <a
                    href={getSteamStoreUrl(game.steamAppId)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-platform-steam text-white rounded hover:opacity-90 transition-opacity"
                  >
                    <img src="/icons/steam.png" alt="Steam" className="w-5 h-5" />
                    View on Steam
                  </a>
                )}
                {game.metacriticUrl && (
                  <a
                    href={game.metacriticUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded hover:opacity-90 transition-opacity"
                  >
                    <span className="font-bold">MC</span>
                    View on Metacritic
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left Column (wider) */}
          <div className="flex-1 min-w-0">
            {/* Screenshots Gallery */}
            {game.screenshots.length > 0 && (
              <section className="mb-8">
                <h2 className="text-xl font-semibold text-steam-text mb-4">Screenshots</h2>
                <ScreenshotsGallery screenshots={game.screenshots} gameTitle={game.title} />
              </section>
            )}

            {/* Description */}
            {(game.description || game.shortDescription) && (
              <section>
                <h2 className="text-xl font-semibold text-steam-text mb-4">About This Game</h2>
                <div
                  className="text-steam-text-muted prose prose-invert max-w-none"
                  dangerouslySetInnerHTML={{
                    __html: game.description || game.shortDescription || '',
                  }}
                />
              </section>
            )}
          </div>

          {/* Right Sidebar */}
          <div className="lg:w-80 flex-shrink-0 space-y-6">
            {/* Ratings Box */}
            <div className="bg-steam-bg-card rounded p-4">
              <h3 className="text-lg font-semibold text-steam-text mb-3">Ratings</h3>
              <div className="space-y-3">
                {game.metacriticScore !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-steam-text-muted">Metacritic</span>
                    <span
                      className={`px-2 py-1 rounded font-bold text-white ${
                        game.metacriticScore >= 75
                          ? 'bg-green-600'
                          : game.metacriticScore >= 50
                            ? 'bg-yellow-600'
                            : 'bg-red-600'
                      }`}
                    >
                      {game.metacriticScore}
                    </span>
                  </div>
                )}
                {game.steamRating !== null && (
                  <div className="flex items-center justify-between">
                    <span className="text-steam-text-muted">Steam Rating</span>
                    <span className="text-steam-accent font-semibold">
                      {Math.round(game.steamRating * 100)}%
                      {game.steamRatingCount && (
                        <span className="text-steam-text-muted text-xs ml-1">
                          ({game.steamRatingCount.toLocaleString()})
                        </span>
                      )}
                    </span>
                  </div>
                )}
                {game.metacriticScore === null && game.steamRating === null && (
                  <p className="text-steam-text-muted text-sm">No ratings available</p>
                )}
              </div>
            </div>

            {/* Genres */}
            {game.genres.length > 0 && (
              <div className="bg-steam-bg-card rounded p-4">
                <h3 className="text-lg font-semibold text-steam-text mb-3">Genres</h3>
                <div className="flex flex-wrap gap-2">
                  {game.genres.map((genre) => (
                    <span
                      key={genre}
                      className="px-2 py-1 bg-steam-bg-light text-steam-text text-sm rounded"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Tags */}
            {game.tags.length > 0 && (
              <div className="bg-steam-bg-card rounded p-4">
                <h3 className="text-lg font-semibold text-steam-text mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                  {game.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-2 py-1 bg-steam-bg text-steam-text-muted text-xs rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
