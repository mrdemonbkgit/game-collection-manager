/**
 * Cover Audit Service
 *
 * Orchestrates parallel cover quality audits using Piscina worker pool.
 * Analysis logic is in coverAnalysis.ts, executed in worker threads.
 */

import { Piscina } from 'piscina';
import { fileURLToPath } from 'node:url';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Re-export types from coverAnalysis for consumers
export type { CoverIssue, CoverMetrics, CoverAnalysis } from './coverAnalysis.js';

// Import for direct use (single-threaded fallback, testing)
export { analyzeCover } from './coverAnalysis.js';

// ============================================================================
// Types
// ============================================================================

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

export interface AuditResult {
  total: number;
  passed: number;
  flagged: number;
  failed: number;
  errors: number;
  durationMs: number;
  results: import('./coverAnalysis.js').CoverAnalysis[];
  completedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

const BATCH_SIZE = 50;                      // Images per batch for progress updates

// Score thresholds
const SCORE_PASSED = 70;     // >= 70 = good cover
const SCORE_FLAGGED = 40;    // 40-69 = needs review

// Paths
const COVERS_DIR = path.resolve(process.cwd(), 'data', 'covers');
const RESULTS_FILE = path.resolve(process.cwd(), 'data', 'cover-audit-results.json');

// ============================================================================
// Worker Pool Setup
// ============================================================================

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Detect if running in dev (tsx) or prod (compiled js)
const isDev = __filename.endsWith('.ts');

// Singleton pool - reuse across audits
let pool: Piscina | null = null;

/**
 * Get or create the worker pool
 */
function getPool(): Piscina {
  if (!pool) {
    const maxThreads = process.env.PISCINA_MAX_THREADS
      ? parseInt(process.env.PISCINA_MAX_THREADS, 10)
      : Math.max(1, os.cpus().length - 1);

    pool = new Piscina({
      filename: path.resolve(__dirname, isDev ? 'coverAuditWorker.ts' : 'coverAuditWorker.js'),
      execArgv: isDev ? ['--import', 'tsx'] : [],
      maxThreads,
    });

    console.log(`[CoverAudit] Worker pool created: ${maxThreads} threads (dev=${isDev})`);
  }
  return pool;
}

/**
 * Destroy the worker pool (call on graceful shutdown)
 */
export async function destroyPool(): Promise<void> {
  if (pool) {
    await pool.destroy();
    pool = null;
    console.log('[CoverAudit] Worker pool destroyed');
  }
}

// ============================================================================
// State
// ============================================================================

let auditInProgress = false;
let currentProgress: AuditProgress | null = null;
let cachedResult: AuditResult | null = null;

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all cover files in the covers directory
 */
function getCoverFiles(): { gameId: number; filePath: string }[] {
  if (!fs.existsSync(COVERS_DIR)) {
    return [];
  }

  const files = fs.readdirSync(COVERS_DIR);
  const covers: { gameId: number; filePath: string }[] = [];

  for (const file of files) {
    // Parse gameId from filename (e.g., "123.jpg", "456.png")
    const match = file.match(/^(\d+)\.(jpg|jpeg|png|webp)$/i);
    if (match) {
      covers.push({
        gameId: parseInt(match[1], 10),
        filePath: path.join(COVERS_DIR, file),
      });
    }
  }

  return covers;
}

// ============================================================================
// Main Audit Function
// ============================================================================

/**
 * Run complete cover audit using worker pool
 */
export async function runCoverAudit(
  onProgress?: (progress: AuditProgress) => void
): Promise<AuditResult> {
  if (auditInProgress) {
    throw new Error('Audit already in progress');
  }

  auditInProgress = true;
  const startTime = Date.now();

  try {
    const coverFiles = getCoverFiles();
    const results: import('./coverAnalysis.js').CoverAnalysis[] = [];

    let passed = 0;
    let flagged = 0;
    let failed = 0;
    let errors = 0;

    currentProgress = {
      total: coverFiles.length,
      completed: 0,
      flagged: 0,
      passed: 0,
      failed: 0,
      errors: 0,
      phase: 'phase1',
      estimatedSecondsRemaining: coverFiles.length * 0.02, // ~20ms per image estimate
    };

    // Get worker pool
    const workerPool = getPool();

    // Process in batches for progress updates
    for (let i = 0; i < coverFiles.length; i += BATCH_SIZE) {
      const batch = coverFiles.slice(i, i + BATCH_SIZE);

      // Submit batch to worker pool with Promise.allSettled for error resilience
      const batchResults = await Promise.allSettled(
        batch.map(file => workerPool.run(file))
      );

      // Process results with index-based mapping to correctly attribute failures
      batchResults.forEach((result, idx) => {
        const file = batch[idx];  // Preserve input mapping

        if (result.status === 'fulfilled') {
          const analysis = result.value;
          results.push(analysis);

          if (analysis.issues.includes('corrupt')) {
            errors++;
          } else if (analysis.score >= SCORE_PASSED) {
            passed++;
          } else if (analysis.score >= SCORE_FLAGGED) {
            flagged++;
          } else {
            failed++;
          }
        } else {
          // Worker failed - treat as corrupt
          console.error(`[CoverAudit] Worker failed for game ${file.gameId}:`, result.reason);
          results.push({
            gameId: file.gameId,
            filePath: file.filePath,
            score: 0,
            issues: ['corrupt'],
            metrics: {
              topBandEntropy: 0,
              middleEntropy: 0,
              bottomBandEntropy: 0,
              entropyRatio: 0,
              topColorVariance: 0,
              bottomColorVariance: 0,
              horizontalEdgeScore: 0,
            },
            flaggedForReview: true,
            analyzedAt: new Date().toISOString(),
          });
          errors++;
        }
      });

      // Update progress
      const completed = Math.min(i + BATCH_SIZE, coverFiles.length);
      const elapsed = (Date.now() - startTime) / 1000;
      const rate = completed / elapsed;
      const remaining = coverFiles.length - completed;

      currentProgress = {
        total: coverFiles.length,
        completed,
        flagged,
        passed,
        failed,
        errors,
        phase: completed === coverFiles.length ? 'complete' : 'phase1',
        estimatedSecondsRemaining: rate > 0 ? remaining / rate : 0,
      };

      if (onProgress) {
        onProgress(currentProgress);
      }
    }

    // Sort results by score (worst first)
    results.sort((a, b) => a.score - b.score);

    const auditResult: AuditResult = {
      total: coverFiles.length,
      passed,
      flagged,
      failed,
      errors,
      durationMs: Date.now() - startTime,
      results,
      completedAt: new Date().toISOString(),
    };

    // Cache and save results
    cachedResult = auditResult;
    saveAuditResults(auditResult);

    currentProgress = {
      ...currentProgress!,
      phase: 'complete',
      estimatedSecondsRemaining: 0,
    };

    return auditResult;
  } finally {
    auditInProgress = false;
  }
}

// ============================================================================
// Cache Functions
// ============================================================================

/**
 * Save audit results to JSON file
 */
export function saveAuditResults(results: AuditResult): void {
  const dataDir = path.dirname(RESULTS_FILE);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  fs.writeFileSync(RESULTS_FILE, JSON.stringify(results, null, 2));
}

/**
 * Load cached audit results from JSON file
 */
export function getCachedAuditResults(): AuditResult | null {
  if (cachedResult) {
    return cachedResult;
  }

  if (fs.existsSync(RESULTS_FILE)) {
    try {
      const data = fs.readFileSync(RESULTS_FILE, 'utf-8');
      cachedResult = JSON.parse(data) as AuditResult;
      return cachedResult;
    } catch {
      return null;
    }
  }

  return null;
}

/**
 * Get bad covers (below threshold score)
 */
export function getBadCovers(threshold: number = SCORE_FLAGGED): import('./coverAnalysis.js').CoverAnalysis[] {
  const results = getCachedAuditResults();
  if (!results) {
    return [];
  }

  return results.results.filter(r => r.score < threshold);
}

/**
 * Check if audit is currently in progress
 */
export function isAuditInProgress(): boolean {
  return auditInProgress;
}

/**
 * Get current audit progress
 */
export function getAuditProgress(): AuditProgress | null {
  return currentProgress;
}

/**
 * Clear cached results
 */
export function clearAuditCache(): void {
  cachedResult = null;
  currentProgress = null;
  if (fs.existsSync(RESULTS_FILE)) {
    fs.unlinkSync(RESULTS_FILE);
  }
}
