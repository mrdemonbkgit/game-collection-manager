# Game Collection Manager

## Product Description

A personal web application for browsing and discovering PC games across multiple platforms and subscription services. Features a Steam-inspired dark interface and an AI-powered curator that helps users decide what to play from their extensive library.

---

## Vision

Managing a large PC game collection across Steam, Xbox Game Pass, EA Play Pro, and Ubisoft+ is fragmented. Each platform has its own library, UI, and discovery features. This app provides a **unified, beautiful browsing experience** with an intelligent AI curator that understands your collection and helps you find your next game.

This is a **personal tool**, not a social platform. It prioritizes elegant browsing and smart discovery over progress tracking or social features.

---

## Target User

- PC gamer with a large collection (500+ titles)
- Subscribed to multiple gaming services
- Wants a centralized view of all available games
- Values aesthetic presentation and good UX
- Interested in AI-assisted game discovery
- Self-hosts applications on a home server

---

## Core Features

### 1. Unified Game Library

Aggregate games from multiple sources into a single browsable collection:

| Platform | Integration Method |
|----------|-------------------|
| Steam | OAuth authentication, automatic library sync |
| Xbox Game Pass Ultimate | Community-maintained catalog lists |
| EA Play Pro | Community-maintained catalog lists |
| Ubisoft+ | Community-maintained catalog lists |

**Duplicate Handling**: When a game exists on multiple platforms, display it once with the primary platform, noting other platforms where it's available.

**Subscription Catalog Updates**: Manual refresh triggered by user. When games leave a subscription service, they are removed from the library immediately.

### 2. Grid View Browser

Steam-inspired grid layout displaying game cover art:

- **Medium density** grid (Steam default sizing)
- Hover states showing quick info
- Smooth scrolling with lazy loading for 500+ games
- Visual indicators for platform/service source

### 3. Game Detail Pages

Comprehensive detail view for each game including:

- **Visuals**: Cover art, screenshots, trailers (where available)
- **Metadata**: Title, developer, publisher, release date, genres, tags
- **Reviews & Scores**: Metacritic score, Steam review summary
- **Platform Availability**: Which services/platforms have this game
- **Description**: Game summary and features

### 4. Filtering & Sorting

Comprehensive filtering system for navigating large libraries:

**Filter by:**
- Platform/Service (Steam, Game Pass, EA Play, Ubisoft+)
- Genre (RPG, FPS, Strategy, Indie, etc.)
- Tags (Multiplayer, Co-op, Singleplayer, Controller Support, etc.)
- Developer / Publisher
- Release Year
- Metacritic Score Range
- Steam Review Rating

**Sort by:**
- Title (A-Z, Z-A)
- Release Date (Newest, Oldest)
- Metacritic Score
- Date Added to Library

### 5. Collections & Smart Filters

**Custom Collections**: User-created groupings for manual curation
- Examples: "Cozy Games", "Play with Friends", "Short Games", "Favorites"
- Drag-and-drop or quick-add to collections
- Collections visible in sidebar

**Smart Filters**: Saved filter presets for quick access
- Examples: "Unplayed RPGs", "High-rated Indies", "Game Pass Exclusives"
- Dynamic results based on current library state

### 6. AI-Powered Search

Natural language search across the entire library:

- "roguelikes with good music"
- "short games I can finish in one sitting"
- "something like Hades"
- "relaxing games to play while listening to podcasts"

Powered by Gemini 3 Pro with context about the user's full library.

---

## AI Game Curator

The standout feature: an intelligent assistant specialized in PC game curation.

### Interaction Methods

**Chat Interface**
- Full conversational UI for complex queries
- Multi-turn conversations with context retention
- Accessible via dedicated chat panel

**Suggestions Panel**
- Proactive recommendations displayed in the UI
- "Based on your library, you might enjoy..."
- Contextual suggestions (time of day, recently played genres)

**Command Bar**
- Quick access via keyboard shortcut or button
- Fast queries: "suggest something quick" → immediate response
- Spotlight/Alfred-style interface

### Capabilities

| Feature | Description |
|---------|-------------|
| What to Play Next | Recommendations based on mood, available time, preferences |
| Discovery | Surface hidden gems and overlooked titles in your library |
| Decision Making | Compare two or more games with pros/cons analysis |

### AI Context & Memory

**Data Available to AI:**
- Complete game library with metadata
- Platform/service for each game
- User's stated preferences from conversations

**NOT included:**
- External review scores for recommendations
- Playtime data
- HowLongToBeat completion times

**Memory:**
- Persistent conversation history across sessions
- Remembered preferences and past recommendations
- Learns user taste over time through interactions

### Example Interactions

```
User: "I have about 2 hours and want something story-driven"

AI: "From your library, I'd suggest Firewatch - it's a narrative
walking sim you can complete in one session. The story is
compelling and self-contained. Alternatively, you could make
meaningful progress in a chapter of Life is Strange."
```

```
User: "Should I play Elden Ring or Baldur's Gate 3?"

AI: "Both are excellent, but they suit different moods:

Elden Ring:
- Solo experience, challenging combat
- Progress in small sessions possible
- Minimal story investment needed

Baldur's Gate 3:
- Better with dedicated longer sessions
- Rich story requiring attention
- Turn-based, more relaxed pacing

If you want to zone out and test reflexes: Elden Ring
If you want to sink into narrative: BG3"
```

---

## Technical Architecture

### Stack

| Component | Technology |
|-----------|------------|
| Frontend | React |
| Backend | Node.js with Express |
| Database | SQLite (local file) |
| AI | Gemini 3 Pro API |
| Hosting | Self-hosted on home server |

### Data Flow

```
┌─────────────────┐     ┌─────────────────┐
│   Steam OAuth   │────▶│                 │
└─────────────────┘     │                 │
                        │   Express API   │
┌─────────────────┐     │                 │
│ Community Lists │────▶│                 │
│ (Game Pass, EA, │     └────────┬────────┘
│  Ubisoft+)      │              │
└─────────────────┘              │
                                 ▼
                        ┌─────────────────┐
                        │     SQLite      │
                        │    Database     │
                        └────────┬────────┘
                                 │
                                 ▼
┌─────────────────┐     ┌─────────────────┐
│  Gemini 3 Pro   │◀───▶│   React SPA    │
│      API        │     │                 │
└─────────────────┘     └─────────────────┘
```

### Database Schema (Conceptual)

**Games**
- id, title, slug
- cover_image_url, screenshots
- description, summary
- developer, publisher
- release_date
- genres, tags
- metacritic_score, steam_rating
- steam_app_id (nullable)

**Platforms**
- id, game_id
- platform_type (steam, gamepass, eaplay, ubisoftplus)
- platform_game_id
- is_primary

**Collections**
- id, name, description
- is_smart_filter, filter_criteria (JSON)

**Collection_Games**
- collection_id, game_id

**AI_Conversations**
- id, created_at
- messages (JSON array)

**User_Preferences**
- key, value (JSON)

### API Endpoints (Conceptual)

```
GET    /api/games              # List games with filters
GET    /api/games/:id          # Game details
POST   /api/games/search       # AI-powered search
GET    /api/collections        # List collections
POST   /api/collections        # Create collection
PUT    /api/collections/:id    # Update collection
DELETE /api/collections/:id    # Delete collection
POST   /api/sync/steam         # Trigger Steam sync
POST   /api/sync/catalogs      # Refresh subscription catalogs
POST   /api/chat               # AI chat endpoint
GET    /api/chat/history       # Get conversation history
GET    /api/suggestions        # Get AI suggestions
```

---

## UI/UX Design

### Visual Design

- **Theme**: Dark mode only
- **Inspiration**: Steam library UI
- **Typography**: Clean, readable, modern sans-serif
- **Color Palette**: Dark grays, subtle accent colors for platforms
- **Imagery**: Cover art as primary visual element

### Key Views

**Library Grid View** (Default)
- Header with search bar and filter toggles
- Sidebar with collections and smart filters
- Main grid of game covers
- Footer with game count and view options

**Game Detail View**
- Hero section with cover art and key metadata
- Tabbed content: About, Screenshots, Reviews
- Sidebar with platform availability and quick actions
- "Similar in your library" suggestions

**AI Chat Panel**
- Slide-out panel or modal
- Chat message history
- Input field with send button
- Suggested quick prompts

**Command Bar**
- Centered overlay modal
- Search/command input
- Real-time AI response
- Recent queries

### Responsive Considerations

Primary target: Desktop browsers on home network
- Minimum supported width: 1024px
- Optimized for 1440p and 4K displays
- No mobile-specific layouts required (home server use case)

---

## Metadata & Data Sources

### Steam API

Used for:
- User library retrieval (owned games)
- Game metadata (descriptions, screenshots, tags)
- Review scores and summaries
- Playtime data (for display, not AI recommendations)

Authentication: Steam OAuth (OpenID 2.0)

### Community Catalog Lists

For subscription services without official APIs:

**Potential Sources:**
- GitHub repositories tracking Game Pass/EA/Ubisoft catalogs
- Community-maintained JSON/CSV files
- Reddit community resources

**Update Frequency:** Manual refresh by user

**Data Required:**
- Game title (for matching with Steam/IGDB)
- Platform identifier
- Optionally: date added, leaving soon flag

### Metadata Enrichment

For games not on Steam, fall back to:
- Matching title against Steam store (even if not owned)
- IGDB as secondary source if needed

---

## Out of Scope

The following features are explicitly **not** planned:

| Feature | Reason |
|---------|--------|
| Play status tracking | User doesn't need backlog management |
| Progress/completion tracking | Not a gaming journal |
| HowLongToBeat integration | Not needed for recommendations |
| Achievement tracking | Available in native platforms |
| Social features | Personal tool only |
| Library sharing | No multi-user support |
| Game launching | Browse-only, launch via native clients |
| Offline support | Always-online is acceptable |
| Mobile app | Desktop browser sufficient |
| Keyboard shortcuts | Mouse navigation is fine |
| Light mode | Dark mode only |

---

## Success Criteria

The MVP is successful when:

1. **Steam library imports correctly** via OAuth
2. **Subscription catalogs** can be loaded from community sources
3. **Grid view** displays 500+ games smoothly with lazy loading
4. **Filtering** works across all criteria simultaneously
5. **Detail pages** show comprehensive game information
6. **Collections** can be created, edited, and populated
7. **AI chat** provides relevant, contextual recommendations
8. **AI search** returns sensible results for natural language queries
9. **Home server** deployment works reliably

### Quality Bar

"Usable daily driver" - polished enough for regular personal use:
- No major bugs or crashes
- Responsive UI (< 200ms interactions)
- Coherent visual design
- AI responses are helpful and relevant

---

## Future Considerations

Not in MVP, but potential future enhancements:

- **Leaving Soon Alerts**: Notifications when subscription games are departing
- **Playtime Import**: Display Steam playtime on game cards
- **Better Duplicate Detection**: Fuzzy matching for game titles across platforms
- **Custom Metadata**: User-editable fields per game
- **Bulk Operations**: Multi-select for adding to collections
- **Import/Export**: Backup and restore library data
- **Browser Extension**: Scrape subscription service pages for library data
- **Additional Platforms**: GOG, Epic Games Store, Humble Bundle

---

## Appendix: Platform Color Codes

For visual distinction in the UI:

| Platform | Color | Hex |
|----------|-------|-----|
| Steam | Steam Blue | #1b2838 |
| Xbox Game Pass | Xbox Green | #107c10 |
| EA Play | EA Red | #ff4747 |
| Ubisoft+ | Ubisoft Blue | #0070ff |
