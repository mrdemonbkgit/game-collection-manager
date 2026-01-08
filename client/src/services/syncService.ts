import { fetchApi } from './api';

// Supported platform types for subscription catalogs
export type CatalogPlatform = 'gamepass' | 'eaplay' | 'ubisoftplus';

// Single game entry in the catalog JSON
export interface CatalogGameEntry {
  title: string;
  external_id?: string;
  steam_app_id?: number | null;
  release_date?: string | null;
  developer?: string | null;
  publisher?: string | null;
  genres?: string[];
  description?: string | null;
  cover_url?: string | null;
}

// Full catalog import format
export interface CatalogImport {
  platform: CatalogPlatform;
  updated?: string;
  source?: string;
  games: CatalogGameEntry[];
}

// Import result for a single game
export interface GameImportResult {
  title: string;
  status: 'added' | 'linked' | 'error';
  gameId?: number;
  error?: string;
}

// Overall import result
export interface ImportResult {
  platform: CatalogPlatform;
  total: number;
  added: number;
  linked: number;
  errors: number;
  details: GameImportResult[];
}

// Platform display info
export const PLATFORM_INFO: Record<
  CatalogPlatform,
  { label: string; color: string }
> = {
  gamepass: { label: 'Xbox Game Pass', color: '#107c10' },
  eaplay: { label: 'EA Play', color: '#ff4747' },
  ubisoftplus: { label: 'Ubisoft+', color: '#0070ff' },
};

/**
 * Import a subscription catalog
 */
export async function importCatalog(
  catalog: CatalogImport
): Promise<ImportResult> {
  const response = await fetchApi<{ success: boolean; data: ImportResult }>(
    '/sync/catalog',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(catalog),
    }
  );

  if (!response.data) {
    throw new Error('No data in response');
  }

  return response.data;
}

/**
 * Parse a JSON file and return the catalog
 */
export async function parseCatalogFile(file: File): Promise<CatalogImport> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);

        // Basic validation
        if (!data.platform || !Array.isArray(data.games)) {
          reject(new Error('Invalid catalog format: missing platform or games'));
          return;
        }

        const validPlatforms: CatalogPlatform[] = [
          'gamepass',
          'eaplay',
          'ubisoftplus',
        ];
        if (!validPlatforms.includes(data.platform)) {
          reject(
            new Error(
              `Invalid platform: ${data.platform}. Must be one of: ${validPlatforms.join(', ')}`
            )
          );
          return;
        }

        resolve(data as CatalogImport);
      } catch (error) {
        reject(
          new Error(
            `Failed to parse JSON: ${error instanceof Error ? error.message : 'Unknown error'}`
          )
        );
      }
    };

    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };

    reader.readAsText(file);
  });
}
