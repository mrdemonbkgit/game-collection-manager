import { fetchApi } from './api';

// ============================================================================
// Cover Fix Types
// ============================================================================

export async function fixCoverFromSteamGridDB(
  gameId: number,
  title: string,
  searchTerm?: string
): Promise<{ success: boolean; coverUrl?: string; error?: string }> {
  const response = await fetchApi<{
    success: boolean;
    data: { success: boolean; coverUrl?: string; error?: string };
  }>(`/sync/covers/fix/${gameId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, searchTerm }),
  });
  return response.data;
}

export interface BatchFixProgress {
  completed: number;
  total: number;
  current: string;
}

export interface BatchFixResult {
  total: number;
  success: number;
  failed: number;
  results: Array<{
    success: boolean;
    gameId: number;
    coverUrl?: string;
    error?: string;
  }>;
}

export async function startBatchCoverFix(
  games: Array<{ gameId: number; title: string }>
): Promise<{ message: string; total: number; estimatedSeconds: number }> {
  const response = await fetchApi<{
    success: boolean;
    message: string;
    data: { total: number; estimatedSeconds: number };
  }>('/sync/covers/fix-batch', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ games }),
  });
  return { message: response.message, ...response.data };
}

export async function getBatchFixStatus(): Promise<{
  inProgress: boolean;
  progress: BatchFixProgress | null;
  result: BatchFixResult | null;
  elapsedSeconds: number;
}> {
  const response = await fetchApi<{
    success: boolean;
    data: {
      inProgress: boolean;
      progress: BatchFixProgress | null;
      result: BatchFixResult | null;
      elapsedSeconds: number;
    };
  }>('/sync/covers/fix-batch/status');
  return response.data;
}

// ============================================================================
// Cover Fix History
// ============================================================================

export interface CoverFixHistoryItem {
  gameId: number;
  title: string;
  slug?: string;
  triedGridIds: number[];
  triedUrls: string[];
  attemptCount: number;
  lastTryTime: number;
}

export interface CoverFixHistoryResponse {
  totalGames: number;
  totalAttempts: number;
  items: CoverFixHistoryItem[];
}

export async function getCoverFixHistory(): Promise<CoverFixHistoryResponse> {
  const response = await fetchApi<{
    success: boolean;
    data: CoverFixHistoryResponse;
  }>('/sync/covers/fix-history');
  return response.data;
}

// ============================================================================
// Subscription Catalog Import
// ============================================================================

export type CatalogPlatform = 'gamepass' | 'eaplay' | 'ubisoftplus';

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

export interface CatalogImport {
  platform: CatalogPlatform;
  updated?: string;
  source?: string;
  games: CatalogGameEntry[];
}

export interface GameImportResult {
  title: string;
  status: 'added' | 'linked' | 'error';
  gameId?: number;
  error?: string;
}

export interface ImportResult {
  platform: CatalogPlatform;
  total: number;
  added: number;
  linked: number;
  errors: number;
  details: GameImportResult[];
}

export const PLATFORM_INFO: Record<
  CatalogPlatform,
  { label: string; color: string }
> = {
  gamepass: { label: 'Xbox Game Pass', color: '#107c10' },
  eaplay: { label: 'EA Play', color: '#ff4747' },
  ubisoftplus: { label: 'Ubisoft+', color: '#0070ff' },
};

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

export async function parseCatalogFile(file: File): Promise<CatalogImport> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        const data = JSON.parse(text);

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
