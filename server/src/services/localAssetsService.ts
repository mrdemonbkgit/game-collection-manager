/**
 * Local Assets Caching Service
 *
 * Downloads hero, logo, and icon images from SteamGridDB and caches them locally.
 * Serves assets from ./data/heroes/, ./data/logos/, and ./data/icons/ directories.
 *
 * SSRF Protection:
 * - Only allows downloads from approved domains (SteamGridDB CDN)
 * - Blocks redirects to prevent redirect-based attacks
 * - Enforces maximum file size
 * - Validates content type
 */

import fs from 'node:fs';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';

export type AssetType = 'hero' | 'logo' | 'icon';

// Asset directories relative to project root
const ASSETS_BASE_DIR = path.resolve(process.cwd(), 'data');
const HEROES_DIR = path.join(ASSETS_BASE_DIR, 'heroes');
const LOGOS_DIR = path.join(ASSETS_BASE_DIR, 'logos');
const ICONS_DIR = path.join(ASSETS_BASE_DIR, 'icons');

// SSRF Protection Configuration
const ALLOWED_DOMAINS = [
  'cdn2.steamgriddb.com',
  'cdn.cloudflare.steamstatic.com',
  'steamcdn-a.akamaihd.net',
  'shared.cloudflare.steamstatic.com',
];

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB max for images
const REQUEST_TIMEOUT = 30000; // 30 seconds
const ALLOWED_CONTENT_TYPES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/gif',
];

function getAssetDir(type: AssetType): string {
  switch (type) {
    case 'hero':
      return HEROES_DIR;
    case 'logo':
      return LOGOS_DIR;
    case 'icon':
      return ICONS_DIR;
  }
}

/**
 * Ensure asset directories exist
 */
export function ensureAssetDirs(): void {
  for (const dir of [HEROES_DIR, LOGOS_DIR, ICONS_DIR]) {
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
    const routePath = type === 'hero' ? 'heroes' : type === 'logo' ? 'logos' : 'icons';
    // Add mtime as cache-buster to force browser refresh after asset update
    const mtime = fs.statSync(localPath).mtimeMs;
    return `/${routePath}/${filename}?v=${Math.floor(mtime)}`;
  }
  return null;
}

/**
 * Validate that a URL is safe to download from (SSRF protection)
 */
function validateUrl(url: string): { valid: boolean; error?: string } {
  try {
    const parsed = new URL(url);

    // Must be HTTPS
    if (parsed.protocol !== 'https:') {
      return { valid: false, error: 'Only HTTPS URLs are allowed' };
    }

    // Must be from an allowed domain
    const domain = parsed.hostname.toLowerCase();
    if (!ALLOWED_DOMAINS.some(allowed => domain === allowed || domain.endsWith('.' + allowed))) {
      return { valid: false, error: `Domain not allowed: ${domain}` };
    }

    // No unusual ports
    if (parsed.port && parsed.port !== '443') {
      return { valid: false, error: 'Non-standard port not allowed' };
    }

    return { valid: true };
  } catch {
    return { valid: false, error: 'Invalid URL format' };
  }
}

/**
 * Download an asset from a remote URL and cache it locally
 * Includes SSRF protection and file validation
 */
export async function downloadAsset(
  gameId: number,
  remoteUrl: string,
  type: AssetType
): Promise<{ success: boolean; localPath?: string; localUrl?: string; error?: string }> {
  ensureAssetDirs();
  const dir = getAssetDir(type);

  // SSRF Protection: Validate URL before fetching
  const validation = validateUrl(remoteUrl);
  if (!validation.valid) {
    return {
      success: false,
      error: `URL validation failed: ${validation.error}`,
    };
  }

  try {
    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

    // Fetch the image with SSRF protections
    const response = await fetch(remoteUrl, {
      headers: {
        'User-Agent': 'GameCollection/1.0',
      },
      signal: controller.signal,
      redirect: 'error', // SSRF: Block redirects to prevent redirect attacks
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    // Validate content type
    const contentType = response.headers.get('content-type') || '';
    const isValidContentType = ALLOWED_CONTENT_TYPES.some(ct => contentType.includes(ct));
    if (!isValidContentType) {
      return {
        success: false,
        error: `Invalid content type: ${contentType}`,
      };
    }

    // Check content length if available
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > MAX_FILE_SIZE) {
      return {
        success: false,
        error: `File too large: ${contentLength} bytes (max ${MAX_FILE_SIZE})`,
      };
    }

    // Determine extension from content-type or URL
    let ext = '.jpg';
    if (contentType.includes('png')) ext = '.png';
    else if (contentType.includes('webp')) ext = '.webp';
    else if (contentType.includes('jpeg') || contentType.includes('jpg')) ext = '.jpg';
    else if (contentType.includes('gif')) ext = '.gif';
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

    // Create a size-limited write with tracking
    let bytesWritten = 0;
    const writeStream = fs.createWriteStream(localPath);

    // Transform stream to track and limit size
    const readable = Readable.fromWeb(body as never);
    readable.on('data', (chunk: Buffer) => {
      bytesWritten += chunk.length;
      if (bytesWritten > MAX_FILE_SIZE) {
        readable.destroy(new Error('File exceeds maximum size'));
      }
    });

    await pipeline(readable, writeStream);

    const routePath = type === 'hero' ? 'heroes' : type === 'logo' ? 'logos' : 'icons';
    // Add mtime as cache-buster
    const mtime = fs.statSync(localPath).mtimeMs;
    const localUrl = `/${routePath}/${gameId}${ext}?v=${Math.floor(mtime)}`;

    return { success: true, localPath, localUrl };
  } catch (error) {
    // Clean up partial download if it exists
    const extensions = ['.jpg', '.jpeg', '.png', '.webp', '.gif'];
    for (const ext of extensions) {
      const partialPath = path.join(dir, `${gameId}${ext}`);
      if (fs.existsSync(partialPath)) {
        try {
          const stat = fs.statSync(partialPath);
          // Only remove if small (likely incomplete)
          if (stat.size < 1000) {
            fs.unlinkSync(partialPath);
          }
        } catch {
          // Ignore cleanup errors
        }
      }
    }

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
 * Download all assets (hero, logo, icon) for a game
 */
export async function downloadAllGameAssets(
  gameId: number,
  heroUrl: string | null,
  logoUrl: string | null,
  iconUrl: string | null
): Promise<{
  heroLocalUrl: string | null;
  logoLocalUrl: string | null;
  iconLocalUrl: string | null;
}> {
  const { heroLocalUrl, logoLocalUrl } = await downloadGameAssets(gameId, heroUrl, logoUrl);

  let iconLocalUrl: string | null = null;

  // Download icon if not already cached
  if (iconUrl) {
    const existingIcon = getLocalAssetUrl(gameId, 'icon');
    if (existingIcon) {
      iconLocalUrl = existingIcon;
    } else {
      const result = await downloadAsset(gameId, iconUrl, 'icon');
      if (result.success && result.localUrl) {
        iconLocalUrl = result.localUrl;
      }
    }
  }

  return { heroLocalUrl, logoLocalUrl, iconLocalUrl };
}

/**
 * Get stats about local asset cache
 */
export function getAssetCacheStats(): {
  heroes: { count: number; sizeMB: string };
  logos: { count: number; sizeMB: string };
  icons: { count: number; sizeMB: string };
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
  const iconStats = getStats(ICONS_DIR);

  return {
    heroes: heroStats,
    logos: logoStats,
    icons: iconStats,
    total: {
      count: heroStats.count + logoStats.count + iconStats.count,
      sizeMB: (
        parseFloat(heroStats.sizeMB) +
        parseFloat(logoStats.sizeMB) +
        parseFloat(iconStats.sizeMB)
      ).toFixed(2),
    },
  };
}
