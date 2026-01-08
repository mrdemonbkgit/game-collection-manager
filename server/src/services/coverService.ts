/**
 * Cover Image Service
 *
 * Searches Steam for games and fetches cover images for games without covers.
 * Uses Steam's search API and CDN - no API key required.
 */

import {
  getGamesWithoutCovers,
  updateGameCover,
} from '../db/repositories/gameRepository.js';

// Steam search response type
interface SteamSearchResult {
  id: number;
  name: string;
  tiny_image: string;
}

interface SteamSearchResponse {
  total: number;
  items: SteamSearchResult[];
}

// Rate limiting - be respectful to Steam
const RATE_LIMIT_DELAY = 500; // 0.5 seconds between requests

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Normalize a game title for comparison
 */
function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/['']/g, "'") // Normalize apostrophes
    .replace(/[®™©]/g, '') // Remove trademark symbols
    .replace(/[:\-–—]/g, ' ') // Replace colons/dashes with spaces
    .replace(/\s+/g, ' ') // Collapse whitespace
    .replace(/[^a-z0-9\s']/g, '') // Remove special chars
    .trim();
}

/**
 * Check if two titles are a good match
 */
function titlesMatch(title1: string, title2: string): boolean {
  const norm1 = normalizeTitle(title1);
  const norm2 = normalizeTitle(title2);

  // Exact match after normalization
  if (norm1 === norm2) return true;

  // One contains the other (for subtitle differences)
  if (norm1.includes(norm2) || norm2.includes(norm1)) {
    // Make sure it's not too short to be meaningful
    const shorter = norm1.length < norm2.length ? norm1 : norm2;
    if (shorter.length >= 5) return true;
  }

  return false;
}

/**
 * Search Steam for a game by title
 */
async function searchSteamForGame(title: string): Promise<{ appId: number; name: string } | null> {
  try {
    // Use Steam's store search API
    const searchUrl = `https://store.steampowered.com/api/storesearch/?term=${encodeURIComponent(title)}&l=english&cc=US`;

    const response = await fetch(searchUrl);

    if (!response.ok) {
      console.warn(`Steam search failed for "${title}": ${response.status}`);
      return null;
    }

    const data = await response.json() as SteamSearchResponse;

    if (!data.items || data.items.length === 0) {
      return null;
    }

    // Find best match
    for (const item of data.items) {
      if (titlesMatch(title, item.name)) {
        return {
          appId: item.id,
          name: item.name,
        };
      }
    }

    // If no exact match, check if first result is close enough
    const firstResult = data.items[0];
    const norm1 = normalizeTitle(title);
    const norm2 = normalizeTitle(firstResult.name);

    // Calculate simple similarity (shared words)
    const words1 = new Set(norm1.split(' '));
    const words2 = new Set(norm2.split(' '));
    const intersection = [...words1].filter(w => words2.has(w));
    const similarity = intersection.length / Math.max(words1.size, words2.size);

    if (similarity >= 0.6) {
      return {
        appId: firstResult.id,
        name: firstResult.name,
      };
    }

    return null;
  } catch (error) {
    console.warn(`Error searching Steam for "${title}":`, error);
    return null;
  }
}

/**
 * Get Steam cover URL for an app ID
 */
function getSteamCoverUrl(appId: number): string {
  // library_600x900 is the vertical cover art
  // header.jpg is the horizontal banner
  return `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/library_600x900_2x.jpg`;
}

/**
 * Check if a Steam cover image exists
 */
async function checkCoverExists(appId: number): Promise<string | null> {
  const coverUrl = getSteamCoverUrl(appId);

  try {
    const response = await fetch(coverUrl, { method: 'HEAD' });
    if (response.ok) {
      return coverUrl;
    }

    // Fallback to header image
    const headerUrl = `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/header.jpg`;
    const headerResponse = await fetch(headerUrl, { method: 'HEAD' });
    if (headerResponse.ok) {
      return headerUrl;
    }

    return null;
  } catch {
    return null;
  }
}

export interface CoverSyncProgress {
  total: number;
  completed: number;
  found: number;
  notFound: number;
  currentGame: string;
}

export interface CoverSyncResult {
  total: number;
  found: number;
  notFound: number;
  details: Array<{
    title: string;
    status: 'found' | 'not_found';
    steamAppId?: number;
    steamName?: string;
  }>;
}

/**
 * Fetch covers for all games without cover images
 */
export async function fetchMissingCovers(
  onProgress?: (progress: CoverSyncProgress) => void
): Promise<CoverSyncResult> {
  const gamesWithoutCovers = getGamesWithoutCovers();

  const result: CoverSyncResult = {
    total: gamesWithoutCovers.length,
    found: 0,
    notFound: 0,
    details: [],
  };

  for (let i = 0; i < gamesWithoutCovers.length; i++) {
    const game = gamesWithoutCovers[i];

    if (onProgress) {
      onProgress({
        total: gamesWithoutCovers.length,
        completed: i,
        found: result.found,
        notFound: result.notFound,
        currentGame: game.title,
      });
    }

    // Rate limit
    if (i > 0) {
      await delay(RATE_LIMIT_DELAY);
    }

    // If game already has a Steam App ID, just fetch the cover
    if (game.steamAppId) {
      const coverUrl = await checkCoverExists(game.steamAppId);
      if (coverUrl) {
        updateGameCover(game.id, coverUrl);
        result.found++;
        result.details.push({
          title: game.title,
          status: 'found',
          steamAppId: game.steamAppId,
        });
        continue;
      }
    }

    // Search Steam for the game
    const searchResult = await searchSteamForGame(game.title);

    if (searchResult) {
      const coverUrl = await checkCoverExists(searchResult.appId);
      if (coverUrl) {
        updateGameCover(game.id, coverUrl, searchResult.appId);
        result.found++;
        result.details.push({
          title: game.title,
          status: 'found',
          steamAppId: searchResult.appId,
          steamName: searchResult.name,
        });
        continue;
      }
    }

    // Not found
    result.notFound++;
    result.details.push({
      title: game.title,
      status: 'not_found',
    });
  }

  // Final progress update
  if (onProgress) {
    onProgress({
      total: gamesWithoutCovers.length,
      completed: gamesWithoutCovers.length,
      found: result.found,
      notFound: result.notFound,
      currentGame: 'Done',
    });
  }

  return result;
}
