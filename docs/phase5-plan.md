# Phase 5: Detail Pages + Subscription Catalogs - Implementation Plan

**Milestone:** "I can see game details and add non-Steam games"

**Priority Order:** Detail pages first, then subscription catalogs

**User Choices:**
- Detail page: Full featured (screenshots gallery, all metadata, external links, platform badges)
- Catalog source: JSON file import from community lists
- URL format: `/game/:slug` (slug-based routing)

---

## Part 1: Game Detail Pages

### 1.1 Backend: Slug-Based Lookup

**File:** `server/src/db/repositories/gameRepository.ts`

Add function (pattern matches existing `getGameById()`):
```typescript
export function getGameBySlug(slug: string): GameWithPlatforms | null
// Returns game WITH platforms for platform badges on detail page
```

**Note:** Slug index NOT needed - `UNIQUE` constraint on `slug` column already creates an implicit index in SQLite.

**File:** `server/src/routes/games.ts`

Add route (MUST be BEFORE `/:id` route - Express matches routes in order):
```typescript
// Route order matters! /slug/:slug must come before /:id
router.get('/slug/:slug', ...);  // Line ~X - ADD THIS FIRST
router.get('/:id', ...);          // Existing route - comes AFTER
```

**CRITICAL:** The `/:id` route currently validates that `id` is an integer and returns 400 if not. However, Express route matching happens before validation - if `/slug/:slug` is defined after `/:id`, a request to `/api/games/slug/portal-2` will match `/:id` with `id="slug"` and fail validation.

**IMPORTANT:** The slug route handler MUST parse JSON fields like the `/:id` handler does:
```typescript
const parsedGame = {
  ...game,
  screenshots: JSON.parse(game.screenshots),
  genres: JSON.parse(game.genres),
  tags: JSON.parse(game.tags),
};
```
Without this, client receives JSON strings instead of arrays, causing type errors.

### 1.2 Frontend: Platform Types (Missing from Game interface)

**File:** `client/src/types/game.ts`

The current `Game` interface does NOT include platform data. Add:

```typescript
// Add new type for platform data
export interface GamePlatform {
  id: number;
  gameId: number;
  platformType: 'steam' | 'gamepass' | 'eaplay' | 'ubisoftplus';
  platformGameId: string;
  isPrimary: boolean;
}

// API response type (snake_case)
export interface GamePlatformApiResponse {
  id: number;
  game_id: number;
  platform_type: string;
  platform_game_id: string;
  is_primary: number;
}

// Update GameApiResponse to include platforms
export interface GameApiResponse {
  // ... existing fields ...
  platforms?: GamePlatformApiResponse[];  // ADD THIS
}

// Update Game interface
export interface Game {
  // ... existing fields ...
  platforms: GamePlatform[];  // ADD THIS
}

// Update transformGame function
export function transformGame(raw: GameApiResponse): Game {
  return {
    // ... existing fields ...
    platforms: (raw.platforms ?? []).map(p => ({
      id: p.id,
      gameId: p.game_id,
      platformType: p.platform_type as GamePlatform['platformType'],
      platformGameId: p.platform_game_id,
      isPrimary: p.is_primary === 1,
    })),
  };
}
```

### 1.3 Frontend: Service & Hook

**File:** `client/src/services/gamesService.ts`
```typescript
export async function fetchGameBySlug(slug: string): Promise<Game>
```

**New File:** `client/src/hooks/useGame.ts`
```typescript
export function useGame(slug: string | undefined): {
  game: Game | null;
  loading: boolean;
  error: string | null;
}
```

### 1.4 Frontend: Game Detail Page

**New File:** `client/src/pages/GameDetailPage.tsx`

**Layout Structure:**
```
GameDetailPage
├── BackButton (navigate(-1) for browser history)
├── HeroSection
│   ├── Cover Image (large, left side)
│   ├── Title + Metadata (right side)
│   │   ├── Developer / Publisher
│   │   ├── Release Date
│   │   └── Platform Badges (Steam, Game Pass, etc.)
│   └── Action Buttons (Steam Store link, Metacritic link)
├── Main Content (2-column layout)
│   ├── Left Column (wider)
│   │   ├── Screenshots Gallery
│   │   └── Description (full text)
│   └── Right Sidebar
│       ├── Ratings Box (Metacritic score, Steam rating)
│       ├── Genres (chips/tags)
│       └── Tags (chips, scrollable)
```

### 1.5 Screenshots Gallery Component

**New File:** `client/src/components/ScreenshotsGallery.tsx`

Features:
- Thumbnail grid (4 columns desktop, 2 mobile)
- Click opens lightbox modal
- Lightbox with prev/next navigation
- Keyboard support (Esc, Arrow keys)
- Image counter ("3 / 12")

### 1.6 Platform Badge Component

**New File:** `client/src/components/PlatformBadge.tsx`

```typescript
interface PlatformBadgeProps {
  platform: 'steam' | 'gamepass' | 'eaplay' | 'ubisoftplus';
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}
```

Uses existing colors from tailwind.config.js:
- Steam: `#1b2838`
- Game Pass: `#107c10`
- EA Play: `#ff4747`
- Ubisoft+: `#0070ff`

### 1.7 Routing & Navigation

**File:** `client/src/App.tsx`
```typescript
<Routes>
  <Route path="/" element={<LibraryPage />} />
  <Route path="/game/:slug" element={<GameDetailPage />} />
  <Route path="/admin" element={<AdminPage />} />
</Routes>
```

**File:** `client/src/components/GameCard.tsx`

Wrap card with Link:
```typescript
import { Link } from 'react-router-dom';

<Link to={`/game/${game.slug}`}>
  {/* existing card content */}
</Link>
```

Back navigation uses `navigate(-1)` to preserve library filters.

---

## Part 2: Subscription Catalogs (JSON Import)

### 2.1 Expected JSON Format

```json
{
  "platform": "gamepass",
  "updated": "2025-01-07",
  "source": "https://example.com/catalog",
  "games": [
    {
      "title": "Starfield",
      "external_id": "starfield-2023",
      "steam_app_id": null,
      "release_date": "2023-09-06",
      "developer": "Bethesda Game Studios",
      "publisher": "Bethesda Softworks",
      "genres": ["RPG", "Sci-Fi"],
      "description": "Space exploration RPG",
      "cover_url": "https://example.com/cover.jpg"
    }
  ]
}
```

**Required:** `title`, `external_id` (needed for `platform_game_id` which is NOT NULL)
**Optional:** All other fields

**CRITICAL (from Codex review):**
- `game_platforms.platform_game_id` is `NOT NULL` - every imported game MUST have an `external_id`
- If `external_id` is missing in JSON, generate one from slug: `{platform}-{slug}`

### 2.2 Backend: Import Endpoint

**File:** `server/src/routes/sync.ts`
```typescript
POST /api/sync/catalog - Import subscription catalog JSON
```

**New File:** `server/src/services/catalogService.ts`

```typescript
export async function importCatalog(catalog: CatalogImport): Promise<ImportResult>
```

**Import Logic:**
1. For each game in JSON:
   - Try to match by `steam_app_id` (if provided)
   - Try to match by title (case-insensitive, normalized)
   - If match found: Add platform to existing game (`linked`)
   - If no match: Create new game (`added`)
2. Return summary: `{ total, added, linked, errors }`

**CRITICAL (from Codex review) - For new games:**
- MUST generate unique slug using `getUniqueSlug(title)` - `games.slug` is NOT NULL UNIQUE
- MUST have `external_id` for `platform_game_id` - generate as `{platform}-{slug}` if missing
- Use existing `insertGame()` with generated slug

### 2.3 Backend: Title Matching

**File:** `server/src/db/repositories/gameRepository.ts`

```typescript
export function getGameByTitle(title: string): GameRow | null
// Exact match first, then normalized (remove special chars)
```

**Note (from Codex review):** Case-insensitive/normalized matching won't use `idx_games_title` index efficiently. For 2400 games this is acceptable (fast enough). For larger catalogs, consider:
- Adding `COLLATE NOCASE` to the title index, OR
- Adding a `normalized_title` column with its own index

### 2.4 Frontend: Admin Page

**New File:** `client/src/pages/AdminPage.tsx`

Features:
- File upload for JSON catalogs
- Platform selector (Game Pass, EA Play, Ubisoft+)
- Import button with progress
- Results display (added, linked, errors)

**Route:** `/admin`

**New File:** `client/src/services/syncService.ts`
```typescript
export async function importCatalog(catalog: CatalogImport): Promise<ImportResult>
```

---

## File Summary

### New Files

| File | Purpose |
|------|---------|
| `client/src/pages/GameDetailPage.tsx` | Main detail page |
| `client/src/pages/AdminPage.tsx` | Catalog import UI |
| `client/src/hooks/useGame.ts` | Game fetching hook |
| `client/src/components/ScreenshotsGallery.tsx` | Gallery with lightbox |
| `client/src/components/PlatformBadge.tsx` | Platform badge component |
| `client/src/services/syncService.ts` | Catalog import service |
| `server/src/services/catalogService.ts` | Import logic |

### Modified Files

| File | Changes |
|------|---------|
| `server/src/db/repositories/gameRepository.ts` | Add `getGameBySlug()`, `getGameByTitle()` |
| `server/src/routes/games.ts` | Add `/slug/:slug` route (BEFORE `/:id`!) with JSON parsing |
| `server/src/routes/sync.ts` | Add `/catalog` import route |
| `client/src/types/game.ts` | Add `GamePlatform` type, update `Game` interface, update `transformGame()` |
| `client/src/App.tsx` | Add detail page and admin routes |
| `client/src/components/GameCard.tsx` | Wrap with Link (stopPropagation on dropdown already handles click) |
| `client/src/services/gamesService.ts` | Add `fetchGameBySlug()` |

---

## Implementation Order

### Part 1: Detail Pages (Do First)

1. **Backend slug lookup** - `getGameBySlug()` + route
2. **Frontend service** - `fetchGameBySlug()`
3. **useGame hook** - Data fetching
4. **GameDetailPage** - Basic layout with metadata
5. **ScreenshotsGallery** - Thumbnail grid + lightbox
6. **PlatformBadge** - Reusable badge component
7. **Routing** - Add route, make GameCard clickable
8. **Tests** - Unit + E2E for detail page

### Part 2: Subscription Catalogs (After Detail Pages)

9. **catalogService** - Import logic with duplicate detection
10. **Title matching** - `getGameByTitle()` in repository
11. **Import endpoint** - `POST /api/sync/catalog`
12. **AdminPage** - File upload UI
13. **syncService** - Client-side import function
14. **Tests** - Import logic tests

---

## Success Criteria

**Part 1 - Detail Pages:**
- [ ] Click game card navigates to `/game/:slug`
- [ ] Detail page shows all metadata (title, developer, publisher, release date)
- [ ] Screenshots gallery with working lightbox
- [ ] External links to Steam Store and Metacritic
- [ ] Platform badges for all platforms game is on
- [ ] Back button returns to library with filters preserved
- [ ] Loading and error states handled
- [ ] E2E tests for navigation flow

**Part 2 - Subscription Catalogs:**
- [ ] Can upload JSON file for Game Pass/EA Play/Ubisoft+
- [ ] Duplicate games detected by Steam ID or title
- [ ] New games added to library with correct platform
- [ ] Existing games linked to new platform
- [ ] Import results shown (added/linked/errors)
- [ ] Platform badges appear on imported games
- [ ] E2E tests for import flow
