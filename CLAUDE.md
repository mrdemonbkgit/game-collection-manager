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

**Step 1: Check if bridge is running:**
```bash
WINDOWS_IP=$(ip route | grep default | awk '{print $3}')
nc -zv $WINDOWS_IP 19222 2>&1 | grep -q "succeeded" && echo "Bridge running" || echo "Bridge not running"
```

**Step 2: Start the bridge if needed (run from WSL, don't ask user):**
```bash
powershell.exe -ExecutionPolicy Bypass -File "C:\Users\Tony\projects\claude-chrome-bridge\windows-host\start-all.ps1"
```

**Step 3: Verify it's running:**
```bash
sleep 3
nc -zv $WINDOWS_IP 19222
```

**Important:** Always run these checks automatically when Chrome Bridge testing is requested. Do not ask the user to start the bridge manually.

**Available MCP Tools:**

| Tool | Description |
|------|-------------|
| `mcp__claude-in-chrome__tabs_context_mcp` | Get browser tabs |
| `mcp__claude-in-chrome__navigate` | Navigate to URL |
| `mcp__claude-in-chrome__computer` | Screenshot, click, type, scroll |
| `mcp__claude-in-chrome__get_page_text` | Extract page text |
| `mcp__claude-in-chrome__javascript_tool` | Execute JavaScript |
| `mcp__claude-in-chrome__find` | Find elements on page |
| `mcp__claude-in-chrome__form_input` | Fill form fields |

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
| Quick manual verification | Chrome Bridge |
| Interactive debugging | Chrome Bridge |
| Testing with extensions | Chrome Bridge |
| Visual issue investigation | Chrome Bridge |
