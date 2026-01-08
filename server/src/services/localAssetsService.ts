/**
 * Local Assets Caching Service
 *
 * Downloads hero and logo images from SteamGridDB and caches them locally.
 * Serves assets from ./data/heroes/ and ./data/logos/ directories.
 */

import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

type AssetType = 'hero' | 'logo';

// Asset directories relative to project root
const ASSETS_BASE_DIR = path.resolve(process.cwd(), 'data');
const HEROES_DIR = path.join(ASSETS_BASE_DIR, 'heroes');
const LOGOS_DIR = path.join(ASSETS_BASE_DIR, 'logos');

function getAssetDir(type: AssetType): string {
  return type === 'hero' ? HEROES_DIR : LOGOS_DIR;
}

/**
 * Ensure asset directories exist
 */
export function ensureAssetDirs(): void {
  for (const dir of [HEROES_DIR, LOGOS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created asset directory: ${dir}`);
    }
  }
}

/**
 * Check if a local asset exists for a game
 */
export function hasLocalAsset(gameId: number, type: AssetType): string | null {
  const dir = getAssetDir(type);
  const extensions = ['.jpg', '.jpeg', '.png', '.webp'];

  for (const ext of extensions) {
    const filePath = path.join(dir, `${gameId}${ext}`);
    if (fs.existsSync(filePath)) {
      return filePath;
    }
  }
  return null;
}

/**
 * Get the local asset URL for a game (relative to server route)
 * Includes cache-busting query param based on file modification time
 */
export function getLocalAssetUrl(gameId: number, type: AssetType): string | null {
  const localPath = hasLocalAsset(gameId, type);
  if (localPath) {
    const filename = path.basename(localPath);
    const routePath = type === 'hero' ? 'heroes' : 'logos';
    // Add mtime as cache-buster to force browser refresh after asset update
    const mtime = fs.statSync(localPath).mtimeMs;
    return `/${routePath}/${filename}?v=${Math.floor(mtime)}`;
  }
  return null;
}

/**
 * Download an asset from a remote URL and cache it locally
 */
export async function downloadAsset(
  gameId: number,
  remoteUrl: string,
  type: AssetType
): Promise<{ success: boolean; localPath?: string; localUrl?: string; error?: string }> {
  ensureAssetDirs();
  const dir = getAssetDir(type);

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

    const localPath = path.join(dir, `${gameId}${ext}`);

    // Remove existing asset with different extension
    const existingAsset = hasLocalAsset(gameId, type);
    if (existingAsset && existingAsset !== localPath) {
      fs.unlinkSync(existingAsset);
    }

    // Stream the image to disk
    const body = response.body;
    if (!body) {
      return { success: false, error: 'No response body' };
    }

    const writeStream = fs.createWriteStream(localPath);
    await pipeline(Readable.fromWeb(body as never), writeStream);

    const routePath = type === 'hero' ? 'heroes' : 'logos';
    // Add mtime as cache-buster
    const mtime = fs.statSync(localPath).mtimeMs;
    const localUrl = `/${routePath}/${gameId}${ext}?v=${Math.floor(mtime)}`;

    return { success: true, localPath, localUrl };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Download both hero and logo for a game
 */
export async function downloadGameAssets(
  gameId: number,
  heroUrl: string | null,
  logoUrl: string | null
): Promise<{
  heroLocalUrl: string | null;
  logoLocalUrl: string | null;
}> {
  let heroLocalUrl: string | null = null;
  let logoLocalUrl: string | null = null;

  // Download hero if not already cached
  if (heroUrl) {
    const existingHero = getLocalAssetUrl(gameId, 'hero');
    if (existingHero) {
      heroLocalUrl = existingHero;
    } else {
      const result = await downloadAsset(gameId, heroUrl, 'hero');
      if (result.success && result.localUrl) {
        heroLocalUrl = result.localUrl;
      }
    }
  }

  // Download logo if not already cached
  if (logoUrl) {
    const existingLogo = getLocalAssetUrl(gameId, 'logo');
    if (existingLogo) {
      logoLocalUrl = existingLogo;
    } else {
      const result = await downloadAsset(gameId, logoUrl, 'logo');
      if (result.success && result.localUrl) {
        logoLocalUrl = result.localUrl;
      }
    }
  }

  return { heroLocalUrl, logoLocalUrl };
}

/**
 * Get stats about local asset cache
 */
export function getAssetCacheStats(): {
  heroes: { count: number; sizeMB: string };
  logos: { count: number; sizeMB: string };
  total: { count: number; sizeMB: string };
} {
  ensureAssetDirs();

  const getStats = (dir: string) => {
    const files = fs.readdirSync(dir);
    let totalSize = 0;
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      if (stat.isFile()) {
        totalSize += stat.size;
      }
    }
    return { count: files.length, sizeMB: (totalSize / 1024 / 1024).toFixed(2) };
  };

  const heroStats = getStats(HEROES_DIR);
  const logoStats = getStats(LOGOS_DIR);

  return {
    heroes: heroStats,
    logos: logoStats,
    total: {
      count: heroStats.count + logoStats.count,
      sizeMB: (parseFloat(heroStats.sizeMB) + parseFloat(logoStats.sizeMB)).toFixed(2),
    },
  };
}
