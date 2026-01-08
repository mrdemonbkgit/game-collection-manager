/**
 * Cover Audit Service
 *
 * Detects "bad" game covers - specifically landscape images stretched/filled
 * to portrait (600x900) format with blurred/uniform pillarbox bands.
 *
 * Two-phase detection:
 * - Phase 1: Quick entropy scan to flag suspicious covers
 * - Phase 2: Detailed analysis with edge detection on flagged images
 */

import sharp from 'sharp';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ============================================================================
// Types
// ============================================================================

export type CoverIssue =
  | 'pillarbox_fill'      // Top/bottom uniform fill bands (-40 pts)
  | 'low_entropy_edges'   // Edge regions have low information (-15 pts/band)
  | 'horizontal_boundary' // Detected fill boundary lines (-20 pts)
  | 'corrupt';            // Image failed to load (0 pts)

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
  score: number;           // 0-100
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
  currentFile?: string;
}

export interface AuditResult {
  total: number;
  passed: number;
  flagged: number;
  failed: number;
  errors: number;
  durationMs: number;
  results: CoverAnalysis[];
  completedAt: string;
}

// ============================================================================
// Constants
// ============================================================================

const BAND_HEIGHT = 100;                    // Top/bottom analysis bands
const ENTROPY_RATIO_THRESHOLD = 1.5;        // Middle 1.5x more entropy = suspicious
const COLOR_VARIANCE_THRESHOLD = 500;       // Low variance = uniform fill
const EDGE_SCORE_THRESHOLD = 0.3;           // Horizontal edge prominence
const BATCH_SIZE = 50;                      // Images per batch

// Score thresholds
const SCORE_PASSED = 70;     // >= 70 = good cover
const SCORE_FLAGGED = 40;    // 40-69 = needs review

// Penalty points
const PENALTY_PILLARBOX = 40;
const PENALTY_LOW_ENTROPY_EDGE = 15;  // Per band (top/bottom)
const PENALTY_HORIZONTAL_BOUNDARY = 20;

// Paths
const COVERS_DIR = path.resolve(process.cwd(), 'data', 'covers');
const RESULTS_FILE = path.resolve(process.cwd(), 'data', 'cover-audit-results.json');

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
 * Get band statistics (entropy/variance) for a horizontal band of the image
 * Returns sum of standard deviations across all color channels
 *
 * NOTE: Must extract to buffer first, then get stats from buffer.
 * Sharp's stats() after extract() without toBuffer() returns stats
 * for the original image, not the extracted region.
 */
async function getBandStats(
  imagePath: string,
  top: number,
  height: number,
  imageWidth: number
): Promise<number> {
  // Extract the band to a buffer first
  const buffer = await sharp(imagePath)
    .extract({ left: 0, top, width: imageWidth, height })
    .toBuffer();

  // Get stats from the extracted buffer
  const stats = await sharp(buffer).stats();

  // Sum of standard deviations across all channels
  // Higher stdev = more variation/detail in the image region
  return stats.channels.reduce((sum, ch) => sum + (ch.stdev || 0), 0);
}

/**
 * Detect horizontal edges at likely fill boundary positions
 * Returns a score 0-1 where higher = more prominent horizontal edges
 */
async function detectHorizontalEdges(imagePath: string): Promise<number> {
  try {
    // Get image dimensions first
    const metadata = await sharp(imagePath).metadata();
    if (!metadata.width || !metadata.height) return 0;

    // Sample rows at typical fill boundary positions (where letterbox meets content)
    // These are usually around 1/4 and 3/4 height for landscape->portrait fills
    const boundaryRows = [
      Math.floor(metadata.height * 0.2),
      Math.floor(metadata.height * 0.25),
      Math.floor(metadata.height * 0.75),
      Math.floor(metadata.height * 0.8),
    ];

    let totalEdgeStrength = 0;

    for (const row of boundaryRows) {
      if (row < 5 || row >= metadata.height - 5) continue;

      // Get 3 rows for gradient calculation
      const bandAbove = await sharp(imagePath)
        .extract({ left: 0, top: row - 2, width: metadata.width, height: 1 })
        .grayscale()
        .raw()
        .toBuffer();

      const bandBelow = await sharp(imagePath)
        .extract({ left: 0, top: row + 2, width: metadata.width, height: 1 })
        .grayscale()
        .raw()
        .toBuffer();

      // Calculate vertical gradient (Sobel-like)
      let gradientSum = 0;
      for (let x = 0; x < Math.min(bandAbove.length, bandBelow.length); x++) {
        gradientSum += Math.abs(bandAbove[x] - bandBelow[x]);
      }

      // Normalize by width
      const avgGradient = gradientSum / metadata.width / 255;
      totalEdgeStrength = Math.max(totalEdgeStrength, avgGradient);
    }

    return totalEdgeStrength;
  } catch {
    return 0;
  }
}

/**
 * Quick Phase 1 analysis - entropy scan only
 */
async function quickAnalysis(imagePath: string): Promise<{
  suspicious: boolean;
  topEntropy: number;
  middleEntropy: number;
  bottomEntropy: number;
  ratio: number;
  imageWidth: number;
  imageHeight: number;
}> {
  const metadata = await sharp(imagePath).metadata();
  if (!metadata.width || !metadata.height) {
    return {
      suspicious: false,
      topEntropy: 0,
      middleEntropy: 0,
      bottomEntropy: 0,
      ratio: 1,
      imageWidth: 0,
      imageHeight: 0,
    };
  }

  const imageWidth = metadata.width;
  const imageHeight = metadata.height;

  // For smaller images, adjust band positions
  const topBandStart = 0;
  const middleBandStart = Math.floor(imageHeight * 0.4);
  const bottomBandStart = Math.max(0, imageHeight - BAND_HEIGHT);
  const bandHeight = Math.min(BAND_HEIGHT, Math.floor(imageHeight / 3));

  const [topEntropy, middleEntropy, bottomEntropy] = await Promise.all([
    getBandStats(imagePath, topBandStart, bandHeight, imageWidth),
    getBandStats(imagePath, middleBandStart, bandHeight, imageWidth),
    getBandStats(imagePath, bottomBandStart, bandHeight, imageWidth),
  ]);

  // Calculate ratio: middle vs edges
  const edgeAvg = (topEntropy + bottomEntropy) / 2;
  const ratio = edgeAvg > 0 ? middleEntropy / edgeAvg : 1;

  return {
    suspicious: ratio > ENTROPY_RATIO_THRESHOLD,
    topEntropy,
    middleEntropy,
    bottomEntropy,
    ratio,
    imageWidth,
    imageHeight,
  };
}

/**
 * Full Phase 2 analysis - color variance and edge detection
 */
async function detailedAnalysis(
  imagePath: string,
  imageWidth: number,
  imageHeight: number
): Promise<{
  topVariance: number;
  bottomVariance: number;
  horizontalEdgeScore: number;
}> {
  const bandHeight = Math.min(BAND_HEIGHT, Math.floor(imageHeight / 3));
  const bottomBandStart = Math.max(0, imageHeight - bandHeight);

  const [topVariance, bottomVariance, horizontalEdgeScore] = await Promise.all([
    getBandStats(imagePath, 0, bandHeight, imageWidth),
    getBandStats(imagePath, bottomBandStart, bandHeight, imageWidth),
    detectHorizontalEdges(imagePath),
  ]);

  return { topVariance, bottomVariance, horizontalEdgeScore };
}

/**
 * Calculate final score and issues based on metrics
 */
function calculateScore(metrics: CoverMetrics): { score: number; issues: CoverIssue[] } {
  let score = 100;
  const issues: CoverIssue[] = [];

  // Check for pillarbox fill pattern
  // High entropy in middle, low in edges = likely pillarbox
  if (metrics.entropyRatio > ENTROPY_RATIO_THRESHOLD) {
    const lowTopEntropy = metrics.topBandEntropy < 50;
    const lowBottomEntropy = metrics.bottomBandEntropy < 50;
    const lowTopVariance = metrics.topColorVariance < COLOR_VARIANCE_THRESHOLD;
    const lowBottomVariance = metrics.bottomColorVariance < COLOR_VARIANCE_THRESHOLD;

    if ((lowTopEntropy && lowTopVariance) || (lowBottomEntropy && lowBottomVariance)) {
      score -= PENALTY_PILLARBOX;
      issues.push('pillarbox_fill');
    }
  }

  // Check for low entropy edges (even without pillarbox pattern)
  if (metrics.topBandEntropy < 30 && metrics.topColorVariance < 300) {
    score -= PENALTY_LOW_ENTROPY_EDGE;
    if (!issues.includes('low_entropy_edges')) {
      issues.push('low_entropy_edges');
    }
  }
  if (metrics.bottomBandEntropy < 30 && metrics.bottomColorVariance < 300) {
    score -= PENALTY_LOW_ENTROPY_EDGE;
    if (!issues.includes('low_entropy_edges')) {
      issues.push('low_entropy_edges');
    }
  }

  // Check for horizontal boundary lines
  if (metrics.horizontalEdgeScore > EDGE_SCORE_THRESHOLD) {
    score -= PENALTY_HORIZONTAL_BOUNDARY;
    issues.push('horizontal_boundary');
  }

  return { score: Math.max(0, score), issues };
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Analyze a single cover image
 */
export async function analyzeCover(gameId: number, filePath: string): Promise<CoverAnalysis> {
  const now = new Date().toISOString();

  try {
    // Verify file exists and is readable
    if (!fs.existsSync(filePath)) {
      return {
        gameId,
        filePath,
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
        analyzedAt: now,
      };
    }

    // Phase 1: Quick entropy analysis
    const quick = await quickAnalysis(filePath);

    // Phase 2: Detailed analysis (only for suspicious covers)
    let detailed = { topVariance: 0, bottomVariance: 0, horizontalEdgeScore: 0 };
    if (quick.suspicious && quick.imageWidth > 0 && quick.imageHeight > 0) {
      detailed = await detailedAnalysis(filePath, quick.imageWidth, quick.imageHeight);
    }

    // Combine metrics
    const metrics: CoverMetrics = {
      topBandEntropy: quick.topEntropy,
      middleEntropy: quick.middleEntropy,
      bottomBandEntropy: quick.bottomEntropy,
      entropyRatio: quick.ratio,
      topColorVariance: detailed.topVariance,
      bottomColorVariance: detailed.bottomVariance,
      horizontalEdgeScore: detailed.horizontalEdgeScore,
    };

    // Calculate score and issues
    const { score, issues } = calculateScore(metrics);

    return {
      gameId,
      filePath,
      score,
      issues,
      metrics,
      flaggedForReview: score < SCORE_PASSED,
      analyzedAt: now,
    };
  } catch (error) {
    console.error(`Error analyzing cover ${filePath}:`, error);
    return {
      gameId,
      filePath,
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
      analyzedAt: now,
    };
  }
}

// ============================================================================
// Batch Processing
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

/**
 * Run complete cover audit
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
    const results: CoverAnalysis[] = [];

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

    // Process in batches
    for (let i = 0; i < coverFiles.length; i += BATCH_SIZE) {
      const batch = coverFiles.slice(i, i + BATCH_SIZE);

      const batchResults = await Promise.all(
        batch.map(async ({ gameId, filePath }) => {
          currentProgress!.currentFile = filePath;
          return analyzeCover(gameId, filePath);
        })
      );

      for (const result of batchResults) {
        results.push(result);

        if (result.issues.includes('corrupt')) {
          errors++;
        } else if (result.score >= SCORE_PASSED) {
          passed++;
        } else if (result.score >= SCORE_FLAGGED) {
          flagged++;
        } else {
          failed++;
        }
      }

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
        currentFile: undefined,
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
export function getBadCovers(threshold: number = SCORE_FLAGGED): CoverAnalysis[] {
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
