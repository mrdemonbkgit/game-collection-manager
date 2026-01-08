/**
 * Cover Migration Service
 *
 * Migrates Steam game covers from horizontal (header.jpg) to vertical (library_600x900) format.
 */

import { getDatabase } from '../db/connection.js';

export interface MigrationProgress {
  total: number;
  completed: number;
  updated: number;
  skipped: number;
  currentGame: string;
}

export interface MigrationResult {
  total: number;
  updated: number;
  skipped: number;
  failed: number;
}

/**
 * Check if a URL returns a valid image
 */
async function checkImageExists(url: string): Promise<boolean> {
  try {
    const response = await fetch(url, { method: 'HEAD' });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Get all possible vertical cover URLs for a Steam app (in order of preference)
 */
function getVerticalCoverUrls(steamAppId: number): string[] {
  return [
    `https://steamcdn-a.akamaihd.net/steam/apps/${steamAppId}/library_600x900_2x.jpg`,
    `https://steamcdn-a.akamaihd.net/steam/apps/${steamAppId}/library_600x900.jpg`,
    `https://steamcdn-a.akamaihd.net/steam/apps/${steamAppId}/portrait.png`,
  ];
}

/**
 * Find the first working vertical cover URL for a Steam app
 */
async function findVerticalCoverUrl(steamAppId: number): Promise<string | null> {
  const urls = getVerticalCoverUrls(steamAppId);

  for (const url of urls) {
    if (await checkImageExists(url)) {
      return url;
    }
  }

  return null;
}

/**
 * Migrate all Steam games from horizontal to vertical covers
 */
export async function migrateToVerticalCovers(
  onProgress?: (progress: MigrationProgress) => void
): Promise<MigrationResult> {
  const db = getDatabase();

  // Get all games with Steam App IDs that have horizontal covers
  const stmt = db.prepare(`
    SELECT id, title, steam_app_id, cover_image_url
    FROM games
    WHERE steam_app_id IS NOT NULL
    AND cover_image_url LIKE '%header.jpg%'
    ORDER BY title
  `);

  const games = stmt.all() as Array<{
    id: number;
    title: string;
    steam_app_id: number;
    cover_image_url: string;
  }>;

  const result: MigrationResult = {
    total: games.length,
    updated: 0,
    skipped: 0,
    failed: 0,
  };

  const updateStmt = db.prepare(`
    UPDATE games SET cover_image_url = ?, updated_at = datetime('now')
    WHERE id = ?
  `);

  for (let i = 0; i < games.length; i++) {
    const game = games[i];

    if (onProgress) {
      onProgress({
        total: games.length,
        completed: i,
        updated: result.updated,
        skipped: result.skipped,
        currentGame: game.title,
      });
    }

    // Rate limit - be nice to Steam CDN
    if (i > 0 && i % 10 === 0) {
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Try all vertical cover formats
    const verticalUrl = await findVerticalCoverUrl(game.steam_app_id);

    if (verticalUrl) {
      updateStmt.run(verticalUrl, game.id);
      result.updated++;
    } else {
      // Keep the horizontal cover
      result.skipped++;
    }
  }

  // Final progress
  if (onProgress) {
    onProgress({
      total: games.length,
      completed: games.length,
      updated: result.updated,
      skipped: result.skipped,
      currentGame: 'Done',
    });
  }

  return result;
}
