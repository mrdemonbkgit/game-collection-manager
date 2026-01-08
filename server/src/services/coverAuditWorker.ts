/**
 * Cover Audit Worker
 *
 * Piscina worker thread for parallel cover analysis.
 * Imports shared analysis logic from coverAnalysis.ts.
 */

import sharp from 'sharp';
import { analyzeCover, type CoverAnalysis } from './coverAnalysis.js';

// Limit sharp to 1 thread per worker to avoid CPU oversubscription
// Each worker runs in its own thread, so we don't need sharp's internal threading
sharp.concurrency(1);

interface WorkerInput {
  gameId: number;
  filePath: string;
}

/**
 * Worker entry point - Piscina expects a default export
 */
export default async function(input: WorkerInput): Promise<CoverAnalysis> {
  return analyzeCover(input.gameId, input.filePath);
}
