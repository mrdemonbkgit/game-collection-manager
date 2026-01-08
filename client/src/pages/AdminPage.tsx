import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import {
  importCatalog,
  parseCatalogFile,
  PLATFORM_INFO,
  type CatalogImport,
  type ImportResult,
  type CatalogPlatform,
} from '../services/syncService';

type ImportState = 'idle' | 'parsing' | 'importing' | 'success' | 'error';

export default function AdminPage() {
  const [importState, setImportState] = useState<ImportState>('idle');
  const [catalog, setCatalog] = useState<CatalogImport | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportState('parsing');
    setError(null);
    setResult(null);

    try {
      const parsedCatalog = await parseCatalogFile(file);
      setCatalog(parsedCatalog);
      setImportState('idle');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse file');
      setImportState('error');
      setCatalog(null);
    }

    // Reset file input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImport = async () => {
    if (!catalog) return;

    setImportState('importing');
    setError(null);

    try {
      const importResult = await importCatalog(catalog);
      setResult(importResult);
      setImportState('success');
      setCatalog(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setImportState('error');
    }
  };

  const handleClear = () => {
    setCatalog(null);
    setResult(null);
    setError(null);
    setImportState('idle');
  };

  return (
    <div className="min-h-screen bg-steam-bg">
      {/* Header */}
      <div className="bg-steam-bg-dark border-b border-steam-border">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <h1 className="text-2xl font-bold text-steam-text">Admin</h1>
          <Link
            to="/"
            className="text-steam-text-muted hover:text-steam-text transition-colors"
          >
            Back to Library
          </Link>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Catalog Import Section */}
        <section className="bg-steam-bg-card rounded-lg p-6">
          <h2 className="text-xl font-semibold text-steam-text mb-4">
            Import Subscription Catalog
          </h2>
          <p className="text-steam-text-muted mb-6">
            Import games from Xbox Game Pass, EA Play, or Ubisoft+ using a JSON
            catalog file. Existing games will be linked to the new platform,
            new games will be added to your library.
          </p>

          {/* File Upload */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-steam-text mb-2">
              Select Catalog JSON File
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              disabled={importState === 'importing'}
              className="block w-full text-sm text-steam-text-muted
                file:mr-4 file:py-2 file:px-4
                file:rounded file:border-0
                file:text-sm file:font-medium
                file:bg-steam-accent file:text-white
                hover:file:bg-steam-accent/80
                file:cursor-pointer cursor-pointer
                disabled:opacity-50 disabled:cursor-not-allowed"
            />
          </div>

          {/* Parsing State */}
          {importState === 'parsing' && (
            <div className="flex items-center gap-2 text-steam-text-muted">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Parsing file...
            </div>
          )}

          {/* Catalog Preview */}
          {catalog && importState === 'idle' && (
            <div className="bg-steam-bg rounded p-4 mb-6">
              <h3 className="text-lg font-medium text-steam-text mb-3">
                Catalog Preview
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-steam-text-muted">Platform:</span>{' '}
                  <span
                    className="font-medium px-2 py-0.5 rounded text-white"
                    style={{
                      backgroundColor:
                        PLATFORM_INFO[catalog.platform as CatalogPlatform]
                          ?.color || '#666',
                    }}
                  >
                    {PLATFORM_INFO[catalog.platform as CatalogPlatform]?.label ||
                      catalog.platform}
                  </span>
                </div>
                <div>
                  <span className="text-steam-text-muted">Games:</span>{' '}
                  <span className="text-steam-text font-medium">
                    {catalog.games.length}
                  </span>
                </div>
                {catalog.updated && (
                  <div>
                    <span className="text-steam-text-muted">Updated:</span>{' '}
                    <span className="text-steam-text">{catalog.updated}</span>
                  </div>
                )}
                {catalog.source && (
                  <div className="col-span-2">
                    <span className="text-steam-text-muted">Source:</span>{' '}
                    <span className="text-steam-text text-xs break-all">
                      {catalog.source}
                    </span>
                  </div>
                )}
              </div>

              {/* Sample Games */}
              <div className="mt-4">
                <span className="text-steam-text-muted text-sm">
                  Sample games:
                </span>
                <ul className="mt-1 text-sm text-steam-text">
                  {catalog.games.slice(0, 5).map((game, i) => (
                    <li key={i} className="truncate">
                      {game.title}
                    </li>
                  ))}
                  {catalog.games.length > 5 && (
                    <li className="text-steam-text-muted">
                      ...and {catalog.games.length - 5} more
                    </li>
                  )}
                </ul>
              </div>

              {/* Actions */}
              <div className="mt-4 flex gap-3">
                <button
                  onClick={handleImport}
                  className="px-4 py-2 bg-steam-accent text-white rounded hover:bg-steam-accent/80 transition-colors"
                >
                  Import {catalog.games.length} Games
                </button>
                <button
                  onClick={handleClear}
                  className="px-4 py-2 bg-steam-bg-light text-steam-text rounded hover:bg-steam-border transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Importing State */}
          {importState === 'importing' && (
            <div className="flex items-center gap-2 text-steam-accent">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Importing games...
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="bg-red-900/30 border border-red-700 rounded p-4 mb-6">
              <p className="text-red-400">{error}</p>
              <button
                onClick={handleClear}
                className="mt-2 text-sm text-red-400 hover:text-red-300"
              >
                Try again
              </button>
            </div>
          )}

          {/* Success State */}
          {result && importState === 'success' && (
            <div className="bg-green-900/30 border border-green-700 rounded p-4">
              <h3 className="text-lg font-medium text-green-400 mb-3">
                Import Complete!
              </h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center mb-4">
                <div className="bg-steam-bg rounded p-3">
                  <div className="text-2xl font-bold text-steam-text">
                    {result.total}
                  </div>
                  <div className="text-xs text-steam-text-muted">Total</div>
                </div>
                <div className="bg-steam-bg rounded p-3">
                  <div className="text-2xl font-bold text-green-400">
                    {result.added}
                  </div>
                  <div className="text-xs text-steam-text-muted">Added</div>
                </div>
                <div className="bg-steam-bg rounded p-3">
                  <div className="text-2xl font-bold text-blue-400">
                    {result.linked}
                  </div>
                  <div className="text-xs text-steam-text-muted">Linked</div>
                </div>
                <div className="bg-steam-bg rounded p-3">
                  <div className="text-2xl font-bold text-red-400">
                    {result.errors}
                  </div>
                  <div className="text-xs text-steam-text-muted">Errors</div>
                </div>
              </div>

              {/* Error details */}
              {result.errors > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-medium text-red-400 mb-2">
                    Failed imports:
                  </h4>
                  <ul className="text-sm text-steam-text-muted max-h-32 overflow-y-auto">
                    {result.details
                      .filter((d) => d.status === 'error')
                      .map((d, i) => (
                        <li key={i}>
                          {d.title}: {d.error}
                        </li>
                      ))}
                  </ul>
                </div>
              )}

              <button
                onClick={handleClear}
                className="mt-4 text-sm text-green-400 hover:text-green-300"
              >
                Import another catalog
              </button>
            </div>
          )}
        </section>

        {/* JSON Format Reference */}
        <section className="mt-8 bg-steam-bg-card rounded-lg p-6">
          <h2 className="text-xl font-semibold text-steam-text mb-4">
            Expected JSON Format
          </h2>
          <pre className="bg-steam-bg rounded p-4 text-sm text-steam-text-muted overflow-x-auto">
            {`{
  "platform": "gamepass",  // or "eaplay", "ubisoftplus"
  "updated": "2025-01-07",
  "source": "https://example.com/catalog",
  "games": [
    {
      "title": "Starfield",
      "external_id": "starfield-2023",
      "steam_app_id": null,
      "release_date": "2023-09-06",
      "developer": "Bethesda Game Studios",
      "publisher": "Bethesda Softworks",
      "genres": ["RPG", "Sci-Fi"],
      "description": "Space exploration RPG",
      "cover_url": "https://example.com/cover.jpg"
    }
  ]
}`}
          </pre>
          <p className="mt-4 text-sm text-steam-text-muted">
            <strong>Required fields:</strong> platform, games, games[].title
            <br />
            <strong>Optional fields:</strong> external_id, steam_app_id,
            release_date, developer, publisher, genres, description, cover_url
          </p>
        </section>
      </div>
    </div>
  );
}
