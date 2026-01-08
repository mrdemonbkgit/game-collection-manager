# Enhanced Game Detail Page - Implementation Plan

**Goal:** Transform the Game Detail Page into a cinematic, feature-rich experience inspired by **Ubisoft Connect** app design.

**Reference:** Ubisoft Connect game detail page (Watch Dogs: Legion screenshot)

---

## User Preferences

| Feature | Choice |
|---------|--------|
| Hero Layout | Full-bleed cinematic artwork (Ubisoft-style) |
| Key Sections | Ratings & Reviews hub, Platform availability grid |
| Interactions | Quick actions bar, Similar games carousel |
| Integrations | Store links, Media links, Review aggregators |

---

## Design Overview (Ubisoft-Inspired)

```
┌─────────────────────────────────────────────────────────────────┐
│ ◄ Back                                                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ╔══════════════════════════════════════════════════════════╗  │
│  ║                                                          ║  │
│  ║     ██╗    ██╗ █████╗ ████████╗ ██████╗██╗  ██╗         ║  │
│  ║     ██║    ██║██╔══██╗╚══██╔══╝██╔════╝██║  ██║         ║  │
│  ║     ██║ █╗ ██║███████║   ██║   ██║     ███████║         ║  │
│  ║     ╚██╗╚██╔╝██╔══██║   ██║   ██║     ██╔══██║         ║  │
│  ║      ╚███╔╝ ██║  ██║   ██║   ╚██████╗██║  ██║         ║  │
│  ║       ╚══╝  ╚═╝  ╚═╝   ╚═╝    ╚═════╝╚═╝  ╚═╝         ║  │
│  ║                 DOGS: LEGION                             ║  │
│  ║                                                          ║  │
│  ║  Owned on [STEAM] [UBISOFT+]     Playtime: 42 hours     ║  │
│  ║                                                          ║  │
│  ║  [▶ Play]  [+ Collection]  [⚙ Settings]                 ║  │
│  ║                                                          ║  │
│  ╚══════════════════════════════════════════════════════════╝  │
│                                                                 │
├─────────────────────────────────────────────────────────────────┤
│  STATS CARDS (Grid below hero, Ubisoft-style)                   │
│                                                                 │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐   │
│  │ Ratings         │ │ Platforms       │ │ Media           │   │
│  │                 │ │                 │ │                 │   │
│  │  MC  │ Steam    │ │ [Steam]    ✓   │ │ ▶ Trailer       │   │
│  │  85  │  92%     │ │ [Game Pass] ✓  │ │ 📺 Twitch       │   │
│  │      │ (12.4k)  │ │ [EA Play]   ✓  │ │                 │   │
│  │                 │ │                 │ │ [OpenCritic]    │   │
│  │ [IGN] [GameSpot]│ │ [Store Links]  │ │ [IGN] [GameSpot]│   │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────┐ ┌─────────────────┐   │
│  │ Screenshots                          │ │ Genres & Tags   │   │
│  │                                      │ │                 │   │
│  │  [img] [img] [img] [img] ►          │ │ Action • RPG    │   │
│  │                                      │ │ Open World      │   │
│  │                                      │ │ Multiplayer     │   │
│  └─────────────────────────────────────┘ └─────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ About This Game                                          │   │
│  │                                                          │   │
│  │ Description text goes here...                            │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ Similar Games                                   See All ►│   │
│  │                                                          │   │
│  │  ◄  [Game] [Game] [Game] [Game] [Game]  ►              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Key Ubisoft Design Elements:**
1. **Full-bleed hero** - Artwork fills entire top section edge-to-edge
2. **Game title overlaid** - Large title text on the artwork (not beside it)
3. **Ownership bar** - Shows which platforms you own it on + playtime
4. **Action buttons on hero** - Play, Collection, Settings directly on artwork
5. **Card grid below** - Clean rounded cards for stats/info sections
6. **Dark theme** - Dark backgrounds with accent colors

---

## Files to Modify/Create

| File | Action | Description |
|------|--------|-------------|
| **Server** | | |
| `server/src/routes/games.ts` | MODIFY | Add `/api/games/:id/similar` and `/api/games/:id/steamgrid-assets` endpoints |
| `server/src/services/steamGridDBService.ts` | MODIFY | Add `getHeroAndLogo()` with steamAppId lookup + caching |
| `server/src/db/schema.ts` | MODIFY | Add `steamgrid_id`, `hero_url`, `logo_url` columns to games table |
| **Client - Hooks** | | |
| `client/src/hooks/useGameAssets.ts` | CREATE | Fetch hero + logo with loading/error states |
| `client/src/hooks/useSimilarGames.ts` | CREATE | Fetch similar games with loading/error states |
| **Client - Components** | | |
| `client/src/components/game-detail/CinematicHero.tsx` | CREATE | Full-bleed hero + logo + actions |
| `client/src/components/game-detail/RatingsCard.tsx` | CREATE | Metacritic + Steam + review links |
| `client/src/components/game-detail/PlatformsCard.tsx` | CREATE | Platform availability with store links |
| `client/src/components/game-detail/MediaCard.tsx` | CREATE | YouTube/Twitch links |
| `client/src/components/game-detail/ScreenshotsCard.tsx` | CREATE | Horizontal screenshot gallery with lazy loading |
| `client/src/components/game-detail/GenresTagsCard.tsx` | CREATE | Combined genres & tags |
| `client/src/components/game-detail/AboutCard.tsx` | CREATE | Description with DOMPurify sanitization |
| `client/src/components/game-detail/SimilarGamesCard.tsx` | CREATE | Accessible carousel with keyboard nav |
| `client/src/components/game-detail/index.ts` | CREATE | Barrel export |
| **Client - Page** | | |
| `client/src/pages/GameDetailPage.tsx` | REWRITE | Assemble layout with loading/error/404 states |
| **Tests** | | |
| `server/src/routes/games.test.ts` | MODIFY | Add tests for similar games + steamgrid-assets endpoints |
| `client/src/hooks/useGameAssets.test.ts` | CREATE | Test loading/error/success states |
| `client/src/hooks/useSimilarGames.test.ts` | CREATE | Test loading/error/empty states |

---

## Implementation Steps

### Step 1: SteamGridDB Heroes & Logos API

**Server endpoint:** `GET /api/games/:id/steamgrid-assets`

```typescript
// Returns hero and logo URLs from SteamGridDB
interface SteamGridAssets {
  heroUrl: string | null;   // Wide cinematic background
  logoUrl: string | null;   // Stylized game title image
  cached: boolean;          // Whether result was from DB cache
}

// Implementation in steamGridDBService.ts:
export async function getHeroAndLogo(gameId: number, steamAppId: number | null, title: string): Promise<SteamGridAssets> {
  // 1. Check DB cache first (hero_url, logo_url columns)
  const cached = getCachedAssets(gameId);
  if (cached.heroUrl || cached.logoUrl) {
    return { ...cached, cached: true };
  }

  // 2. Lookup by steamAppId first (more accurate than title search)
  let steamGridId: number | null = null;
  if (steamAppId) {
    // SteamGridDB supports: GET /games/steam/{steamAppId}
    steamGridId = await getSteamGridIdBySteamAppId(steamAppId);
  }

  // 3. Fallback to title search if no steamAppId match
  if (!steamGridId) {
    const sgdbGame = await searchGame(title);
    steamGridId = sgdbGame?.id || null;
  }

  if (!steamGridId) {
    return { heroUrl: null, logoUrl: null, cached: false };
  }

  // 4. Fetch heroes and logos
  const [heroes, logos] = await Promise.all([
    fetchHeroes(steamGridId),  // GET /heroes/game/{id}
    fetchLogos(steamGridId),   // GET /logos/game/{id}
  ]);

  const heroUrl = selectBestAsset(heroes)?.url || null;
  const logoUrl = selectBestAsset(logos)?.url || null;

  // 5. Cache in DB for future requests
  updateGameAssets(gameId, { steamGridId, heroUrl, logoUrl });

  return { heroUrl, logoUrl, cached: false };
}
```

**Database schema update:**
```sql
ALTER TABLE games ADD COLUMN steamgrid_id INTEGER;
ALTER TABLE games ADD COLUMN hero_url TEXT;
ALTER TABLE games ADD COLUMN logo_url TEXT;
```

**Client hook:** `useGameAssets(gameId)`
```typescript
export function useGameAssets(gameId: number | undefined) {
  const [state, setState] = useState<{
    heroUrl: string | null;
    logoUrl: string | null;
    loading: boolean;
    error: string | null;
  }>({ heroUrl: null, logoUrl: null, loading: false, error: null });

  useEffect(() => {
    if (!gameId) return;

    setState(s => ({ ...s, loading: true, error: null }));

    fetch(`/api/games/${gameId}/steamgrid-assets`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch assets');
        return res.json();
      })
      .then(data => setState({ heroUrl: data.heroUrl, logoUrl: data.logoUrl, loading: false, error: null }))
      .catch(err => setState(s => ({ ...s, loading: false, error: err.message })));
  }, [gameId]);

  return state;
}
```

### Step 2: Cinematic Hero Component (Ubisoft-Style)

**File:** `client/src/components/game-detail/CinematicHero.tsx`

Features:
- **Full-bleed hero artwork** - From SteamGridDB heroes API (wide cinematic banners)
- **Stylized game logo** - From SteamGridDB logos API (not plain text!)
- **Gradient overlay** - Bottom gradient for readability
- **Ownership bar** - "Owned on [STEAM] [UBISOFT+]" with platform badges
- **Playtime display** - "Playtime: XX hours" next to ownership
- **Action buttons ON hero** - Play, Collection, Settings buttons overlaid
- **Loading state** - Skeleton/shimmer while assets load
- **Accessibility** - Alt text for images, focus rings on buttons
- Height: ~50vh on desktop, ~40vh on mobile

```typescript
interface CinematicHeroProps {
  game: GameWithPlatforms;
  heroUrl: string | null;
  logoUrl: string | null;
  assetsLoading: boolean;
  onPlay?: () => void;
  onAddToCollection: () => void;
  onFixCover: () => void;
}

// Background (hero) image priority:
// 1. SteamGridDB hero (wide cinematic artwork) ← PRIMARY
// 2. First screenshot from game data
// 3. Steam header image via CDN
// 4. Dark gradient fallback

// Title (logo) image priority:
// 1. SteamGridDB logo (stylized game logo) ← PRIMARY
// 2. Plain text fallback (game.title) with text-shadow

// Performance:
// - Use loading="lazy" for hero image
// - Use aspect-ratio box to prevent layout shift
// - Prefers-reduced-motion: disable parallax effects
```

### Step 3: Ratings Card

**File:** `client/src/components/game-detail/RatingsCard.tsx`

Display:
- **Metacritic Score** - Color-coded badge (green ≥75, yellow ≥50, red <50), links to metacriticUrl
- **Steam Rating** - Percentage with review count, links to Steam reviews
- **Empty state** - "No ratings available" if both null
- **External Links** with `rel="noopener noreferrer"` and `target="_blank"`:
  - OpenCritic: `https://opencritic.com/search?q={encodedTitle}`
  - IGN: `https://www.ign.com/search?q={encodedTitle}`
  - GameSpot: `https://www.gamespot.com/search/?q={encodedTitle}`

```typescript
interface RatingsCardProps {
  game: GameWithPlatforms;
}

// Accessibility: aria-label on external link icons
```

### Step 4: Platforms Card

**File:** `client/src/components/game-detail/PlatformsCard.tsx`

For each platform the game is on:
- Platform icon and name
- "Available" badge
- Store link button (disabled if no valid link):
  - Steam: `https://store.steampowered.com/app/{steamAppId}` (only if steamAppId exists)
  - Game Pass: `https://www.xbox.com/en-US/games/store/search/{encodedTitle}`
  - EA Play: `https://www.ea.com/ea-play/games`
  - Ubisoft+: `https://store.ubisoft.com/us/search?q={encodedTitle}`

```typescript
interface PlatformsCardProps {
  game: GameWithPlatforms;
}

// All links: target="_blank" rel="noopener noreferrer"
// Disabled state if platform has no valid store link
```

### Step 5: Media Card

**File:** `client/src/components/game-detail/MediaCard.tsx`

External search links (we don't store video IDs):
- **YouTube**: `https://www.youtube.com/results?search_query={encodedTitle}+official+trailer`
- **Twitch**: `https://www.twitch.tv/search?term={encodedTitle}` (search URL, not directory - more reliable)

```typescript
interface MediaCardProps {
  gameTitle: string;
}

// Icons with brand colors: YouTube red (#FF0000), Twitch purple (#9146FF)
// All links: target="_blank" rel="noopener noreferrer"
// Aria-labels for screen readers
```

### Step 6: Screenshots Card

**File:** `client/src/components/game-detail/ScreenshotsCard.tsx`

Features:
- Horizontal scrollable gallery
- Lazy loading with `loading="lazy"`
- Aspect-ratio boxes to prevent layout shift
- Click opens lightbox
- Empty state if no screenshots

```typescript
interface ScreenshotsCardProps {
  screenshots: string[];
  gameTitle: string;
}

// Accessibility: alt="{gameTitle} screenshot {index}"
// Performance: loading="lazy", aspect-ratio: 16/9
```

### Step 7: About Card (with XSS Protection)

**File:** `client/src/components/game-detail/AboutCard.tsx`

**IMPORTANT:** Steam descriptions contain HTML. Must sanitize to prevent XSS.

```typescript
import DOMPurify from 'dompurify';

interface AboutCardProps {
  description: string | null;
}

export function AboutCard({ description }: AboutCardProps) {
  if (!description) return null;

  // Sanitize HTML to prevent XSS
  const sanitized = DOMPurify.sanitize(description, {
    ALLOWED_TAGS: ['p', 'br', 'b', 'i', 'strong', 'em', 'ul', 'ol', 'li', 'a', 'h1', 'h2', 'h3'],
    ALLOWED_ATTR: ['href', 'target', 'rel'],
  });

  return (
    <div className="bg-steam-bg-card rounded-lg p-4 mb-4">
      <h3 className="text-steam-text-muted text-sm font-medium mb-3">ABOUT THIS GAME</h3>
      <div
        className="text-steam-text prose prose-invert prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: sanitized }}
      />
    </div>
  );
}
```

**Package:** Add `dompurify` to client dependencies.

### Step 8: Similar Games API + Card

**Server endpoint:** `GET /api/games/:id/similar?limit=10`

```typescript
// In server/src/routes/games.ts
router.get('/:id/similar', async (req, res) => {
  const gameId = parseInt(req.params.id, 10);
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 10, 1), 20); // Clamp 1-20

  const game = getGameById(gameId);
  if (!game) {
    return res.status(404).json({ error: 'Game not found' });
  }

  // Handle empty genres/tags
  if (game.genres.length === 0 && game.tags.length === 0) {
    return res.json({ games: [] });
  }

  const similarGames = getSimilarGames(gameId, game.genres, game.tags, limit);
  res.json({ games: similarGames });
});

// In gameRepository.ts - uses indexed query
export function getSimilarGames(excludeId: number, genres: string[], tags: string[], limit: number): Game[] {
  // Query with JSON_EACH for genres/tags overlap
  // ORDER BY overlap count DESC
  // LIMIT with validated value
}
```

**Database index:** Add index on genres/tags for performance.

**Client hook:** `useSimilarGames(gameId)`
```typescript
export function useSimilarGames(gameId: number | undefined, limit = 10) {
  const [state, setState] = useState<{
    games: Game[];
    loading: boolean;
    error: string | null;
  }>({ games: [], loading: false, error: null });

  useEffect(() => {
    if (!gameId) return;

    setState(s => ({ ...s, loading: true, error: null }));

    fetch(`/api/games/${gameId}/similar?limit=${limit}`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch similar games');
        return res.json();
      })
      .then(data => setState({ games: data.games, loading: false, error: null }))
      .catch(err => setState(s => ({ ...s, loading: false, error: err.message })));
  }, [gameId, limit]);

  return state;
}
```

**File:** `client/src/components/game-detail/SimilarGamesCard.tsx`

Features:
- Horizontal scrollable carousel with arrow buttons
- Shows 5 games at a time (responsive: 2 on mobile, 3 on tablet, 5 on desktop)
- Each card shows cover + title
- Click navigates to that game's detail page
- Smooth scroll animation
- **Accessibility:** Keyboard navigation (arrow keys), focus management
- **Loading state:** Skeleton cards while loading
- **Empty state:** Hide card if no similar games

```typescript
interface SimilarGamesCardProps {
  gameId: number;
}

// Accessibility:
// - role="region" aria-label="Similar games"
// - Arrow buttons: aria-label="Scroll left/right"
// - Keyboard: Left/Right arrow keys scroll
// - Focus trap within carousel when focused
```

### Step 9: Redesign GameDetailPage.tsx (Ubisoft Layout)

Replace current layout with Ubisoft-inspired card grid:

```tsx
export default function GameDetailPage() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { game, loading: gameLoading, error: gameError } = useGame(slug);
  const { heroUrl, logoUrl, loading: assetsLoading } = useGameAssets(game?.id);
  const [showCollectionModal, setShowCollectionModal] = useState(false);
  const [fixingCover, setFixingCover] = useState(false);

  // Loading state
  if (gameLoading) {
    return <GameDetailSkeleton />;
  }

  // Error state
  if (gameError) {
    return <ErrorMessage message={gameError} onRetry={() => window.location.reload()} />;
  }

  // 404 state
  if (!game) {
    return <NotFoundPage message="Game not found" />;
  }

  const handleFixCover = async () => {
    setFixingCover(true);
    try {
      await fixCoverFromSteamGridDB(game.id, game.title);
    } finally {
      setFixingCover(false);
    }
  };

  const handlePlay = () => {
    if (game.steamAppId) {
      window.open(`steam://run/${game.steamAppId}`, '_self');
    }
  };

  return (
    <div className="min-h-screen bg-steam-bg">
      {/* Back button - absolute on hero */}
      <button
        onClick={() => navigate(-1)}
        className="absolute top-4 left-4 z-20 text-white/80 hover:text-white focus:outline-none focus:ring-2 focus:ring-steam-accent rounded"
        aria-label="Go back"
      >
        ◄ Back
      </button>

      {/* HERO SECTION - Full bleed, Ubisoft-style */}
      <CinematicHero
        game={game}
        heroUrl={heroUrl}
        logoUrl={logoUrl}
        assetsLoading={assetsLoading}
        onPlay={game.steamAppId ? handlePlay : undefined}
        onAddToCollection={() => setShowCollectionModal(true)}
        onFixCover={handleFixCover}
      />

      {/* CARDS SECTION - Grid below hero */}
      <div className="max-w-7xl mx-auto px-4 py-6">

        {/* Row 1: Three equal cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <RatingsCard game={game} />
          <PlatformsCard game={game} />
          <MediaCard gameTitle={game.title} />
        </div>

        {/* Row 2: Screenshots (wide) + Genres (narrow) */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="lg:col-span-2">
            <ScreenshotsCard screenshots={game.screenshots} gameTitle={game.title} />
          </div>
          <GenresTagsCard genres={game.genres} tags={game.tags} />
        </div>

        {/* Row 3: About (full width) - with XSS protection */}
        <AboutCard description={game.description || game.shortDescription} />

        {/* Row 4: Similar Games carousel */}
        <SimilarGamesCard gameId={game.id} />
      </div>

      {/* Collection Modal */}
      {showCollectionModal && (
        <CollectionModal
          gameId={game.id}
          gameTitle={game.title}
          onClose={() => setShowCollectionModal(false)}
        />
      )}
    </div>
  );
}
```

**Card Component Pattern:**
Each card follows consistent styling:
```tsx
<div className="bg-steam-bg-card rounded-lg p-4">
  <h3 className="text-steam-text-muted text-sm font-medium mb-3">CARD TITLE</h3>
  {/* Card content */}
</div>
```

---

## External Link URLs

| Service | URL Pattern | Notes |
|---------|-------------|-------|
| Steam Store | `https://store.steampowered.com/app/{steamAppId}` | Only if steamAppId exists |
| Steam Launch | `steam://run/{steamAppId}` | Only if steamAppId exists |
| Steam Reviews | `https://store.steampowered.com/app/{steamAppId}#reviews` | Only if steamAppId exists |
| YouTube Trailer | `https://www.youtube.com/results?search_query={encodedTitle}+official+trailer` | Search-based |
| Twitch | `https://www.twitch.tv/search?term={encodedTitle}` | Search URL (more reliable) |
| OpenCritic | `https://opencritic.com/search?q={encodedTitle}` | Search-based |
| IGN | `https://www.ign.com/search?q={encodedTitle}` | Search-based |
| GameSpot | `https://www.gamespot.com/search/?q={encodedTitle}` | Search-based |
| Metacritic | `{metacriticUrl}` or search | Use stored URL if available |

**All external links must have:** `target="_blank" rel="noopener noreferrer"`

---

## Implementation Order

1. **Database schema** - Add steamgrid_id, hero_url, logo_url columns
2. **SteamGridDB Assets API** - Add `getHeroAndLogo()` with steamAppId lookup + caching
3. **useGameAssets hook** - Fetch hero + logo with loading/error states
4. **CinematicHero** - Full-bleed hero image + stylized logo + actions
5. **RatingsCard** - Metacritic + Steam ratings + external review links
6. **PlatformsCard** - Platform badges with store links
7. **MediaCard** - YouTube trailer + Twitch links
8. **ScreenshotsCard** - Horizontal gallery with lazy loading
9. **GenresTagsCard** - Combined genres and tags display
10. **AboutCard** - Description with DOMPurify sanitization
11. **Similar Games API** - Server endpoint with limit validation + indexing
12. **useSimilarGames hook** - React hook with loading/error states
13. **SimilarGamesCard** - Accessible carousel with keyboard nav
14. **GameDetailPage rewrite** - Assemble layout with loading/error/404 states
15. **Tests** - Unit tests for API endpoints and hooks

---

## Responsive Breakpoints

| Breakpoint | Hero Height | Card Grid | Carousel |
|------------|-------------|-----------|----------|
| Mobile (<640px) | 40vh | 1 column | 2 games visible |
| Tablet (640-1024px) | 45vh | 2-3 columns | 3 games visible |
| Desktop (>1024px) | 50vh | 3 columns | 5 games visible |

---

## Accessibility Requirements

- **Images:** Alt text on all images (hero, logo, screenshots, covers)
- **Buttons:** Focus rings, aria-labels for icon buttons
- **Links:** Clear link text or aria-label for external links
- **Carousel:** Keyboard navigation (arrow keys), focus management
- **Motion:** Respect `prefers-reduced-motion` for animations
- **Color:** Sufficient contrast ratios (already handled by Steam theme)

---

## Performance Requirements

- **Images:** `loading="lazy"` on screenshots and similar game covers
- **Layout:** Aspect-ratio boxes to prevent CLS (Cumulative Layout Shift)
- **Caching:** Cache SteamGridDB assets in DB to avoid repeated API calls
- **Similar games:** Database index on genres/tags for efficient queries

---

## Verification

1. **Visual check**: Navigate to any game detail page, verify cinematic hero displays correctly
2. **Loading states**: Verify skeleton/shimmer appears while data loads
3. **Error states**: Test with invalid slug, verify 404 page appears
4. **Actions test**:
   - Play button opens Steam (for Steam games), disabled for non-Steam
   - Add to Collection opens modal
   - Fix Cover shows loading state and updates cover
5. **Links test**: Verify all external links open in new tab with correct URLs
6. **Similar games**: Check carousel shows related games, clicking navigates correctly
7. **Keyboard test**: Tab through page, use arrow keys in carousel
8. **Responsive test**: Test at mobile (375px), tablet (768px), desktop (1440px) widths
9. **Edge cases**:
   - Games without screenshots (should use header or solid gradient)
   - Games without ratings (should show "No ratings available")
   - Games without platforms (should still show card with empty message)
   - Games with no similar games found (should hide carousel)
   - Games without steamAppId (Play button disabled)

---

## Success Criteria

- [ ] **Database**: New columns for steamgrid_id, hero_url, logo_url
- [ ] **SteamGridDB**: API uses steamAppId lookup first, then title search, with caching
- [ ] **Hero**: Full-bleed hero artwork from SteamGridDB with loading state
- [ ] **Hero**: Stylized logo image from SteamGridDB (fallback to text)
- [ ] **Hero**: Ownership bar showing platforms + playtime
- [ ] **Hero**: Play button (blue, prominent) + secondary actions
- [ ] **Cards**: Ratings card with MC score, Steam %, external links
- [ ] **Cards**: Platforms card with availability + store links
- [ ] **Cards**: Media card with YouTube/Twitch links
- [ ] **Cards**: Screenshots gallery with lazy loading
- [ ] **Cards**: Genres/Tags combined card
- [ ] **Cards**: About card with DOMPurify sanitization
- [ ] **Cards**: Similar games carousel with keyboard navigation
- [ ] **States**: Loading, error, and 404 states handled
- [ ] **Security**: All HTML sanitized, all external links have rel="noopener"
- [ ] **Accessibility**: Alt text, focus rings, aria-labels, keyboard nav
- [ ] **Performance**: Lazy loading, aspect-ratio boxes, DB caching
- [ ] **Tests**: API and hook unit tests added
- [ ] **Layout**: Card grid matching Ubisoft Connect style
- [ ] **Responsive**: Works at mobile, tablet, desktop
