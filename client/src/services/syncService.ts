import { fetchApi } from './api';

// ============================================================================
// Cover Audit Types
// ============================================================================

export type CoverIssue =
  | 'pillarbox_fill'
  | 'low_entropy_edges'
  | 'horizontal_boundary'
  | 'corrupt';

export interface CoverMetrics {
  topBandEntropy: number;
  middleEntropy: number;
  bottomBandEntropy: number;
  entropyRatio: number;
  topColorVariance: number;
  bottomColorVariance: number;
  horizontalEdgeScore: number;
}

export interface CoverAnalysis {
  gameId: number;
  filePath: string;
  score: number;
  issues: CoverIssue[];
  metrics: CoverMetrics;
  flaggedForReview: boolean;
  analyzedAt: string;
}

export interface AuditProgress {
  total: number;
  completed: number;
  flagged: number;
  passed: number;
  failed: number;
  errors: number;
  phase: 'phase1' | 'phase2' | 'complete';
  estimatedSecondsRemaining: number;
}

export interface AuditSummary {
  total: number;
  passed: number;
  flagged: number;
  failed: number;
  errors: number;
  durationMs: number;
  completedAt: string;
}

export interface AuditResultsResponse {
  summary: AuditSummary;
  results: CoverAnalysis[];
  pagination: {
    limit: number;
    offset: number;
    filteredTotal: number;
  };
}

// ============================================================================
// Cover Audit API Functions
// ============================================================================

export async function startCoverAudit(): Promise<{ message: string }> {
  const response = await fetchApi<{ success: boolean; data?: { message: string }; message?: string }>(
    '/sync/covers/audit',
    { method: 'POST' }
  );
  return { message: response.message || 'Audit started' };
}

export async function getCoverAuditStatus(): Promise<{
  inProgress: boolean;
  progress: AuditProgress | null;
  elapsedSeconds: number;
}> {
  const response = await fetchApi<{
    success: boolean;
    data: {
      inProgress: boolean;
      progress: AuditProgress | null;
      elapsedSeconds: number;
    };
  }>('/sync/covers/audit/status');
  return response.data;
}

export async function getCoverAuditResults(
  options: { minScore?: number; maxScore?: number; limit?: number; offset?: number } = {}
): Promise<AuditResultsResponse> {
  const params = new URLSearchParams();
  if (options.minScore !== undefined) params.set('minScore', String(options.minScore));
  if (options.maxScore !== undefined) params.set('maxScore', String(options.maxScore));
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.offset !== undefined) params.set('offset', String(options.offset));

  const response = await fetchApi<{ success: boolean; data: AuditResultsResponse }>(
    `/sync/covers/audit/results?${params.toString()}`
  );
  return response.data;
}

export async function getBadCovers(threshold: number = 40): Promise<{
  threshold: number;
  count: number;
  covers: CoverAnalysis[];
}> {
  const response = await fetchApi<{
    success: boolean;
    data: { threshold: number; count: number; covers: CoverAnalysis[] };
  }>(`/sync/covers/audit/bad?threshold=${threshold}`);
  return response.data;
}

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
