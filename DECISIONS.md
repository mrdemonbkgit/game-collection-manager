# Architecture Decisions Log

This file documents key architectural decisions made during development.

---

## ADR-001: Use Node.js Built-in SQLite Module

**Date:** Phase 1

**Status:** Accepted

**Context:**
We needed a SQLite implementation for the database layer. Options included:
- `better-sqlite3` (native bindings)
- `sql.js` (WASM-based)
- `node:sqlite` (Node.js built-in, experimental)

**Decision:**
Use `node:sqlite` built-in module (available in Node.js 22+).

**Rationale:**
- User is running Node.js 24, which includes the built-in SQLite module
- `better-sqlite3` failed to compile due to Node.js 24 compatibility issues (C++20 requirements)
- No external dependencies needed
- Synchronous API matches the simple use case
- Performance is excellent for local usage

**Consequences:**
- Requires Node.js 22+ (not an issue for this project)
- Module is still experimental (acceptable for personal project)
- SQLite is stored locally in `data/games.db`

---

## ADR-002: Use Node.js Native Test Runner

**Date:** Phase 1

**Status:** Accepted

**Context:**
Initially configured Vitest for testing, but encountered issues with `node:sqlite` module resolution in Vite's transform pipeline.

**Decision:**
Switch from Vitest to Node.js native test runner with tsx.

**Rationale:**
- Native test runner works seamlessly with `node:sqlite`
- tsx provides TypeScript execution without compilation
- Simpler dependency tree
- Fast execution (24 tests in ~220ms)

**Consequences:**
- Different API than Jest/Vitest (using `node:test` and `node:assert`)
- No built-in coverage tool (can add c8 if needed)
- No fancy UI, but clear pass/fail output

---

## ADR-003: Steam API Key-Based Authentication

**Date:** Phase 1

**Status:** Accepted

**Context:**
Steam offers two authentication methods:
1. Steam Web API key + User ID (simple)
2. Steam OpenID/OAuth (more complex, requires web server)

**Decision:**
Use API key + User ID stored in environment variables.

**Rationale:**
- Simpler implementation for personal use
- No need for OAuth flow or redirect handling
- User provides their own API key (free from Steam)
- Sufficient for reading owned games library

**Consequences:**
- User must manually obtain Steam API key and 64-bit Steam ID
- Less secure than OAuth (keys stored in .env)
- Acceptable for self-hosted personal tool

---

## ADR-004: Monorepo with npm Workspaces

**Date:** Phase 1

**Status:** Accepted

**Context:**
Project structure options:
1. Single package
2. Separate repositories
3. Monorepo with workspaces

**Decision:**
Use npm workspaces with `/client`, `/server`, and `/shared` packages.

**Rationale:**
- Shared types between frontend and backend
- Single `npm install` for all dependencies
- Coordinated development and versioning
- Easy to run both client and server in development

**Consequences:**
- Slightly more complex package.json structure
- Need to use workspace commands (`npm run dev:server`)
- Shared types require build step

---

## ADR-005: Rate Limiting for Steam Store API

**Date:** Phase 1

**Status:** Accepted

**Context:**
Steam Store API (`store.steampowered.com/api/appdetails`) is rate-limited and can block requests if too many are made quickly.

**Decision:**
Implement 1.5 second delay between requests when fetching detailed game info.

**Rationale:**
- Prevents IP blocking from Steam
- Detailed info is optional (quick sync available without it)
- User can choose quick sync for faster initial import

**Consequences:**
- Full sync with 500+ games takes ~12+ minutes
- Quick sync completes in seconds
- Trade-off between speed and data completeness

---

## ADR-006: JSON Storage for Arrays in SQLite

**Date:** Phase 1

**Status:** Accepted

**Context:**
Need to store array fields (genres, tags, screenshots) in SQLite which doesn't support arrays natively.

**Decision:**
Store arrays as JSON strings, parse on read.

**Rationale:**
- SQLite's JSON functions can query inside JSON strings
- Simple implementation
- No need for separate junction tables for simple lists
- Efficient for read-heavy workload

**Consequences:**
- Need to JSON.parse when reading, JSON.stringify when writing
- Can use SQLite JSON functions for filtering (e.g., `genres LIKE '%"RPG"%'`)
- Less normalized but simpler queries

---

## ADR-007: Unique Slugs with Steam App ID Suffix

**Date:** Phase 1

**Status:** Accepted

**Context:**
Some Steam games have identical names but different app IDs (e.g., different editions, platform versions, or regional releases). The `slug` column has a UNIQUE constraint.

Initial sync failed for 6 games:
- Grand Theft Auto III (multiple app IDs)
- Grand Theft Auto: Vice City
- Grand Theft Auto: San Andreas
- Sid Meier's Civilization IV (base + expansions)

**Decision:**
When a slug collision is detected, append the Steam app ID to the slug.

**Implementation:**
```typescript
// getUniqueSlug() checks if slug exists, appends appId if collision
slug: getUniqueSlug(game.name, game.appid)
// Results in: "grand-theft-auto-iii-12230"
```

**Rationale:**
- Preserves readable slugs for unique titles
- Only adds suffix when necessary
- Steam app ID is stable and unique identifier
- No data loss - all 2420 games import successfully

**Consequences:**
- Some URLs will have app ID suffix (acceptable)
- Need to use `getUniqueSlug()` instead of `createSlug()` when inserting

---

*Add new decisions as development progresses.*
