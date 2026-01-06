---
name: qa
description: Run E2E tests for the game-collection app using Playwright. Use /qa for all tests, /qa smoke for critical path only.
---

# QA Agent - Playwright E2E Test Runner

Run end-to-end tests for the game-collection app using Playwright.

## Usage

- `/qa` - Run all test scenarios
- `/qa smoke` - Run only smoke tests (critical path)
- `/qa grid` - Run library grid tests
- `/qa scroll` - Run infinite scroll tests

## Prerequisites

Before running tests, ensure:

1. **Backend server** running at http://localhost:3001
2. **Frontend dev server** running at http://localhost:3000
3. **Database populated** with games (run `curl -X POST http://localhost:3001/api/sync/steam/quick` if empty)

Note: Playwright can auto-start servers via `webServer` config, but for faster iteration, pre-start them.

## Test Suites

Test files are located in `e2e/tests/`:

### Smoke Tests (`smoke.spec.ts`)
- Page loads successfully
- Displays game grid with cards
- Header shows correct game count
- No JavaScript errors on page load
- No error messages displayed
- API health check responds
- Games API returns data

### Grid Tests (`library-grid.spec.ts`)
- Game cards have cover images
- Game cards display title
- Game cards show platform badge
- Multiple game cards render
- Game cards have consistent dimensions
- Card responds to hover
- Grid is responsive
- Grid maintains structure on resize
- Shows loading indicator initially
- Loading spinner disappears after load

### Scroll Tests (`infinite-scroll.spec.ts`)
- Loads more games when scrolling down
- Triggers API call when reaching threshold
- Does not trigger multiple simultaneous loads
- Scroll position is maintained after load
- Can scroll back to top
- Continuous scrolling works
- Handles rapid scroll events
- Handles scroll during loading
- Scroll is smooth (no jank)
- Does not cause memory leaks during scroll

## Instructions

When this skill is invoked:

### 1. Validate Environment

First, check that both servers are running:

```bash
# Check backend
curl -s http://localhost:3001/api/health

# Check frontend is accessible
curl -s http://localhost:3000 | head -1
```

If either fails, report the issue and provide start commands:
- "Backend not running. Start with: `npm run dev:server`"
- "Frontend not running. Start with: `npm run dev:client`"

### 2. Run Tests

Execute the appropriate Playwright command based on the argument:

```bash
# No argument: Run all tests
npx playwright test

# smoke: Run smoke tests only
npx playwright test e2e/tests/smoke.spec.ts

# grid: Run grid tests
npx playwright test e2e/tests/library-grid.spec.ts

# scroll: Run scroll tests
npx playwright test e2e/tests/infinite-scroll.spec.ts
```

### 3. Report Results

After tests complete, summarize results:

```
=== E2E Test Results ===
Total: X tests
Passed: Y
Failed: Z
Duration: A.Bs

Passed Tests:
[PASS] smoke.spec.ts > page loads successfully (1.2s)
[PASS] smoke.spec.ts > displays game grid with cards (0.8s)
...

Failed Tests:
[FAIL] library-grid.spec.ts > card responds to hover
  Error: Expected element to be visible
  Screenshot: e2e/results/test-results/library-grid-card-responds-to-hover/test-failed.png
```

### 4. On Failure

If tests fail:
1. Show the error message and which test failed
2. Mention screenshot location if available
3. Suggest running `npm run e2e:report` to view detailed HTML report
4. Offer to investigate the specific failure

## Test Results Location

- **HTML Report**: `e2e/results/html-report/`
- **JSON Results**: `e2e/results/results.json`
- **Screenshots**: `e2e/results/test-results/`
- **Videos**: `e2e/results/test-results/` (on retry)

## Useful Commands

```bash
# Run with UI mode (interactive)
npm run e2e:ui

# Run specific test file
npx playwright test e2e/tests/smoke.spec.ts

# Run tests in headed mode (see browser)
npx playwright test --headed

# Run single test by name
npx playwright test -g "page loads successfully"

# Debug mode (step through)
npx playwright test --debug

# View last report
npm run e2e:report
```

## Troubleshooting

**"Cannot find module 'playwright'"**
- Run `npm install` from project root

**"Browser not found"**
- Run `npx playwright install chromium`

**"Connection refused localhost:3000/3001"**
- Start dev servers: `npm run dev`

**Tests timeout**
- Default timeout is 30s per test
- Check if servers are responding slowly
- Increase timeout in specific test if needed
