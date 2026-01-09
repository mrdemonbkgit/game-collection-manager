# Claude Code Session Notes

**Last Updated:** Phase 5 In Progress (Detail Pages, Assets, Ratings)

---

## Quick Context

This is a **personal PC game collection manager** for a user with 2420+ Steam games plus subscriptions to Xbox Game Pass, EA Play Pro, and Ubisoft+. The app has an AI curator powered by Gemini 3 Pro.

**User preferences:**
- Dark mode only, Steam-inspired UI
- No status tracking (just browsing/discovery)
- AI for "what to play next", discovery, and decision making
- Self-hosted on home server
- Intermediate developer, prefers autonomous work with milestone check-ins
- Do NOT add "Co-Authored-By: Claude" lines to git commit messages

---

## Current State

### Phase 1-4: COMPLETE ✅

- Foundation + Steam Import
- Library Grid UI
- Filtering, Search & Sort
- Collections & Smart Filters

### Phase 5: IN PROGRESS 🔄 - Detail Pages + Game Assets

**What's working:**
- Game detail page with cinematic hero layout
- SteamGridDB integration for covers, heroes, logos
- Local asset caching (heroes/logos stored locally)
- Cover fix page for manual corrections
- Hero/Logo predownload (background sync for all games)
- **Pagination** for library (replaced infinite scroll for simplicity)
- **Steam Reviews API** integration for user ratings

**Recent Changes:**
- Replaced infinite scroll with page-based pagination
- Added Steam Reviews API to fetch rating percentages
- Library now uses URL param `?page=N` for bookmarkable pages

**API Endpoints (Phase 5):**
```
GET  /api/games/slug/:slug       - Get game by URL slug
GET  /api/games/:id/similar      - Get similar games
GET  /api/games/:id/steamgrid-*  - Hero/logo options from SteamGridDB
POST /api/games/:id/assets       - Save selected hero/logo
POST /api/games/:id/refresh-rating - Refresh Steam rating for one game

POST /api/sync/ratings           - Background sync all Steam ratings (~67 min)
GET  /api/sync/ratings/status    - Check ratings sync progress
GET  /api/sync/ratings/count     - Count games with/without ratings
POST /api/sync/assets            - Predownload heroes/logos for all games
GET  /api/sync/assets/status     - Check asset predownload progress
```

**Database fields for ratings:**
- `steam_rating` - Percentage positive (0-100)
- `steam_rating_count` - Total number of reviews

---

## Project Structure

```
/home/tony/projects/game-collection/
├── PRODUCT.md          # Full product spec - READ THIS FIRST
├── PROGRESS.md         # Phase tracking, what's done/next
├── DECISIONS.md        # Architecture Decision Records
├── IDEAS.md            # User's feature ideas (DO NOT MODIFY - user-only file)
├── CLAUDE.md           # This file - session notes
├── .env                # Steam credentials (STEAM_API_KEY, STEAM_USER_ID)
├── package.json        # Monorepo root with workspaces
│
├── server/
│   ├── src/
│   │   ├── index.ts                    # Express entry point
│   │   ├── routes/
│   │   │   ├── games.ts                # /api/games routes
│   │   │   └── sync.ts                 # /api/sync routes
│   │   ├── services/
│   │   │   └── steamService.ts         # Steam API integration
│   │   └── db/
│   │       ├── connection.ts           # SQLite connection (node:sqlite)
│   │       ├── schema.ts               # CREATE TABLE statements
│   │       └── repositories/
│   │           ├── gameRepository.ts   # Game CRUD operations
│   │           └── gameRepository.test.ts
│   ├── package.json
│   └── tsconfig.json
│
├── client/                 # React app (scaffolded, not built yet)
│   ├── src/
│   └── package.json
│
└── shared/
    └── src/index.ts        # Shared TypeScript types
```

---

## Key Technical Decisions

1. **Node.js built-in SQLite** (`node:sqlite`) - `better-sqlite3` failed to compile on Node 24
2. **Node.js native test runner** - Vitest had issues with `node:sqlite`
3. **Unique slugs** - Duplicate game names get Steam app ID appended (e.g., `grand-theft-auto-iii-12230`)
4. **JSON arrays in SQLite** - Genres, tags, screenshots stored as JSON strings
5. **1.5s rate limit** - Steam Store API rate limiting for detailed sync

---

## Commands

```bash
# Development
npm run dev:server          # Start server with hot reload
npm run dev:client          # Start React dev server (Phase 2+)
npm run dev                 # Both concurrently

# Unit Testing
npm test                    # Run all tests (from root)
cd server && npm test       # Server tests only

# E2E Testing (Playwright)
npm run e2e                 # Run all E2E tests
npm run e2e:smoke           # Run smoke tests only (critical path)
npm run e2e:grid            # Run library grid tests
npm run e2e:scroll          # Run infinite scroll tests
npm run e2e:ui              # Open Playwright UI mode
npm run e2e:report          # View HTML test report

# Type checking
npm run typecheck           # All workspaces

# Sync Steam library
curl -X POST http://localhost:3001/api/sync/steam/quick
```

---

## Environment Variables

```env
STEAM_API_KEY=<user's key>
STEAM_USER_ID=76561198007320595
GEMINI_API_KEY=<not set yet, Phase 6>
PORT=3001
DATABASE_PATH=./data/games.db
```

---

## What's Next: Phase 5

**Goal:** "I can see game details and add non-Steam games"

Build detail pages and subscription catalogs:
1. Game detail page with metadata
2. Screenshots gallery
3. Community catalog import (Game Pass, EA Play, Ubisoft+)
4. Duplicate handling across platforms

---

## Phases Overview

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Foundation + Steam Import | ✅ Complete |
| 2 | Library Grid UI | ✅ Complete |
| 3 | Filtering, Search & Sort | ✅ Complete |
| 4 | Collections & Smart Filters | ✅ Complete |
| 5 | Detail Pages + Game Assets | 🔄 In Progress |
| 6 | AI Curator (Gemini 3 Pro) | 🔲 Pending |
| 7 | Polish + Deployment | 🔲 Pending |

---

## User's Steam Library Stats

- **Total Games:** 2420
- **Successfully Imported:** 2420 (after slug fix)
- **Sync Method:** Quick sync (basic info, no rate limiting)

---

## Known Issues / Notes

1. `node:sqlite` is experimental (warning on startup) - acceptable for personal project
2. Full sync with details takes ~60+ minutes for 2400 games (1.5s delay per game)
3. Quick sync is instant but lacks: descriptions, screenshots, metacritic scores, genres/tags
4. For subscription catalogs (Game Pass, EA, Ubisoft+), will need community-maintained JSON lists

---

## How to Resume

1. Read this file (`CLAUDE.md`) for quick context
2. Check `PROGRESS.md` for task checklist and current phase
3. Reference `PRODUCT.md` for full product spec if needed
4. Start both servers: `npm run dev`
5. Run tests: `npm test && npm run e2e`
6. Continue with next phase

---

## User Interaction Style

- Autonomous work with milestone check-ins
- Ask immediately if blocked
- Comprehensive test coverage
- User has API keys ready when needed
- No rush, quality over speed


## E2E / Browser Testing

This project has **two options** for E2E testing:

| Option | Best For | Speed | CI/CD Ready |
|--------|----------|-------|-------------|
| **Playwright** | Automated regression tests | Fast (parallel) | Yes |
| **Chrome Bridge** | Interactive debugging, extension testing | Slower | No |

---

### Option 1: Playwright (Primary)

Uses bundled Chromium browser with full test framework. **Recommended for automated testing.**

**Commands:**
```bash
npx playwright test              # Run all tests (headless)
npx playwright test --headed     # Run with visible browser
npm run e2e:smoke                # Smoke tests only
npm run e2e:grid                 # Library grid tests
npm run e2e:scroll               # Infinite scroll tests
npm run e2e:ui                   # Interactive UI mode
npm run e2e:report               # View HTML report
```

**Pros:**
- Fast parallel execution (16 workers)
- Isolated, reproducible environment
- Built-in assertions, auto-waiting, screenshots/videos
- Works in CI/CD pipelines

**Cons:**
- Uses bundled Chromium, not your actual browser
- Cannot test browser extensions

---

### Option 2: Chrome Bridge (Real Browser)

Uses your actual Windows Chrome via CDP connection from WSL. **Best for debugging and manual verification.**

Use the `/browser` skill for Chrome Bridge commands. The skill includes setup instructions and available actions.

**Pros:**
- Tests your actual browser with extensions, settings, cookies
- See exactly what users see
- Good for interactive debugging

**Cons:**
- Single browser instance (no parallelization)
- No built-in test framework
- Requires bridge to be running

---

### When to Use Which

| Use Case | Tool |
|----------|------|
| Automated regression tests | Playwright |
| CI/CD pipeline | Playwright |
| Quick manual verification | Chrome Bridge (`/browser`) |
| Interactive debugging | Chrome Bridge (`/browser`) |
| Testing with extensions | Chrome Bridge (`/browser`) |
| Visual issue investigation | Chrome Bridge (`/browser`) |

---

## Code Review with Codex CLI

Use `codex` CLI for code and planning review as a second opinion:

```bash
codex exec -m gpt-5.2-codex -c reasoning_effort=high "review this code/plan: <context>"
```

Always verify Codex findings independently - treat as suggestions, not authoritative answers.
