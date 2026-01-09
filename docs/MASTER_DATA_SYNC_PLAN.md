# Master Game Data Sync - Implementation Plan

**Goal:** Create comprehensive master data for ALL games by syncing from three sources:
- **Steam API** - Detailed metadata, reviews, Metacritic scores (Steam games only)
- **IGDB** - Universal identifier, critic ratings, themes, game modes (ALL games)
- **SteamGridDB** - Cover art, heroes, logos, icons (ALL games)

**Total new columns:** ~51 (including IGDB-specific genres/platforms/summary)
**Total sync time:** ~105 minutes (Steam ~70min + IGDB ~15min + SteamGridDB ~20min)

---

## Data Sources Overview

| Source | Data Type | Rate Limit | Games Covered |
|--------|-----------|------------|---------------|
| **Steam GetOwnedGames** | Library, playtime | Fast | Steam only (2420) |
| **Steam AppDetails** | Metadata, genres, scores | 200/5min | Steam only |
| **Steam Reviews** | Ratings, sentiment | 200/5min | Steam only |
| **IGDB** | Universal metadata, ratings | 4 req/sec | ALL games |
| **SteamGridDB** | Covers, heroes, logos, icons | 4/sec | ALL games |

---

## IGDB API Data (Universal Identifier)

**Purpose:** Provides unified game identification and metadata for ALL games (Steam + Game Pass + EA Play + Ubisoft+)

### Authentication
- Requires Twitch Developer account (free)
- OAuth client ID + secret
- Token endpoint: `https://id.twitch.tv/oauth2/token`
- API base: `https://api.igdb.com/v4`

### Key Fields from IGDB
| Field | Type | Description |
|-------|------|-------------|
| `id` | number | **Universal IGDB ID** |
| `name` | string | Canonical game name |
| `slug` | string | URL-safe name |
| `summary` | string | Game description |
| `storyline` | string | Story description |
| `rating` | number | IGDB user rating (0-100) |
| `rating_count` | number | Number of IGDB ratings |
| `aggregated_rating` | number | **Critic score average** (0-100) |
| `aggregated_rating_count` | number | Number of critic reviews |
| `total_rating` | number | Combined user + critic |
| `first_release_date` | timestamp | Release date |
| `genres` | Genre[] | Game genres |
| `platforms` | Platform[] | Platforms (PC, Xbox, PS, etc) |
| `themes` | Theme[] | Game themes |
| `game_modes` | GameMode[] | Single-player, multiplayer, etc |
| `player_perspectives` | PlayerPerspective[] | First-person, third-person, etc |
| `involved_companies` | Company[] | Developers & publishers |
| `cover` | Cover | Cover art URL |
| `screenshots` | Screenshot[] | Screenshot URLs |
| `videos` | Video[] | Trailer URLs |
| `external_games` | ExternalGame[] | **Links to Steam, GOG, etc** |

### External Games Linking
IGDB's `external_games` field connects to other platforms:
- Steam App ID
- GOG ID
- Epic Games ID
- etc.

This allows **bidirectional lookup**:
- Steam ID → IGDB ID
- Title search → IGDB ID → Steam ID (if exists)

### New Database Columns for IGDB
```sql
ALTER TABLE games ADD COLUMN igdb_id INTEGER;
ALTER TABLE games ADD COLUMN igdb_slug TEXT;
ALTER TABLE games ADD COLUMN igdb_rating REAL;           -- User rating (0-100)
ALTER TABLE games ADD COLUMN igdb_rating_count INTEGER;
ALTER TABLE games ADD COLUMN igdb_aggregated_rating REAL; -- Critic score (0-100)
ALTER TABLE games ADD COLUMN igdb_aggregated_rating_count INTEGER;
ALTER TABLE games ADD COLUMN igdb_total_rating REAL;      -- Combined score
ALTER TABLE games ADD COLUMN storyline TEXT;
ALTER TABLE games ADD COLUMN themes TEXT DEFAULT '[]';    -- JSON array
ALTER TABLE games ADD COLUMN game_modes TEXT DEFAULT '[]'; -- JSON array
ALTER TABLE games ADD COLUMN player_perspectives TEXT DEFAULT '[]'; -- JSON array
ALTER TABLE games ADD COLUMN igdb_updated_at TEXT;
ALTER TABLE games ADD COLUMN igdb_match_confidence INTEGER;  -- 0-100, NULL if Steam ID match
ALTER TABLE games ADD COLUMN igdb_genres TEXT DEFAULT '[]';  -- Keep separate from Steam genres
ALTER TABLE games ADD COLUMN igdb_platforms TEXT DEFAULT '[]';  -- PC/Xbox/PS platforms from IGDB
ALTER TABLE games ADD COLUMN igdb_summary TEXT;  -- Keep separate from Steam description

CREATE INDEX IF NOT EXISTS idx_games_igdb_id ON games(igdb_id);
```

---

## SteamGridDB API Data

### Currently Stored
| Field | Column | Status |
|-------|--------|--------|
| SteamGridDB Game ID | `steamgrid_id` | ✅ |
| Hero URL (remote) | `hero_url` | ✅ |
| Logo URL (remote) | `logo_url` | ✅ |
| Last checked | `assets_checked_at` | ✅ |

### NEW Fields to Add
| Field | Description | Column |
|-------|-------------|--------|
| Icon URL | Small game icon | `icon_url` |
| SteamGridDB Name | Matched game name | `steamgrid_name` |
| SteamGridDB Verified | Official/verified status | `steamgrid_verified` |
| Grids Count | Available cover options | `grids_count` |
| Heroes Count | Available hero options | `heroes_count` |
| Logos Count | Available logo options | `logos_count` |
| Icons Count | Available icon options | `icons_count` |

### SteamGridDB API Endpoints
```
GET /games/steam/{steamAppId}     → Game lookup by Steam ID
GET /search/autocomplete/{term}   → Game search by title
GET /grids/game/{gameId}          → Cover images (600x900)
GET /heroes/game/{gameId}         → Hero/banner images
GET /logos/game/{gameId}          → Logo images
GET /icons/game/{gameId}          → Icon images
```

### SteamGridDB Response Fields
```typescript
interface SteamGridDBGame {
  id: number;           // SteamGridDB ID
  name: string;         // Game name
  types: string[];      // ['game', 'dlc', etc]
  verified: boolean;    // Official/verified
}

interface SteamGridDBAsset {
  id: number;
  score: number;        // Community rating
  style: string;        // 'official', 'custom', etc
  width: number;
  height: number;
  nsfw: boolean;
  humor: boolean;
  url: string;          // Full image URL
  thumb: string;        // Thumbnail URL
  author: { name, steam64, avatar }
}
```

---

## Steam API Data Sources

### 1. GetOwnedGames API (Already Used - Quick Sync)
| Field | Description | Currently Stored |
|-------|-------------|------------------|
| `appid` | Steam App ID | ✅ `steam_app_id` |
| `name` | Game title | ✅ `title` |
| `playtime_forever` | Total playtime (minutes) | ✅ `playtime_minutes` |
| `rtime_last_played` | Last played timestamp | ❌ **NEW** |
| `img_icon_url` | Icon URL | ❌ (not needed) |

### 2. AppDetails API (Detailed Sync)
| Field | Description | Currently Stored |
|-------|-------------|------------------|
| `type` | game/dlc/demo/mod | ❌ **NEW** |
| `name` | Title | ✅ `title` |
| `required_age` | Age rating | ❌ **NEW** |
| `is_free` | Free to play | ❌ **NEW** |
| `controller_support` | full/partial/none | ❌ **NEW** |
| `dlc` | Array of DLC app IDs | ❌ **NEW** |
| `detailed_description` | Full HTML description | ✅ `description` |
| `short_description` | Brief description | ✅ `short_description` |
| `supported_languages` | HTML string of languages | ❌ **NEW** |
| `header_image` | Cover image | ✅ `cover_image_url` |
| `website` | Official website | ❌ **NEW** |
| `developers` | Array of developers | ✅ `developer` (joined) |
| `publishers` | Array of publishers | ✅ `publisher` (joined) |
| `pc_requirements` | {minimum, recommended} | ❌ **NEW** |
| `mac_requirements` | {minimum, recommended} | ❌ **NEW** |
| `linux_requirements` | {minimum, recommended} | ❌ **NEW** |
| `platforms` | {windows, mac, linux} | ❌ **NEW** |
| `metacritic` | {score, url} | ✅ `metacritic_score`, `metacritic_url` |
| `categories` | Steam categories | ✅ `tags` (JSON) |
| `genres` | Game genres | ✅ `genres` (JSON) |
| `screenshots` | Array of images | ✅ `screenshots` (JSON) |
| `movies` | Trailers/videos | ❌ **NEW** |
| `recommendations` | {total} | ❌ **NEW** |
| `achievements` | {total} | ❌ **NEW** |
| `release_date` | {coming_soon, date} | ✅ `release_date` |
| `background` | Background image URL | ❌ **NEW** |
| `legal_notice` | Legal text | ❌ (not needed) |
| `price_overview` | Pricing info | ❌ **NEW** |
| `content_descriptors` | Mature content | ❌ **NEW** |

### 3. Reviews API (Partially Implemented)
| Field | Description | Currently Stored |
|-------|-------------|------------------|
| `review_score` | Score number (1-9) | ❌ **NEW** |
| `review_score_desc` | "Overwhelmingly Positive" etc | ❌ **NEW** |
| `total_positive` | Positive reviews | ❌ **NEW** |
| `total_negative` | Negative reviews | ❌ **NEW** |
| `total_reviews` | Total reviews | ✅ `steam_rating_count` |
| Rating percentage | Calculated | ✅ `steam_rating` |

### 4. Additional APIs (Optional)
| API | Endpoint | Data |
|-----|----------|------|
| Current Players | `ISteamUserStats/GetNumberOfCurrentPlayers` | Live player count |
| News | `ISteamNews/GetNewsForApp` | Game news articles |
| Achievements | `ISteamUserStats/GetPlayerAchievements` | User's achievements |

---

## Database Schema Changes

### New Columns for `games` Table

```sql
-- SteamGridDB data (NEW)
ALTER TABLE games ADD COLUMN icon_url TEXT;
ALTER TABLE games ADD COLUMN steamgrid_name TEXT;
ALTER TABLE games ADD COLUMN steamgrid_verified INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN grids_count INTEGER;
ALTER TABLE games ADD COLUMN heroes_count INTEGER;
ALTER TABLE games ADD COLUMN logos_count INTEGER;
ALTER TABLE games ADD COLUMN icons_count INTEGER;

-- Game type and age
ALTER TABLE games ADD COLUMN game_type TEXT DEFAULT 'game';  -- game/dlc/demo/mod
ALTER TABLE games ADD COLUMN required_age INTEGER DEFAULT 0;
ALTER TABLE games ADD COLUMN is_free INTEGER DEFAULT 0;

-- Platform support
ALTER TABLE games ADD COLUMN platforms TEXT DEFAULT '{}';  -- JSON: {windows, mac, linux}
ALTER TABLE games ADD COLUMN controller_support TEXT;  -- full/partial/none
ALTER TABLE games ADD COLUMN supported_languages TEXT;  -- HTML string

-- Links
ALTER TABLE games ADD COLUMN website TEXT;
ALTER TABLE games ADD COLUMN background_url TEXT;

-- Requirements (JSON objects)
ALTER TABLE games ADD COLUMN pc_requirements TEXT DEFAULT '{}';
ALTER TABLE games ADD COLUMN mac_requirements TEXT DEFAULT '{}';
ALTER TABLE games ADD COLUMN linux_requirements TEXT DEFAULT '{}';

-- Media
ALTER TABLE games ADD COLUMN movies TEXT DEFAULT '[]';  -- JSON array of trailer URLs

-- Stats
ALTER TABLE games ADD COLUMN recommendations_total INTEGER;
ALTER TABLE games ADD COLUMN achievements_total INTEGER;
ALTER TABLE games ADD COLUMN current_players INTEGER;

-- Reviews (expanded)
ALTER TABLE games ADD COLUMN review_score INTEGER;  -- 1-9 scale
ALTER TABLE games ADD COLUMN review_score_desc TEXT;  -- "Overwhelmingly Positive"
ALTER TABLE games ADD COLUMN reviews_positive INTEGER;
ALTER TABLE games ADD COLUMN reviews_negative INTEGER;

-- Pricing
ALTER TABLE games ADD COLUMN price_currency TEXT;
ALTER TABLE games ADD COLUMN price_initial INTEGER;  -- in cents
ALTER TABLE games ADD COLUMN price_final INTEGER;    -- in cents
ALTER TABLE games ADD COLUMN price_discount_percent INTEGER;

-- Content
ALTER TABLE games ADD COLUMN content_descriptors TEXT DEFAULT '[]';  -- JSON array
ALTER TABLE games ADD COLUMN dlc_app_ids TEXT DEFAULT '[]';  -- JSON array

-- Timestamps
ALTER TABLE games ADD COLUMN last_played_at TEXT;  -- Unix timestamp from Steam
ALTER TABLE games ADD COLUMN steam_data_updated_at TEXT;  -- When we last synced
```

### New Indexes

```sql
CREATE INDEX IF NOT EXISTS idx_games_game_type ON games(game_type);
CREATE INDEX IF NOT EXISTS idx_games_is_free ON games(is_free);
CREATE INDEX IF NOT EXISTS idx_games_recommendations ON games(recommendations_total);
CREATE INDEX IF NOT EXISTS idx_games_achievements ON games(achievements_total);
CREATE INDEX IF NOT EXISTS idx_games_review_score ON games(review_score);
```

---

## Implementation Plan

### Phase 1: Schema Migration
1. Create migration file with new columns
2. Add migration runner to schema.ts
3. Test migration on existing database

### Phase 2: Update Steam Service
1. Update `SteamAppDetails` interface with all new fields
2. Update `fetchSteamAppDetails()` to capture all data
3. Add `fetchCurrentPlayers()` function (optional)

### Phase 3: Update Repository
1. Add new fields to `CreateGameInput` type
2. Update `upsertGameBySteamAppId()` to handle new fields
3. Add `updateGameSteamData()` for partial updates
4. Add bulk update function for sync

### Phase 4: Enhanced Sync Endpoints
1. **Full Sync** - `POST /api/sync/steam` (existing, enhanced)
   - Fetches all appdetails + reviews
   - ~70 min for 2860 games (1.5s rate limit)

2. **Incremental Sync** - `POST /api/sync/steam/incremental`
   - Only updates games missing data
   - Tracks `steam_data_updated_at`

3. **Specific Field Sync** - `POST /api/sync/steam/field`
   - Body: `{ field: "metacritic" | "reviews" | "players" }`
   - Uses `filters` param for lighter payloads

### Phase 5: Client Display Updates
1. Show new data on game detail page:
   - Platform icons (Windows/Mac/Linux)
   - Controller support badge
   - Current players
   - Achievements count
   - Price info (if applicable)
   - Trailers

---

## API Rate Limits

| API | Limit | Strategy |
|-----|-------|----------|
| AppDetails | 200 req/5min | 1.5s delay between requests |
| Reviews | Similar | Combined with appdetails sync |
| CurrentPlayers | Unknown | Only fetch on-demand |

**Estimated sync time for 2860 games:**
- Full sync: ~70 minutes
- Incremental (1000 games): ~25 minutes

---

## Files to Modify

| File | Changes |
|------|---------|
| `server/src/db/schema.ts` | Add ~45 new columns, indexes, migration |
| `server/src/db/repositories/gameRepository.ts` | Update types, upsert function |
| `server/src/services/steamService.ts` | Capture all Steam fields |
| `server/src/services/igdbService.ts` | **CREATE** - IGDB API integration |
| `server/src/services/steamGridDBService.ts` | Add enrichment + icon download |
| `server/src/routes/sync.ts` | Add `/sync/igdb` and `/sync/steamgrid` endpoints |
| `client/src/types/game.ts` | Add new Game type fields |
| `client/src/components/game-detail/*` | Display new data (future)

---

## Complete Data Model Summary

After all syncs, each game will have:

### Identifiers
| Column | Source | Coverage |
|--------|--------|----------|
| `id` | Internal | 100% |
| `steam_app_id` | Steam | Steam games only |
| `igdb_id` | IGDB | ~95% (universal) |
| `steamgrid_id` | SteamGridDB | ~90% |

### Ratings (Multiple Sources!)
| Column | Source | Description |
|--------|--------|-------------|
| `metacritic_score` | Steam | Metacritic critic score |
| `steam_rating` | Steam | User review % positive |
| `steam_rating_count` | Steam | Total Steam reviews |
| `igdb_rating` | IGDB | IGDB user rating |
| `igdb_aggregated_rating` | IGDB | **Critic aggregate** |
| `igdb_total_rating` | IGDB | Combined score |

### Metadata
| Column | Source | Description |
|--------|--------|-------------|
| `genres` | Steam/IGDB | Game genres |
| `themes` | IGDB | Game themes |
| `game_modes` | IGDB | Single/Multi/Co-op |
| `player_perspectives` | IGDB | First/Third person |
| `platforms` | Steam | Win/Mac/Linux support |
| `controller_support` | Steam | Controller support |

### Media
| Column | Source | Description |
|--------|--------|-------------|
| `cover_image_url` | Steam/SteamGridDB | Cover art |
| `hero_url` | SteamGridDB | Hero banner |
| `logo_url` | SteamGridDB | Game logo |
| `icon_url` | SteamGridDB | Small icon |
| `screenshots` | Steam | Screenshot URLs |
| `movies` | Steam | Trailer URLs |

### Sync Timestamps
| Column | Description |
|--------|-------------|
| `steam_data_updated_at` | Last Steam sync |
| `igdb_updated_at` | Last IGDB sync |
| `assets_checked_at` | Last SteamGridDB sync |

---

## User Decisions

- ✅ **Sync Strategy:** Full re-sync (simple ~70 min approach)
- ✅ **Data Fields:** Capture ALL available Steam data
- ✅ **Current Players:** Skip (not needed for personal collection)

---

## Codex Review Findings & Mitigations (3 Reviews Completed)

### High Priority Issues

| Issue | Status | Mitigation |
|-------|--------|------------|
| **HTTP Timeout** | ✅ Already handled | Background job pattern exists in sync.ts (17+ instances) |
| **Rate Limiting** | ⚠️ Needs work | Add exponential backoff with `Retry-After` handling for 429 responses |
| **Upsert Data Loss** | ⚠️ Confirmed | `upsertGameBySteamAppId` uses `input.genres ?? []` - need COALESCE update function |
| **Unauthenticated Endpoints** | ⚠️ Confirmed | Personal localhost app - acceptable; can add `SYNC_SECRET` later |
| **XSS Risk - Other HTML fields** | ⚠️ Confirmed | Only AboutCard.tsx sanitizes; add DOMPurify to any component rendering `supported_languages`, `igdb_summary`, `storyline` |
| **Title Search Precision** | ⚠️ Confirmed | `searchGame(title)` fallback at lines 404,502,973,1083,1148,1213 - store `igdb_match_confidence` |
| **SSRF Redirect Blocking** | ⚠️ NEW (verified) | No redirect blocking in asset downloads - add `redirect: 'error'` to fetch options |
| **Request Timeout** | ⚠️ NEW (verified) | No AbortController/timeout on fetch calls - add per-request timeouts |

### Medium Priority Issues

| Issue | Status | Mitigation |
|-------|--------|------------|
| **SSRF for icons** | ⚠️ Needs work | Extend `localAssetsService.ts` for `icon` type; enforce https; add size/type caps |
| **Migration location** | ✅ Pattern exists | Use `columnExists()` check in `connection.ts:28-49` |
| **Timestamp format** | ⚠️ Needs fix | Plan says Unix for `last_played_at` but should use ISO TEXT consistently |
| **IGDB ID arrays** | ✅ Addressed | Use IGDB expand syntax: `fields genres.name, themes.name, game_modes.name` |
| **Background job pattern** | ✅ Pattern exists | Use existing pattern from `/sync/genres` |
| **Non-Steam Ingestion** | ⚠️ Valid gap | IGDB sync only enriches existing rows - need separate ingestion for Game Pass/EA/Ubisoft |
| **SQLite Write Throughput** | ⚠️ NEW (verified) | No WAL mode or busy_timeout configured - enable in connection.ts |
| **Unique Indexes** | ⚠️ NEW (verified) | `steam_app_id` has UNIQUE but `igdb_id`/`steamgrid_id` don't - add unique indexes |

### Low Priority Issues

| Issue | Status | Note |
|-------|--------|------|
| **Steam success:false** | ❌ Codex wrong | Already handled at steamService.ts:116 |
| **JSON inconsistent defaults** | ❌ Codex wrong | Schema uses consistent `'[]'` for arrays |
| **SteamGridDB nsfw/humor** | ❌ Codex wrong | Already filters at lines 326-329, 868-875, 1095-1162 |
| **API key logging** | ❌ Codex wrong | Only logs boolean at index.ts:76 |
| **Reviews API payload** | ⚠️ Valid | Consider `filter=summary&num_per_page=0` to reduce bandwidth |

### Missing Schema Items

Add these columns:
```sql
-- Match confidence for title-based lookups
igdb_match_confidence INTEGER DEFAULT NULL;  -- 0-100, NULL if matched by Steam ID

-- Keep IGDB data separate (don't overwrite Steam genres/platforms)
igdb_genres TEXT DEFAULT '[]';
igdb_platforms TEXT DEFAULT '[]';
igdb_summary TEXT;

-- Add unique indexes
CREATE UNIQUE INDEX IF NOT EXISTS idx_games_igdb_id_unique ON games(igdb_id) WHERE igdb_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_games_steamgrid_id_unique ON games(steamgrid_id) WHERE steamgrid_id IS NOT NULL;
```

### Design Decisions

1. **Conflict Resolution**: Keep separate columns for Steam and IGDB data - don't merge. UI can display both or prefer Steam when available.
2. **Non-Steam Matching**: Use title search with year filter; store `igdb_match_confidence` (0-100); allow manual override via Cover Fix page pattern.
3. **Auth**: Local-only for now (home server). Can add `SYNC_SECRET` header check later if exposed.
4. **Asset Storage**: Continue current pattern - download to local disk, store local URL in DB. Remote URL as fallback reference only.
5. **HTML Sanitization**: Store raw HTML server-side; sanitize with DOMPurify on ALL render paths (not just AboutCard).

---

## Final Implementation Steps

### Step 1: Schema Migration
**File:** `server/src/db/schema.ts`

Add new columns to games table:
```sql
-- Game type and age
game_type TEXT DEFAULT 'game'
required_age INTEGER DEFAULT 0
is_free INTEGER DEFAULT 0

-- Platform support
platforms TEXT DEFAULT '{}'          -- JSON: {windows, mac, linux}
controller_support TEXT              -- full/partial/none
supported_languages TEXT             -- HTML string

-- Links
website TEXT
background_url TEXT

-- Requirements (JSON)
pc_requirements TEXT DEFAULT '{}'
mac_requirements TEXT DEFAULT '{}'
linux_requirements TEXT DEFAULT '{}'

-- Media
movies TEXT DEFAULT '[]'             -- JSON array of trailers

-- Stats
recommendations_total INTEGER
achievements_total INTEGER

-- Reviews (expanded)
review_score INTEGER                 -- 1-9 scale
review_score_desc TEXT               -- "Overwhelmingly Positive"
reviews_positive INTEGER
reviews_negative INTEGER

-- Pricing
price_currency TEXT
price_initial INTEGER                -- cents
price_final INTEGER                  -- cents
price_discount_percent INTEGER

-- Content
content_descriptors TEXT DEFAULT '[]'
dlc_app_ids TEXT DEFAULT '[]'

-- Timestamps
last_played_at TEXT
steam_data_updated_at TEXT
```

### Step 2: Update SteamAppDetails Interface
**File:** `server/src/services/steamService.ts`

Expand the interface to capture ALL fields from appdetails API.

### Step 3: Update Repository
**File:** `server/src/db/repositories/gameRepository.ts`

- Add all new fields to `CreateGameInput`
- Update `upsertGameBySteamAppId()` to handle new fields

### Step 4: Enhanced Full Sync
**File:** `server/src/routes/sync.ts`

Update `POST /api/sync/steam` to:
1. Fetch appdetails (all fields)
2. Fetch reviews in same pass
3. Store everything in database
4. Track `steam_data_updated_at`

### Step 5: IGDB Service (NEW)
**File:** `server/src/services/igdbService.ts` (CREATE)

Create new IGDB service:
```typescript
// Authentication
async function getIGDBToken(): Promise<string>

// Lookup functions
async function searchGameByTitle(title: string): Promise<IGDBGame | null>
async function getGameBySteamId(steamAppId: number): Promise<IGDBGame | null>
async function getGameByIGDBId(igdbId: number): Promise<IGDBGame>

// Sync function
async function enrichGameWithIGDB(gameId: number): Promise<void>
```

**New endpoint:** `POST /api/sync/igdb`
- Looks up all games by Steam ID or title
- Stores `igdb_id` as universal identifier
- Fetches ratings, genres, themes, game modes
- ~12 min for 2860 games (4 req/sec)

**Environment variables:**
```
TWITCH_CLIENT_ID=<from Twitch Developer Console>
TWITCH_CLIENT_SECRET=<from Twitch Developer Console>
```

### Step 6: SteamGridDB Enrichment
**File:** `server/src/services/steamGridDBService.ts`

Add new function `enrichGameWithSteamGridDB(gameId)`:
1. Lookup game by Steam App ID (or IGDB ID, or title search)
2. Store `steamgrid_id`, `steamgrid_name`, `steamgrid_verified`
3. Fetch counts for grids, heroes, logos, icons
4. Fetch and download icon (best scoring)
5. Store asset counts for UI display

**New endpoint:** `POST /api/sync/steamgrid`
- Enriches all games with SteamGridDB data
- Downloads icons for games missing them
- ~12 min for 2860 games (4 req/sec)

### Step 7: Update Client Types
**File:** `client/src/types/game.ts`

Add all new fields to Game interface.

### Step 8: Display New Data (Future)
- Platform icons on game cards/detail
- Controller support badge
- Achievements count
- Trailers section
- Price info (if applicable)

---

## Verification

### Phase 1: Schema
1. Run schema migration
2. Verify columns exist (~45 new columns)

### Phase 2: Steam Sync (~70 min)
3. Start: `curl -X POST http://localhost:3001/api/sync/steam`
4. Monitor: `curl http://localhost:3001/api/sync/status`
5. Verify:
   ```sql
   SELECT title, metacritic_score, platforms, achievements_total
   FROM games WHERE steam_data_updated_at IS NOT NULL LIMIT 5;
   ```

### Phase 3: IGDB Sync (~12 min)
6. Start: `curl -X POST http://localhost:3001/api/sync/igdb`
7. Verify ALL games (including non-Steam):
   ```sql
   SELECT title, igdb_id, igdb_aggregated_rating, themes, game_modes
   FROM games WHERE igdb_id IS NOT NULL LIMIT 5;

   -- Check non-Steam games have data now
   SELECT title, igdb_id, igdb_aggregated_rating
   FROM games WHERE steam_app_id IS NULL AND igdb_id IS NOT NULL;
   ```

### Phase 4: SteamGridDB Sync (~12 min)
8. Start: `curl -X POST http://localhost:3001/api/sync/steamgrid`
9. Verify:
   ```sql
   SELECT title, steamgrid_name, grids_count, heroes_count, icon_url
   FROM games WHERE steamgrid_id IS NOT NULL LIMIT 5;
   ```

### Phase 5: UI (Future)
10. Check game detail page displays new fields
11. Verify non-Steam games show IGDB ratings

---

## Quick Implementation Order

**Step 1: Schema Migration + DB Config** (~20 min)
- Add ~51 new columns to `connection.ts` migrations using `columnExists()` pattern
- Add unique indexes for `igdb_id` and `steamgrid_id`
- Enable WAL mode and busy_timeout in connection.ts
- Add indexes for new filterable fields

**Step 2: Enhanced Steam Sync** (~2.5 hours)
- Expand `SteamAppDetails` interface with all fields
- Create `updateSteamMetadata()` with COALESCE pattern (preserve existing data)
- Add exponential backoff with `Retry-After` header handling for 429 responses
- Add AbortController with per-request timeout (30s)
- Use `filter=summary&num_per_page=0` for reviews API
- Test on 5 games first

**Step 3: IGDB Service** (~3 hours)
- Create `igdbService.ts` with OAuth token caching
- Lookup by Steam ID first (via `external_games`) - set `igdb_match_confidence = NULL`
- Title search fallback - set `igdb_match_confidence = 0-100` based on string similarity
- Add `/api/sync/igdb` endpoint with background job pattern
- Add per-request timeout with AbortController

**Step 4: SteamGridDB Enrichment** (~1.5 hours)
- Extend `localAssetsService.ts` to support `icon` type
- Add SSRF hardening: `redirect: 'error'`, verify final URL, enforce https, size/type caps
- Store asset counts (grids, heroes, logos, icons)
- Add `/api/sync/steamgrid/enrich` endpoint with background job pattern

**Step 5: Client Updates** (~1 hour)
- Update `client/src/types/game.ts` with all new fields
- Add DOMPurify to any component rendering HTML fields: `supported_languages`, `igdb_summary`, `storyline`, `pc_requirements`, etc.
- Update any components using the Game type

**Total Estimated Dev Time:** ~8.5 hours (not counting sync runtime)

---

## Mitigations Checklist

Before implementation is complete, verify these are addressed:

- [ ] 429 backoff with `Retry-After` header handling
- [ ] AbortController with timeout on all fetch calls
- [ ] COALESCE pattern in upsert to preserve existing data
- [ ] `redirect: 'error'` on asset downloads
- [ ] WAL mode enabled in SQLite
- [ ] DOMPurify on ALL HTML rendering (not just AboutCard)
- [ ] Unique indexes on `igdb_id` and `steamgrid_id`
- [ ] `igdb_match_confidence` column populated correctly
