# Phase 3: Filtering, Search & Sort - Implementation Plan

**Codex Review: 7/10 → 8/10 → 8.5/10** (4 rounds, issues addressed below)

### Codex Feedback Addressed (Round 1 → 7/10)
| Issue | Resolution |
|-------|------------|
| Single-select vs checkboxes mismatch | Changed to `platforms: string[]`, `genres: string[]` |
| URL history spam | Use `replace` for keystrokes, `push` for filters |
| Missing cache/empty state for genres | Added server cache (1hr), empty state UI message |
| "Showing X of Y" source unclear | Clarified: filtered total from API, unfiltered cached |
| E2E test data strategy | Skip genre tests if no data, use known titles |
| Route file inconsistency | Consolidated to `games.ts` |

### Codex Feedback Addressed (Round 2 → 8/10)
| Issue | Resolution |
|-------|------------|
| API param mismatch (singular vs plural) | Update server to accept `platforms`/`genres` CSV params |
| Double debounce (hook + component) | Debounce only in `useFilterParams`, SearchInput is controlled |
| "X of Y" with pagination unclear | API `total` is filtered count; fetch `/api/games/count` once for Y |
| No mobile sidebar fallback | Desktop-only app (per PRODUCT.md), add note |

### Codex Feedback Addressed (Round 3 → 8/10)
| Issue | Resolution |
|-------|------------|
| CSV encoding for genres with spaces | Use `encodeURIComponent` for each value before joining |
| `gamesService.ts` still uses singular params | Update to `platforms?: string[]`, `genres?: string[]` |
| `sortOptions` drift (dropdown vs API) | Dropdown renders from API response, not hardcoded |
| URL param validation | Add whitelist fallback in `useFilterParams` for invalid values |
| E2E sort test determinism | Sort tests use title sort (deterministic A-Z) |

### Codex Feedback Addressed (Round 4 → 8.5/10)
| Issue | Resolution |
|-------|------------|
| `sortOptions` needs labels/order for dropdown | Return objects: `[{ id, label, sortBy, sortOrder }]` |
| Double encoding with `useSearchParams` | Pass raw values to `useSearchParams`, let it handle encoding |
| Breaking change singular→plural params | Server accepts both `platform` and `platforms` for compatibility |
| Validate platforms/genres against allowed | Intersect with filter options, ignore invalid values |
| Genre cache invalidation after sync | Clear cache after sync completion |

---

## Overview

**Goal:** "I can find games quickly with filters and search"

Add search, sort, and filter UI to the game collection app. The backend API already supports all needed parameters (`search`, `genre`, `platform`, `sortBy`, `sortOrder`). This phase is primarily UI work.

---

## Current State Analysis

### What's Already Working
- `useGames` hook accepts filter params and handles param stabilization
- Server API supports: `search`, `genre`, `tag`, `platform`, `sortBy`, `sortOrder`
- Header component has empty right slot ready for controls
- Tailwind CSS with Steam theme colors defined

### Gaps to Address
1. **No filter options endpoints** - Need API to get list of available genres/platforms
2. **No URL state sync** - Filters should persist in URL for shareability
3. **No UI components** - Need SearchBar, SortDropdown, FilterSidebar

### Data Note
Genre/tag data requires running detailed Steam sync (60+ min). Platform filtering will work immediately. Search by title works regardless.

---

## Architecture Decisions

### State Management
- Keep filter state in `LibraryPage` (lift from URL params)
- Use `useSearchParams` from react-router-dom for URL sync
- Pass filter state down to `useGames` hook

### UI Decisions (User Confirmed)
- **Sidebar: Always visible** on desktop (fixed 280px width)
- **Genre filter: Include now** (will show available genres, may be sparse until full sync)

### Component Structure
```
LibraryPage
├── Header
│   ├── SearchInput (debounced)
│   ├── SortDropdown
│   └── FilterCount ("Showing X of Y")
├── FilterSidebar (always visible, 280px)
│   ├── PlatformFilter (checkboxes)
│   └── GenreFilter (checkboxes)
└── GameGrid (existing)
```

---

## Implementation Tasks

### Task 1: Filter Options API + Multi-Select Support
**Files:** `server/src/routes/games.ts`, `server/src/db/repositories/gameRepository.ts`

**1a. Add `GET /api/games/filters` endpoint:**
```json
{
  "platforms": ["steam", "gamepass", "eaplay", "ubisoftplus"],
  "genres": ["Action", "Adventure", "RPG", ...],
  "sortOptions": [
    { "id": "title-asc", "label": "Title A-Z", "sortBy": "title", "sortOrder": "asc" },
    { "id": "title-desc", "label": "Title Z-A", "sortBy": "title", "sortOrder": "desc" },
    { "id": "release-desc", "label": "Release Date (Newest)", "sortBy": "release_date", "sortOrder": "desc" },
    { "id": "release-asc", "label": "Release Date (Oldest)", "sortBy": "release_date", "sortOrder": "asc" },
    { "id": "metacritic-desc", "label": "Metacritic Score", "sortBy": "metacritic_score", "sortOrder": "desc" },
    { "id": "added-desc", "label": "Date Added", "sortBy": "created_at", "sortOrder": "desc" }
  ]
}
```

**1b. Update `GET /api/games` to accept multi-select params:**
- Accept both `platform`/`platforms` and `genre`/`genres` (backward compatible)
- Parse CSV: `"steam,gamepass"` → `["steam", "gamepass"]`
- Repository: use `IN` clause or multiple `LIKE` conditions
- **Clear genre cache after sync completion**

**Implementation details:**
- Repository method `getDistinctGenres()` to extract unique genres from JSON column
- Genres sorted alphabetically
- Platforms are static (hardcoded)
- **Cache genres on server** (1 hour TTL) to avoid repeated DB scans

---

### Task 2: URL State Management Hook
**Files:** `client/src/hooks/useFilterParams.ts` (new)

Create hook that:
- Reads filter state from URL search params
- Provides setter functions that update URL
- Debounces search input (300ms)
- Returns typed filter object for `useGames`
- **Uses `replace` for search keystrokes** (avoid history spam)
- **Uses `push` for discrete filter changes** (checkboxes, sort)
- **Preserves unknown URL params** when updating

```typescript
interface FilterState {
  search: string;
  platforms: string[];  // Multi-select: ["steam", "gamepass"]
  genres: string[];     // Multi-select: ["Action", "RPG"]
  sortBy: 'title' | 'release_date' | 'metacritic_score' | 'created_at';
  sortOrder: 'asc' | 'desc';
}
```

**URL Schema:**
```
?search=witcher&platforms=steam,gamepass&genres=RPG,Action%20RPG&sortBy=title&sortOrder=asc
```
- **Use `useSearchParams` for encoding** - pass raw values, let it handle encoding
- For arrays: join with `,` then pass to `setSearchParams`
- Decode: `param.split(',')` (already decoded by `useSearchParams`)
- Empty arrays omitted from URL
- Invalid values: intersect with allowed options, fallback to defaults

---

### Task 3: SearchInput Component
**Files:** `client/src/components/SearchInput.tsx` (new)

- Controlled text input with search icon
- **No debounce here** (handled in `useFilterParams`)
- Clear button when has value
- Styling: `bg-steam-bg-card border-steam-border text-steam-text`
- Placeholder: "Search games..."

---

### Task 4: SortDropdown Component
**Files:** `client/src/components/SortDropdown.tsx` (new)

- Native `<select>` styled for Steam theme
- **Renders options from `useFilterOptions().sortOptions`** (not hardcoded)
- Options: Title A-Z, Title Z-A, Release Date (Newest), Release Date (Oldest), Metacritic Score, Date Added
- Combined sortBy + sortOrder into single dropdown value

---

### Task 5: FilterSidebar Component
**Files:** `client/src/components/FilterSidebar.tsx` (new)

- **Always visible** fixed sidebar (left side of grid, ~280px wide)
- Platform section with checkboxes (Steam, Game Pass, EA Play, Ubisoft+)
- Genre section with checkboxes (fetched from API)
- "Clear All Filters" button at top
- Scrollable if filters exceed viewport height
- **Loading state** while fetching filter options
- **Empty genre state:** "No genres available — run full Steam sync"

---

### Task 6: Update Header Component
**Files:** `client/src/components/Header.tsx`

Add to right side:
- SearchInput component
- SortDropdown component
- Filter count display: "Showing 42 of 2,420 games"
  - `42` = **`useGames().total`** (API returns filtered total with pagination)
  - `2,420` = **fetch `/api/games/count` once on mount** (existing endpoint)

---

### Task 7: Update LibraryPage Layout
**Files:** `client/src/pages/LibraryPage.tsx`

- Integrate `useFilterParams` hook
- Pass filter state to `useGames`
- Add FilterSidebar alongside GameGrid
- Layout: `[Sidebar 280px] [Grid flex-1]`

---

### Task 8: Client Service & Hook for Filter Options
**Files:**
- `client/src/services/gamesService.ts`
- `client/src/hooks/useFilterOptions.ts` (new)

Add `fetchFilterOptions()` service function, plus `useFilterOptions()` hook with:
- Loading/error states
- Caches result (no refetch on every render)
- Returns `{ platforms, genres, sortOptions, loading, error }`

---

### Task 9: Unit Tests
**Files:**
- `client/src/components/SearchInput.test.tsx`
- `client/src/components/SortDropdown.test.tsx`
- `client/src/components/FilterSidebar.test.tsx`
- `client/src/hooks/useFilterParams.test.ts`

Test:
- Input change handlers
- Debounce behavior
- URL parameter sync
- Filter clearing

---

### Task 10: E2E Tests
**Files:** `e2e/tests/search-filter.spec.ts` (new)

Test scenarios:
- Search filters results correctly
- Sort changes order
- Platform filter works
- URL state persists on refresh
- Clear filters resets view
- Combined filters work together

**Test data strategy:**
- Use existing Steam games (platform filter reliable)
- Search tests use known game titles from DB
- Genre tests conditionally skip if no genres populated (or seed test data)
- **Sort tests use title A-Z** (deterministic ordering with known first/last games)

---

## File Modifications Summary

### New Files
| File | Purpose |
|------|---------|
| `client/src/hooks/useFilterParams.ts` | URL state management |
| `client/src/hooks/useFilterOptions.ts` | Fetch/cache filter options |
| `client/src/components/SearchInput.tsx` | Search input component |
| `client/src/components/SortDropdown.tsx` | Sort dropdown component |
| `client/src/components/FilterSidebar.tsx` | Filter sidebar component |
| `e2e/tests/search-filter.spec.ts` | E2E tests |

### Modified Files
| File | Changes |
|------|---------|
| `server/src/routes/games.ts` | Add `/api/games/filters`, update to accept `platforms`/`genres` CSV |
| `server/src/db/repositories/gameRepository.ts` | Add `getDistinctGenres()`, update filter logic for arrays |
| `client/src/components/Header.tsx` | Add search, sort, filter count |
| `client/src/pages/LibraryPage.tsx` | Integrate filter state and sidebar |
| `client/src/services/gamesService.ts` | Update params to arrays, add `fetchFilterOptions()` |

---

## UI Mockup (ASCII)

```
┌─────────────────────────────────────────────────────────────────────┐
│ Game Collection          [🔍 Search games...    ] [Sort: Title A-Z] │
│ Showing 42 of 2,420                                                 │
├──────────────┬──────────────────────────────────────────────────────┤
│ FILTERS      │                                                      │
│ [Clear All]  │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                │
│              │  │Game│ │Game│ │Game│ │Game│ │Game│                │
│ Platform     │  └────┘ └────┘ └────┘ └────┘ └────┘                │
│ ☑ Steam      │  ┌────┐ ┌────┐ ┌────┐ ┌────┐ ┌────┐                │
│ ☐ Game Pass  │  │Game│ │Game│ │Game│ │Game│ │Game│                │
│ ☐ EA Play    │  └────┘ └────┘ └────┘ └────┘ └────┘                │
│ ☐ Ubisoft+   │                                                      │
│              │                                                      │
│ Genre        │                                                      │
│ ☐ Action     │                                                      │
│ ☐ RPG        │                                                      │
│ ☐ Adventure  │                                                      │
│ ...          │                                                      │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

## Implementation Order

1. **Task 1** - Filter Options API (server)
2. **Task 8** - Client service for filter options
3. **Task 2** - useFilterParams hook (foundation)
4. **Task 3** - SearchInput component
5. **Task 4** - SortDropdown component
6. **Task 6** - Update Header (integrate search + sort)
7. **Task 5** - FilterSidebar component
8. **Task 7** - Update LibraryPage layout
9. **Task 9** - Unit tests
10. **Task 10** - E2E tests

---

## Success Criteria

- [ ] Search by title filters results in real-time (debounced)
- [ ] Sort dropdown changes game order
- [ ] Platform filter shows only games from selected platform
- [ ] Genre filter works (if data populated)
- [ ] Filters persist in URL (refresh maintains state)
- [ ] "Clear all" resets to default view
- [ ] Filter count shows "X of Y games"
- [ ] All existing tests still pass
- [ ] New unit tests for filter components
- [ ] New E2E tests for search/filter flows
