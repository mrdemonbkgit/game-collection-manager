import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGame } from '../hooks/useGame';
import { useGameAssets } from '../hooks/useGameAssets';
import { useCollections } from '../hooks/useCollections';
import { addGameToCollection } from '../services/collectionsService';
import LoadingSpinner from '../components/LoadingSpinner';
import {
  CinematicHero,
  RatingsCard,
  PlatformsCard,
  MediaCard,
  ScreenshotsCard,
  GenresTagsCard,
  AboutCard,
  SimilarGamesCard,
} from '../components/game-detail';

export default function GameDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { game, loading, error } = useGame(slug);
  const { heroUrl, logoUrl, loading: assetsLoading } = useGameAssets(game?.id);
  const { collections } = useCollections();
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [addingToCollection, setAddingToCollection] = useState<number | null>(null);

  const handleBack = () => {
    navigate(-1);
  };

  const handlePlay = () => {
    if (game?.steamAppId) {
      window.location.href = `steam://run/${game.steamAppId}`;
    }
  };

  const handleAddToCollection = async (collectionId: number) => {
    if (!game) return;
    setAddingToCollection(collectionId);
    try {
      await addGameToCollection(collectionId, game.id);
      setShowCollectionModal(false);
    } catch (err) {
      console.error('Failed to add to collection:', err);
    } finally {
      setAddingToCollection(null);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-steam-bg flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Error state
  if (error || !game) {
    return (
      <div className="min-h-screen bg-steam-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl text-steam-text mb-4">Game Not Found</h1>
          <p className="text-steam-text-muted mb-6">
            {error || 'The game you are looking for does not exist.'}
          </p>
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

  // Filter to only manual collections (not smart filters) for adding games
  const manualCollections = collections.filter((c) => !c.isSmartFilter);

  return (
    <div className="min-h-screen bg-steam-bg">
      {/* Back button - floating on hero */}
      <button
        onClick={handleBack}
        className="fixed top-4 left-4 z-20 flex items-center gap-2 px-3 py-2 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-colors"
        aria-label="Go back"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="hidden sm:inline">Back</span>
      </button>

      {/* Cinematic Hero Section */}
      <CinematicHero
        game={game}
        heroUrl={heroUrl}
        logoUrl={logoUrl}
        assetsLoading={assetsLoading}
        onPlay={handlePlay}
        onAddToCollection={() => setShowCollectionModal(true)}
      />

      {/* Cards Section */}
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-4">
        {/* Row 1: Three equal cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <RatingsCard game={game} />
          <PlatformsCard game={game} />
          <MediaCard gameTitle={game.title} />
        </div>

        {/* Row 2: Screenshots (wide) + Genres (narrow) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2">
            <ScreenshotsCard screenshots={game.screenshots} gameTitle={game.title} />
          </div>
          <GenresTagsCard genres={game.genres} tags={game.tags} />
        </div>

        {/* Row 3: About (full width) */}
        <AboutCard
          description={game.description}
          shortDescription={game.shortDescription}
          developer={game.developer}
          publisher={game.publisher}
          releaseDate={game.releaseDate}
        />

        {/* Row 4: Similar Games */}
        <SimilarGamesCard gameId={game.id} />
      </div>

      {/* Add to Collection Modal */}
      {showCollectionModal && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setShowCollectionModal(false)}
          role="dialog"
          aria-modal="true"
          aria-labelledby="collection-modal-title"
        >
          <div
            className="bg-steam-bg-card rounded-lg p-6 max-w-md w-full max-h-[80vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              id="collection-modal-title"
              className="text-xl font-semibold text-steam-text mb-4"
            >
              Add to Collection
            </h2>

            {manualCollections.length === 0 ? (
              <p className="text-steam-text-muted">
                No collections available. Create a collection first.
              </p>
            ) : (
              <div className="space-y-2">
                {manualCollections.map((collection) => (
                  <button
                    key={collection.id}
                    onClick={() => handleAddToCollection(collection.id)}
                    disabled={addingToCollection !== null}
                    className="w-full flex items-center justify-between p-3 bg-steam-bg hover:bg-steam-bg-light rounded transition-colors disabled:opacity-50"
                  >
                    <span className="text-steam-text">{collection.name}</span>
                    {addingToCollection === collection.id && (
                      <LoadingSpinner />
                    )}
                  </button>
                ))}
              </div>
            )}

            <button
              onClick={() => setShowCollectionModal(false)}
              className="mt-4 w-full py-2 text-steam-text-muted hover:text-steam-text transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
