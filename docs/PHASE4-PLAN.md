# Phase 4: Collections & Smart Filters - Implementation Plan

**Milestone:** "I can organize games into custom collections"

**Scope:** 2,420 games, user wants to create manual collections and saved filter presets

---

## Current State Analysis

### What's Ready
- **Database schema exists** - `collections` and `collection_games` tables already in `schema.ts`
- **URL state pattern** - `useFilterParams` hook manages filters via query params
- **Service layer pattern** - `fetchApi` wrapper for HTTP calls
- **Caching pattern** - Module-level cache in `useFilterOptions`

### What's Missing
- Collection repository functions
- Collection API routes
- Collection service (client)
- Collection hooks (client)
- UI components for managing collections
- Integration with filter sidebar

---

## Database Schema (Already Exists)

```sql
-- server/src/db/schema.ts (lines 40-57)
CREATE TABLE IF NOT EXISTS collections (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  is_smart_filter INTEGER DEFAULT 0,
  filter_criteria TEXT,  -- JSON for smart filters
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS collection_games (
  collection_id INTEGER NOT NULL,
  game_id INTEGER NOT NULL,
  PRIMARY KEY (collection_id, game_id),
  FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
  FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE
);
```

**Add indexes** (new):
```sql
CREATE INDEX IF NOT EXISTS idx_collection_games_collection ON collection_games(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_games_game ON collection_games(game_id);
```

---

## Feature Breakdown

### Feature 1: Custom Collections (Manual)
- Create named collections ("Favorites", "Play with Friends", "Cozy Games")
- Add/remove games from collections
- View games in a collection
- Edit collection name/description
- Delete collections

### Feature 2: Smart Filters (Saved Presets)
- Save current filter state as a smart filter
- Smart filters dynamically query based on criteria
- Examples: "High-rated RPGs", "Steam Indies", "Multiplayer Games"
- Stored as JSON in `filter_criteria` column

### Feature 3: Collection Sidebar
- Collections listed in FilterSidebar below genres
- Click collection to filter games
- Visual indicator for active collection
- "Create Collection" button

### Feature 4: Quick Add to Collection
- GameCard hover shows "+" button
- Click opens collection picker dropdown
- Can add to multiple collections

---

## Implementation Tasks

### Task 1: Collection Repository
**File:** `server/src/db/repositories/collectionRepository.ts` (new)

```typescript
// Types (snake_case to match DB columns, like GameRow)
export interface CollectionRow {
  id: number;
  name: string;
  description: string | null;
  is_smart_filter: number;
  filter_criteria: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateCollectionInput {
  name: string;
  description?: string;
  isSmartFilter?: boolean;
  filterCriteria?: Record<string, unknown>;
}

// Functions
export function getAllCollections(): CollectionRow[]
export function getCollectionById(id: number): CollectionRow | null
export function insertCollection(input: CreateCollectionInput): number
export function updateCollection(id: number, input: Partial<CreateCollectionInput>): boolean
  // IMPORTANT: Must set updated_at = datetime('now') in UPDATE statement
export function deleteCollection(id: number): boolean

// Junction table
export function addGameToCollection(collectionId: number, gameId: number): void
  // IMPORTANT: Use INSERT OR IGNORE to avoid PK conflicts (like addGamePlatform pattern)
export function removeGameFromCollection(collectionId: number, gameId: number): boolean
export function getGamesInCollection(collectionId: number): number[]  // game IDs
export function getCollectionsForGame(gameId: number): number[]  // collection IDs
export function getCollectionGameCounts(): Array<{collection_id: number, count: number}>
  // Return array instead of Map for JSON serialization in routes
```

### Task 2: Update Game Repository + Routes
**File:** `server/src/db/repositories/gameRepository.ts` (modify)

Add to `GameQueryOptions`:
```typescript
export interface GameQueryOptions {
  // ... existing
  collectionIds?: number[];   // Filter by collection IDs (multi-select)
}
```

Update `getAllGames()` to support collection filtering:
```typescript
if (collectionIds && collectionIds.length > 0) {
  const placeholders = collectionIds.map(() => '?').join(', ');
  conditions.push(`
    id IN (SELECT game_id FROM collection_games
           WHERE collection_id IN (${placeholders}))
  `);
  collectionIds.forEach(id => params.push(id));
}
```

**File:** `server/src/routes/games.ts` (modify)

Parse `collections` query param in GET /api/games:
```typescript
// In route handler, after existing param parsing:
const collections = req.query.collections as string | undefined;
const collectionIds = collections
  ? collections.split(',').map(Number).filter(n => !isNaN(n))
  : undefined;

// Pass to getAllGames:
const options: GameQueryOptions = {
  // ... existing
  collectionIds,
};
```

### Task 3: Collection Routes
**File:** `server/src/routes/collections.ts` (new)

```
GET    /api/collections              - List all collections with game counts
GET    /api/collections/:id          - Get single collection
POST   /api/collections              - Create collection
PUT    /api/collections/:id          - Update collection
DELETE /api/collections/:id          - Delete collection

POST   /api/collections/:id/games/:gameId   - Add game to collection
DELETE /api/collections/:id/games/:gameId   - Remove game from collection
GET    /api/collections/:id/games           - List games in collection (paginated)
```

Response format (snake_case like existing routes - client transforms):
```json
{
  "success": true,
  "data": {
    "id": 1,
    "name": "Favorites",
    "description": "My favorite games",
    "is_smart_filter": 0,
    "filter_criteria": null,
    "game_count": 42,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
}
```

**IMPORTANT:** Follow existing pattern from `routes/games.ts`:
- Return raw `CollectionRow` from repository (snake_case)
- Client service transforms to camelCase

**Game counts merge in GET /api/collections:**
```typescript
router.get('/', (_req, res) => {
  const collections = getAllCollections();
  const counts = getCollectionGameCounts();  // Returns Array<{collection_id, count}>

  // Merge counts into collection responses
  const countsMap = new Map(counts.map(c => [c.collection_id, c.count]));
  const data = collections.map(c => ({
    ...c,
    game_count: countsMap.get(c.id) || 0,
  }));

  res.json({ success: true, data });
});
```

### Task 4: Mount Routes
**File:** `server/src/index.ts` (modify)

```typescript
import collectionsRouter from './routes/collections.js';
app.use('/api/collections', collectionsRouter);
```

### Task 5: Add Schema Indexes
**File:** `server/src/db/schema.ts` (modify)

Add after existing indexes:
```sql
CREATE INDEX IF NOT EXISTS idx_collection_games_collection ON collection_games(collection_id);
CREATE INDEX IF NOT EXISTS idx_collection_games_game ON collection_games(game_id);
```

### Task 6: Collection Types (Client)
**File:** `client/src/types/collection.ts` (new)

```typescript
// Raw API response (snake_case from server)
export interface CollectionApiResponse {
  id: number;
  name: string;
  description: string | null;
  is_smart_filter: number;  // SQLite stores as 0/1
  filter_criteria: string | null;  // JSON string
  game_count: number;
  created_at: string;
  updated_at: string;
}

// Client-side type (camelCase)
export interface Collection {
  id: number;
  name: string;
  description: string | null;
  isSmartFilter: boolean;
  filterCriteria: FilterCriteria | null;
  gameCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface FilterCriteria {
  search?: string;
  platforms?: string[];
  genres?: string[];
  sortBy?: string;
  sortOrder?: string;
}

export interface CreateCollectionInput {
  name: string;
  description?: string;
  isSmartFilter?: boolean;
  filterCriteria?: FilterCriteria;
}

// Transform function (like transformGame in game.ts)
export function transformCollection(raw: CollectionApiResponse): Collection {
  return {
    id: raw.id,
    name: raw.name,
    description: raw.description,
    isSmartFilter: Boolean(raw.is_smart_filter),  // Convert 0/1 to boolean
    filterCriteria: raw.filter_criteria ? JSON.parse(raw.filter_criteria) : null,
    gameCount: raw.game_count,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
  };
}
```

### Task 7: Collections Service (Client)
**File:** `client/src/services/collectionsService.ts` (new)

```typescript
import { fetchApi } from './api';
import { Collection, CollectionApiResponse, transformCollection, CreateCollectionInput } from '../types/collection';

interface CollectionsApiResponse {
  success: boolean;
  data: CollectionApiResponse[];
}

interface CollectionApiResponseSingle {
  success: boolean;
  data: CollectionApiResponse;
}

export async function fetchCollections(): Promise<Collection[]> {
  const response = await fetchApi<CollectionsApiResponse>('/collections');
  return response.data.map(transformCollection);
}

export async function fetchCollection(id: number): Promise<Collection> {
  const response = await fetchApi<CollectionApiResponseSingle>(`/collections/${id}`);
  return transformCollection(response.data);
}

export async function createCollection(input: CreateCollectionInput): Promise<Collection> {
  // IMPORTANT: JSON.stringify filterCriteria before sending to server
  const body = {
    name: input.name,
    description: input.description,
    is_smart_filter: input.isSmartFilter ? 1 : 0,
    filter_criteria: input.filterCriteria ? JSON.stringify(input.filterCriteria) : null,
  };
  const response = await fetchApi<CollectionApiResponseSingle>('/collections', {
    method: 'POST',
    body: JSON.stringify(body),
  });
  return transformCollection(response.data);
}

export async function updateCollection(id: number, input: Partial<CreateCollectionInput>): Promise<Collection>
export async function deleteCollection(id: number): Promise<void>
export async function addGameToCollection(collectionId: number, gameId: number): Promise<void>
export async function removeGameFromCollection(collectionId: number, gameId: number): Promise<void>
```

**File:** `client/src/services/gamesService.ts` (modify)

Add `collections` param to `FetchGamesParams`:
```typescript
export interface FetchGamesParams {
  // ... existing
  collections?: number[];  // Collection IDs to filter by
}

// In fetchGames function, add to query params:
if (params.collections?.length) {
  queryParams.set('collections', params.collections.join(','));
}
```

### Task 8: useCollections Hook
**File:** `client/src/hooks/useCollections.ts` (new)

```typescript
import { useState, useEffect, useRef } from 'react';
import { fetchCollections } from '../services/collectionsService';
import { Collection } from '../types/collection';

// Module-level cache (same pattern as useFilterOptions)
let cachedCollections: Collection[] | null = null;
let cachePromise: Promise<Collection[]> | null = null;  // Prevent duplicate requests

export function useCollections(): {
  collections: Collection[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
} {
  const [collections, setCollections] = useState<Collection[]>(cachedCollections || []);
  const [loading, setLoading] = useState(!cachedCollections);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    if (cachedCollections) {
      setCollections(cachedCollections);
      setLoading(false);
      return;
    }

    // Use shared promise to prevent duplicate requests
    if (!cachePromise) {
      cachePromise = fetchCollections();
    }

    cachePromise
      .then((data) => {
        cachedCollections = data;
        if (mountedRef.current) {
          setCollections(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mountedRef.current) {
          setError(err.message);
          setLoading(false);
        }
      });
  }, []);

  const refresh = () => {
    cachedCollections = null;
    cachePromise = null;
    setLoading(true);
    fetchCollections()
      .then((data) => {
        cachedCollections = data;
        if (mountedRef.current) {
          setCollections(data);
          setLoading(false);
        }
      });
  };

  return { collections, loading, error, refresh };
}

export function clearCollectionsCache(): void {
  cachedCollections = null;
  cachePromise = null;
}
```

### Task 9: Update useFilterParams
**File:** `client/src/hooks/useFilterParams.ts` (modify)

**Step 1:** Add `collectionIds` to `FilterState`:
```typescript
export interface FilterState {
  search: string;
  platforms: string[];
  genres: string[];
  collectionIds: number[];  // NEW
  sortBy: SortByType;
  sortOrder: SortOrderType;
}
```

**Step 2:** Parse `collections` from URL params (in useMemo for filters):
```typescript
const filters = useMemo(() => ({
  // ... existing
  collectionIds: parseArrayParam(searchParams.get('collections')).map(Number).filter(n => !isNaN(n)),
}), [searchParams]);
```

**Step 3:** Add setCollections and toggleCollection functions:
```typescript
const setCollections = useCallback((ids: number[]) => {
  updateParams({ collections: ids.length > 0 ? ids.join(',') : null });
}, [updateParams]);

const toggleCollection = useCallback((collectionId: number) => {
  const current = filters.collectionIds;
  const newIds = current.includes(collectionId)
    ? current.filter(id => id !== collectionId)
    : [...current, collectionId];
  setCollections(newIds);
}, [filters.collectionIds, setCollections]);
```

**Step 4:** Update `hasActiveFilters` to include collections:
```typescript
const hasActiveFilters = useMemo(() => {
  return (
    filters.search.length > 0 ||
    filters.platforms.length > 0 ||
    filters.genres.length > 0 ||
    filters.collectionIds.length > 0 ||  // NEW
    filters.sortBy !== 'title' ||
    filters.sortOrder !== 'asc'
  );
}, [filters]);
```

**Step 5:** Update `clearFilters` to include collections:
```typescript
const clearFilters = useCallback(() => {
  setSearchInput('');
  updateParams({
    search: null,
    platforms: null,
    genres: null,
    collections: null,  // NEW
    sortBy: null,
    sortOrder: null,
  });
}, [updateParams]);
```

**Step 6:** Add to return object:
```typescript
return {
  // ... existing
  setCollections,
  toggleCollection,
};
```

### Task 10: Update useGames Hook
**File:** `client/src/hooks/useGames.ts` (modify)

**Step 1:** Add `collections` to params type:
```typescript
export function useGames(
  params: Omit<FetchGamesParams, 'page' | 'pageSize'> = {}
): UseGamesResult
```

**Step 2:** Include collections in the dependency array and API call:
```typescript
// In the useEffect dependency, include params.collections
useEffect(() => {
  // Reset and fetch when filters change including collections
}, [params.search, params.genres, params.platforms, params.collections, ...]);

// In the fetchGames call, pass collections
const response = await fetchGames({
  page: currentPage,
  pageSize: PAGE_SIZE,
  search: params.search,
  genres: params.genres,
  platforms: params.platforms,
  collections: params.collections,  // NEW
  sortBy: params.sortBy,
  sortOrder: params.sortOrder,
});
```

**Step 3:** LibraryPage passes collections from filters:
```typescript
const { games, total, loading, hasMore, loadMore } = useGames({
  search: filters.search,
  platforms: filters.platforms,
  genres: filters.genres,
  collections: filters.collectionIds,  // NEW
  sortBy: filters.sortBy,
  sortOrder: filters.sortOrder,
});
```

### Task 11: Update FilterSidebar
**File:** `client/src/components/FilterSidebar.tsx` (modify)

Add collections section after genres:
```tsx
interface FilterSidebarProps {
  // ... existing
  collections: Collection[];
  selectedCollections: number[];
  onToggleCollection: (id: number) => void;
  onCreateCollection: () => void;
}

// In render:
{/* Collections Section */}
<div>
  <div className="flex items-center justify-between mb-3">
    <h3 className="text-sm font-medium text-steam-text">Collections</h3>
    <button
      onClick={onCreateCollection}
      className="text-xs text-steam-accent hover:text-steam-text"
    >
      + New
    </button>
  </div>
  {collections.length === 0 ? (
    <p className="text-xs text-steam-text-muted italic">No collections yet</p>
  ) : (
    <div className="space-y-2">
      {collections.map((collection) => (
        <label key={collection.id} className="flex items-center gap-2 cursor-pointer group">
          <input
            type="checkbox"
            checked={selectedCollections.includes(collection.id)}
            onChange={() => onToggleCollection(collection.id)}
            className="w-4 h-4 rounded border-steam-border bg-steam-bg-card text-steam-accent"
          />
          <span className="text-sm text-steam-text-muted group-hover:text-steam-text flex-1">
            {collection.name}
          </span>
          <span className="text-xs text-steam-text-muted">
            {collection.gameCount}
          </span>
        </label>
      ))}
    </div>
  )}
</div>
```

### Task 11b: Smart Filter Behavior
**Key difference between Collections and Smart Filters:**

- **Collections (is_smart_filter=0):** Filter by junction table - show games IN collection
- **Smart Filters (is_smart_filter=1):** Apply saved filter_criteria to URL params

**FilterSidebar click behavior:**
```tsx
const handleCollectionClick = (collection: Collection) => {
  if (collection.isSmartFilter && collection.filterCriteria) {
    // Smart filter: Clear existing filters first, then apply saved criteria
    // This prevents unintended filter stacking
    clearFilters();

    const criteria = collection.filterCriteria;
    // Apply each saved filter (empty values remain cleared)
    if (criteria.search) setSearch(criteria.search);
    if (criteria.platforms?.length) setPlatforms(criteria.platforms);
    if (criteria.genres?.length) setGenres(criteria.genres);
    if (criteria.sortBy) setSortBy(criteria.sortBy);
    if (criteria.sortOrder) setSortOrder(criteria.sortOrder);
  } else {
    // Regular collection: Toggle collection filter
    onToggleCollection(collection.id);
  }
};
```

**Visual distinction in sidebar:**
```tsx
{collections.map((collection) => (
  <label key={collection.id} className="flex items-center gap-2 cursor-pointer group">
    {collection.isSmartFilter ? (
      // Smart filter: Click applies filters (no checkbox, just clickable)
      <span className="text-steam-accent">⚡</span>
    ) : (
      // Regular collection: Checkbox toggle
      <input type="checkbox" checked={selectedCollections.includes(collection.id)} ... />
    )}
    <span onClick={() => handleCollectionClick(collection)}>
      {collection.name}
    </span>
    <span className="text-xs text-steam-text-muted">
      {collection.isSmartFilter ? 'Smart' : collection.gameCount}
    </span>
  </label>
))}
```

### Task 12: Collection Modal Component
**File:** `client/src/components/CollectionModal.tsx` (new)

Simple modal for create/edit:
```tsx
interface CollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (input: CreateCollectionInput) => void;
  collection?: Collection;  // For edit mode
  currentFilters?: FilterState;  // For "Save as Smart Filter"
}
```

Features:
- Name input (required)
- Description textarea (optional)
- "Save current filters" checkbox (creates smart filter)
- When checked, captures current filters into filterCriteria
- Save/Cancel buttons

### Task 13: Add to Collection Dropdown
**File:** `client/src/components/AddToCollectionDropdown.tsx` (new)

Dropdown menu for GameCard:
```tsx
interface AddToCollectionDropdownProps {
  gameId: number;
  collections: Collection[];
  gameCollectionIds: number[];  // Collections this game is already in
  onToggle: (collectionId: number) => void;
}
```

### Task 14: Update GameCard
**File:** `client/src/components/GameCard.tsx` (modify)

Add "+" button on hover:
```tsx
interface GameCardProps {
  game: Game;
  collections?: Collection[];
  gameCollectionIds?: number[];
  onAddToCollection?: (gameId: number, collectionId: number) => void;
}

// In render (on hover):
<button
  onClick={(e) => {
    e.stopPropagation();
    setShowCollectionDropdown(true);
  }}
  className="absolute top-2 right-2 opacity-0 group-hover:opacity-100
             bg-steam-bg-dark/80 p-1 rounded"
>
  <PlusIcon className="w-4 h-4 text-steam-accent" />
</button>
```

### Task 15: Update LibraryPage
**File:** `client/src/pages/LibraryPage.tsx` (modify)

Integrate collections:
```tsx
const { collections, loading: collectionsLoading, refresh: refreshCollections } = useCollections();
const [showCollectionModal, setShowCollectionModal] = useState(false);

// Pass to FilterSidebar
<FilterSidebar
  // ... existing props
  collections={collections}
  selectedCollections={filters.collectionIds}
  onToggleCollection={toggleCollection}
  onCreateCollection={() => setShowCollectionModal(true)}
/>

// Collection modal
{showCollectionModal && (
  <CollectionModal
    isOpen={showCollectionModal}
    onClose={() => setShowCollectionModal(false)}
    onSave={handleCreateCollection}
    currentFilters={filters}
  />
)}
```

### Task 16: Server Unit Tests
**File:** `server/src/db/repositories/collectionRepository.test.ts` (new)

Test all CRUD operations and junction table operations.

### Task 17: Client Unit Tests
**Files:**
- `client/src/services/collectionsService.test.ts`
- `client/src/hooks/useCollections.test.ts`
- `client/src/components/CollectionModal.test.tsx`

### Task 18: E2E Tests
**File:** `e2e/tests/collections.spec.ts` (new)

Test scenarios:
- Create collection
- Add game to collection
- Filter by collection
- Edit collection
- Delete collection
- Smart filter creation and filtering

---

## UI Mockup

```
┌─────────────────────────────────────────────────────────────────────┐
│ Game Collection          [🔍 Search...           ] [Sort: Title A-Z] │
│ Showing 42 of 2,420                                                 │
├──────────────┬──────────────────────────────────────────────────────┤
│ FILTERS      │                                                      │
│ [Clear All]  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐       │
│              │  │  Game  │ │  Game  │ │  Game  │ │  Game  │       │
│ Platform     │  │ [+]    │ │ [+]    │ │ [+]    │ │ [+]    │       │
│ ☑ Steam      │  └────────┘ └────────┘ └────────┘ └────────┘       │
│              │                                                      │
│ Genre        │  [+] = Add to Collection button (on hover)          │
│ ☐ Action     │                                                      │
│ ☐ RPG        │                                                      │
│              │                                                      │
│ Collections  │                                                      │
│ [+ New]      │                                                      │
│ ☑ Favorites     (12)                                               │
│ ☐ Cozy Games    (8)                                                │
│ ☐ Multiplayer   (25)                                               │
│              │                                                      │
│ Smart Filters│                                                      │
│ ☐ High-rated RPGs                                                  │
│ ☐ Steam Indies                                                     │
└──────────────┴──────────────────────────────────────────────────────┘
```

---

## File Summary

### New Files (Server)
| File | Purpose |
|------|---------|
| `server/src/db/repositories/collectionRepository.ts` | Collection CRUD + junction operations |
| `server/src/db/repositories/collectionRepository.test.ts` | Unit tests |
| `server/src/routes/collections.ts` | Collection API routes |

### Modified Files (Server)
| File | Changes |
|------|---------|
| `server/src/db/schema.ts` | Add indexes for collection_games |
| `server/src/db/repositories/gameRepository.ts` | Add collectionIds filter support |
| `server/src/index.ts` | Mount collections router |

### New Files (Client)
| File | Purpose |
|------|---------|
| `client/src/types/collection.ts` | TypeScript types |
| `client/src/services/collectionsService.ts` | API calls |
| `client/src/hooks/useCollections.ts` | Data fetching hook |
| `client/src/components/CollectionModal.tsx` | Create/edit dialog |
| `client/src/components/AddToCollectionDropdown.tsx` | Quick-add dropdown |

### Modified Files (Client)
| File | Changes |
|------|---------|
| `client/src/hooks/useFilterParams.ts` | Add collectionIds to state |
| `client/src/hooks/useGames.ts` | Pass collectionIds to API |
| `client/src/services/gamesService.ts` | Add collections param |
| `client/src/components/FilterSidebar.tsx` | Add collections section |
| `client/src/components/GameCard.tsx` | Add "+" button |
| `client/src/pages/LibraryPage.tsx` | Integrate collections |

### New E2E Tests
| File | Purpose |
|------|---------|
| `e2e/tests/collections.spec.ts` | Collection workflow tests |

---

## Implementation Order

1. **Server: Repository** - Task 1, 5 (schema indexes)
2. **Server: Routes** - Task 3, 4
3. **Server: Game filter** - Task 2
4. **Server: Tests** - Task 16
5. **Client: Types & Service** - Task 6, 7
6. **Client: Hook** - Task 8
7. **Client: Filter integration** - Task 9, 10, 11
8. **Client: Modal** - Task 12
9. **Client: GameCard integration** - Task 13, 14
10. **Client: LibraryPage** - Task 15
11. **Client: Tests** - Task 17
12. **E2E Tests** - Task 18

---

## Success Criteria

- [ ] Can create/edit/delete collections
- [ ] Can add/remove games from collections
- [ ] Can filter game grid by collection
- [ ] Collections show in sidebar with game counts
- [ ] Can create smart filter from current filters
- [ ] Smart filters dynamically show matching games
- [ ] GameCard has quick-add to collection button
- [ ] All existing tests pass
- [ ] New unit tests for collection features
- [ ] New E2E tests for collection workflows
- [ ] URL state includes collection filters (shareable)

---

## Estimated Effort

| Category | Tasks | Complexity |
|----------|-------|------------|
| Server Repository | 1, 2, 5 | Medium |
| Server Routes | 3, 4 | Medium |
| Client Service/Hooks | 6, 7, 8, 9, 10 | Medium |
| Client UI Components | 11, 12, 13, 14, 15 | High |
| Tests | 16, 17, 18 | Medium |

**Total: 18 tasks across server and client**

---

## Codex Verification Fixes Applied

The plan was verified by Codex (gpt-5.2-codex, high reasoning effort) in two passes. All identified issues have been fixed:

### First Review - Fixed
| Issue | Severity | Fix Applied |
|-------|----------|-------------|
| Collection filtering not wired end-to-end | High | Added explicit route parsing in Task 2, gamesService update in Task 7, useGames update in Task 10 |
| Response casing inconsistency | High | Updated Task 3 to return snake_case, added transform function in Task 6 |
| useFilterParams incomplete | Medium | Expanded Task 9 with 6 explicit steps covering parsing, hasActiveFilters, clearFilters |
| Repository pattern alignment | Medium | Added notes for INSERT OR IGNORE, updated_at, and array return type in Task 1 |
| Smart filters logic incomplete | Medium | Added Task 11b explaining smart filter behavior vs regular collections |
| Type/caching drift | Low | Expanded Task 8 with full cachePromise pattern like useFilterOptions |

### Second Review - Fixed
| Issue | Severity | Fix Applied |
|-------|----------|-------------|
| is_smart_filter type mismatch | Low | Changed CollectionApiResponse to `number`, added `Boolean()` conversion in transform |
| Smart filter stacking | Medium | Added `clearFilters()` call before applying smart filter criteria in Task 11b |
| Unused collectionId singular | Low | Removed from GameQueryOptions (only collectionIds array needed) |
| filterCriteria serialization | Medium | Added full createCollection implementation showing JSON.stringify |
| Game counts merge step | Low | Added route code example showing counts merge in Task 3 |
