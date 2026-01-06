# Claude Code Session Notes

**Last Updated:** Phase 1 Complete (Steam Import Working)

---

## Quick Context

This is a **personal PC game collection manager** for a user with 2420+ Steam games plus subscriptions to Xbox Game Pass, EA Play Pro, and Ubisoft+. The app has an AI curator powered by Gemini 3 Pro.

**User preferences:**
- Dark mode only, Steam-inspired UI
- No status tracking (just browsing/discovery)
- AI for "what to play next", discovery, and decision making
- Self-hosted on home server
- Intermediate developer, prefers autonomous work with milestone check-ins

---

## Current State

### Phase 1: COMPLETE ✅

**What's working:**
- Express server at `http://localhost:3001`
- SQLite database using Node.js built-in `node:sqlite` module
- Steam library sync (2420 games imported successfully)
- Full CRUD for games with filtering, pagination, sorting
- 24 passing unit tests

**API Endpoints:**
```
GET  /api/health              - Health check
GET  /api/games               - List games (supports ?search, ?genre, ?platform, ?sortBy, ?limit, ?offset)
GET  /api/games/:id           - Get single game
GET  /api/games/count         - Total count
POST /api/sync/steam          - Full sync with details (slow, rate-limited)
POST /api/sync/steam/quick    - Quick sync, basic info only (fast)
GET  /api/sync/status         - Check sync configuration
DELETE /api/sync/reset        - Clear all games
```

**Database:** `./data/games.db` (SQLite)

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

# Testing
npm test                    # Run all tests (from root)
cd server && npm test       # Server tests only

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
GEMINI_API_KEY=<not set yet, Phase 4>
PORT=3001
DATABASE_PATH=./data/games.db
```

---

## What's Next: Phase 2

**Goal:** "I can browse my games in a Steam-like grid"

Build the React frontend:
1. React app structure and routing
2. Dark theme (CSS variables or Tailwind)
3. Grid view with game covers
4. Hover states on game cards
5. Platform badges (Steam icon, etc.)
6. Lazy loading for 2400+ games
7. Basic responsive layout

**UI Reference:** Steam library grid view, medium density

---

## Phases Overview

| Phase | Description | Status |
|-------|-------------|--------|
| 1 | Foundation + Steam Import | ✅ Complete |
| 2 | Library Grid UI | 🔲 Next |
| 3 | Filtering, Collections, Search | 🔲 Pending |
| 4 | AI Curator (Gemini 3 Pro) | 🔲 Pending |
| 5 | Detail Pages + Subscription Catalogs | 🔲 Pending |
| 6 | Polish + Deployment | 🔲 Pending |

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
4. Start server: `npm run dev:server`
5. Continue with next phase

---

## User Interaction Style

- Autonomous work with milestone check-ins
- Ask immediately if blocked
- Comprehensive test coverage
- User has API keys ready when needed
- No rush, quality over speed
