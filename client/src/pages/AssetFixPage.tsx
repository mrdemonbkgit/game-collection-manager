import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useGame } from '../hooks/useGame';
import { useHeroOptions } from '../hooks/useHeroOptions';
import { useLogoOptions } from '../hooks/useLogoOptions';
import { saveGameAssets } from '../services/gamesService';
import { AssetPreview } from '../components/asset-fix/AssetPreview';
import { AssetSelector } from '../components/asset-fix/AssetSelector';
import LoadingSpinner from '../components/LoadingSpinner';

export default function AssetFixPage() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { game, loading: gameLoading, error: gameError } = useGame(slug);

  // Separate hooks for independent pagination
  const heroOptions = useHeroOptions(game?.id);
  const logoOptions = useLogoOptions(game?.id);

  // Track selected asset IDs and preview URLs
  const [selectedHeroId, setSelectedHeroId] = useState<number | null>(null);
  const [selectedLogoId, setSelectedLogoId] = useState<number | null>(null);
  const [heroPreviewUrl, setHeroPreviewUrl] = useState<string | null>(null);
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Initialize with current assets when they load
  useEffect(() => {
    if (heroOptions.currentAssetId && selectedHeroId === null) {
      setSelectedHeroId(heroOptions.currentAssetId);
    }
    if (heroOptions.currentLocalUrl && heroPreviewUrl === null) {
      setHeroPreviewUrl(heroOptions.currentLocalUrl);
    }
  }, [heroOptions.currentAssetId, heroOptions.currentLocalUrl, selectedHeroId, heroPreviewUrl]);

  useEffect(() => {
    if (logoOptions.currentAssetId && selectedLogoId === null) {
      setSelectedLogoId(logoOptions.currentAssetId);
    }
    if (logoOptions.currentLocalUrl && logoPreviewUrl === null) {
      setLogoPreviewUrl(logoOptions.currentLocalUrl);
    }
  }, [logoOptions.currentAssetId, logoOptions.currentLocalUrl, selectedLogoId, logoPreviewUrl]);

  const handleSelectHero = (id: number, previewUrl: string) => {
    setSelectedHeroId(id);
    setHeroPreviewUrl(previewUrl);
  };

  const handleSelectLogo = (id: number, previewUrl: string) => {
    setSelectedLogoId(id);
    setLogoPreviewUrl(previewUrl);
  };

  const handleSave = async () => {
    if (!game) return;
    setSaving(true);
    setSaveError(null);

    try {
      const result = await saveGameAssets(game.id, {
        heroAssetId: selectedHeroId ?? undefined,
        logoAssetId: selectedLogoId ?? undefined,
      });

      if (result.errors?.length) {
        setSaveError(result.errors.join(', '));
      } else {
        navigate(`/game/${slug}`);
      }
    } catch (err) {
      setSaveError('Failed to save assets');
    } finally {
      setSaving(false);
    }
  };

  // Determine if there are unsaved changes
  const hasChanges =
    (selectedHeroId !== null && selectedHeroId !== heroOptions.currentAssetId) ||
    (selectedLogoId !== null && selectedLogoId !== logoOptions.currentAssetId);

  // Loading state
  if (gameLoading) {
    return (
      <div className="min-h-screen bg-steam-bg flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Error state
  if (gameError || !game) {
    return (
      <div className="min-h-screen bg-steam-bg flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl text-steam-text mb-4">Game Not Found</h1>
          <p className="text-steam-text-muted mb-6">
            {gameError || 'The game you are looking for does not exist.'}
          </p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-steam-accent text-white rounded hover:bg-steam-accent/80 transition-colors"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-steam-bg">
      {/* Back Button */}
      <Link
        to={`/game/${slug}`}
        className="fixed top-4 left-4 z-20 flex items-center gap-2 px-3 py-2 bg-black/50 hover:bg-black/70 text-white rounded-lg backdrop-blur-sm transition-colors"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        <span className="hidden sm:inline">Back to Game</span>
      </Link>

      {/* Live Preview */}
      <AssetPreview
        game={game}
        heroUrl={heroPreviewUrl}
        logoUrl={logoPreviewUrl}
      />

      {/* Selection Cards */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <AssetSelector
            title="Choose Logo"
            options={logoOptions.options}
            selectedId={selectedLogoId}
            currentAssetId={logoOptions.currentAssetId}
            onSelect={handleSelectLogo}
            onLoadMore={logoOptions.fetchMore}
            hasMore={logoOptions.hasMore}
            loading={logoOptions.loading}
            total={logoOptions.total}
            aspectRatio="square"
            error={logoOptions.error}
          />
          <AssetSelector
            title="Choose Hero"
            options={heroOptions.options}
            selectedId={selectedHeroId}
            currentAssetId={heroOptions.currentAssetId}
            onSelect={handleSelectHero}
            onLoadMore={heroOptions.fetchMore}
            hasMore={heroOptions.hasMore}
            loading={heroOptions.loading}
            total={heroOptions.total}
            aspectRatio="wide"
            error={heroOptions.error}
          />
        </div>

        {/* Error Message */}
        {saveError && (
          <div className="mt-4 p-3 bg-red-900/50 border border-red-700/50 text-red-200 rounded">
            {saveError}
          </div>
        )}

        {/* Save Button */}
        <div className="mt-6">
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges}
            className="w-full py-3 bg-steam-accent hover:bg-steam-accent/80 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : hasChanges ? 'Save Changes' : 'No Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
