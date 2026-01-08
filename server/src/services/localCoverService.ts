/**
 * Local Cover Caching Service
 *
 * Downloads cover images from remote URLs and caches them locally.
 * Serves covers from ./data/covers/ directory.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

// Covers directory relative to project root
const COVERS_DIR = path.resolve(process.cwd(), 'data', 'covers');

// Ensure covers directory exists
export function ensureCoversDir(): void {
  if (!fs.existsSync(COVERS_DIR)) {
    fs.mkdirSync(COVERS_DIR, { recursive: true });
    console.log(`Created covers directory: ${COVERS_DIR}`);
  }
}

/**
 * Generate a local filename from game ID and URL
 * Format: {gameId}.{extension}
 */
function getLocalFilename(gameId: number, remoteUrl: string): string {
  // Extract extension from URL
  const urlPath = new URL(remoteUrl).pathname;
  const ext = path.extname(urlPath) || '.jpg';
  return `${gameId}${ext}`;
}

/**
 * Get the local file path for a game's cover
 */
export function getLocalCoverPath(gameId: number, remoteUrl: string): string {
  const filename = getLocalFilename(gameId, remoteUrl);
  return path.join(COVERS_DIR, filename);
}

/**
 * Check if a local cover exists for a game
 */
export function hasLocalCover(gameId: number): string | null {
  // Check for common extensions
  const extensions = ['.jpg', '.jpeg', '.png', '.webp'];
  for (const ext of extensions) {
    const filePath = path.join(COVERS_DIR, `${gameId}${ext}`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

/**
 * Get the local cover URL for a game (relative to /covers/ route)
 */
export function getLocalCoverUrl(gameId: number): string | null {
  const localPath = hasLocalCover(gameId);
  if (localPath) {
    const filename = path.basename(localPath);
    return `/covers/${filename}`;
  }
  return null;
}

/**
 * Download a cover image from a remote URL and cache it locally
 */
export async function downloadCover(
  gameId: number,
  remoteUrl: string
): Promise<{ success: boolean; localPath?: string; error?: string }> {
  ensureCoversDir();

  try {
    // Fetch the image
    const response = await fetch(remoteUrl, {
      headers: {
        'User-Agent': 'GameCollection/1.0',
      },
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // Determine extension from content-type or URL
    const contentType = response.headers.get('content-type') || '';
    let ext = '.jpg';
    if (contentType.includes('png')) ext = '.png';
    else if (contentType.includes('webp')) ext = '.webp';
    else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
    else {
      // Fallback to URL extension
      const urlExt = path.extname(new URL(remoteUrl).pathname);
      if (urlExt) ext = urlExt;
    }

    const localPath = path.join(COVERS_DIR, `${gameId}${ext}`);

    // Remove existing cover with different extension
    const existingCover = hasLocalCover(gameId);
    if (existingCover && existingCover !== localPath) {
      fs.unlinkSync(existingCover);
    }

    // Stream the image to disk
    const body = response.body;
    if (!body) {
      return { success: false, error: 'No response body' };
    }

    const writeStream = fs.createWriteStream(localPath);
    await pipeline(Readable.fromWeb(body as never), writeStream);

    return { success: true, localPath };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Download covers for multiple games
 */
export async function downloadCovers(
  games: Array<{ id: number; coverUrl: string }>,
  onProgress?: (completed: number, total: number, current: string) => void
): Promise<{
  total: number;
  success: number;
  failed: number;
  skipped: number;
  errors: Array<{ gameId: number; error: string }>;
}> {
  ensureCoversDir();

  const result = {
    total: games.length,
    success: 0,
    failed: 0,
    skipped: 0,
    errors: [] as Array<{ gameId: number; error: string }>,
  };

  for (let i = 0; i < games.length; i++) {
    const game = games[i];

    if (onProgress) {
      onProgress(i, games.length, `Game ${game.id}`);
    }

    // Skip if already cached
    if (hasLocalCover(game.id)) {
      result.skipped++;
      continue;
    }

    // Skip if no cover URL
    if (!game.coverUrl) {
      result.skipped++;
      continue;
    }

    const downloadResult = await downloadCover(game.id, game.coverUrl);

    if (downloadResult.success) {
      result.success++;
    } else {
      result.failed++;
      result.errors.push({
        gameId: game.id,
        error: downloadResult.error || 'Unknown error',
      });
    }

    // Small delay to avoid overwhelming servers
    await new Promise((resolve) => setTimeout(resolve, 50));
  }

  if (onProgress) {
    onProgress(games.length, games.length, 'Done');
  }

  return result;
}

/**
 * Get stats about local cover cache
 */
export function getCacheStats(): {
  totalFiles: number;
  totalSizeBytes: number;
  totalSizeMB: string;
} {
  ensureCoversDir();

  const files = fs.readdirSync(COVERS_DIR);
  let totalSize = 0;

  for (const file of files) {
    const filePath = path.join(COVERS_DIR, file);
    const stat = fs.statSync(filePath);
    if (stat.isFile()) {
      totalSize += stat.size;
    }
  }

  return {
    totalFiles: files.length,
    totalSizeBytes: totalSize,
    totalSizeMB: (totalSize / 1024 / 1024).toFixed(2),
  };
}

/**
 * Clear the cover cache
 */
export function clearCache(): { deleted: number } {
  ensureCoversDir();

  const files = fs.readdirSync(COVERS_DIR);
  let deleted = 0;

  for (const file of files) {
    const filePath = path.join(COVERS_DIR, file);
    fs.unlinkSync(filePath);
    deleted++;
  }

  return { deleted };
}
