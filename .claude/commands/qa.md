# QA Agent - E2E Test Runner

Run end-to-end tests for the game-collection app using Chrome integration.

## Usage

- `/qa` - Run all test scenarios
- `/qa smoke` - Run only smoke tests (critical path)
- `/qa grid` - Run library grid tests
- `/qa scroll` - Run infinite scroll tests
- `/qa <scenario-id>` - Run specific scenario by ID

## Prerequisites

Before running tests, ensure:

1. **Backend server** running at http://localhost:3001
2. **Frontend dev server** running at http://localhost:3000
3. **Chrome browser** connected via `claude --chrome`
4. **Database populated** with games (run `curl -X POST http://localhost:3001/api/sync/steam/quick` if empty)

## Test Scenarios

Test definitions are located in `e2e/scenarios/`:

### Smoke Tests (`smoke` tag)
- `smoke-page-load` - Verify page loads with games visible
- `smoke-header-count` - Verify correct game count in header
- `smoke-no-errors` - Verify no error states displayed

### Grid Tests (`grid` tag)
- `grid-card-display` - Verify cards show image, title, Steam badge
- `grid-multiple-cards` - Verify multiple cards render
- `grid-hover-state` - Verify hover effects work

### Scroll Tests (`scroll` tag)
- `scroll-loads-more` - Verify infinite scroll loads more games
- `scroll-continuous` - Verify multiple scrolls work
- `scroll-back-to-top` - Verify scrolling back up works

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

If either fails, report the issue and abort:
- "Backend not running. Start with: npm run dev:server"
- "Frontend not running. Start with: npm run dev:client"

### 2. Load Test Scenarios

Read the test scenario files from `e2e/scenarios/`:
- `e2e/scenarios/smoke.ts`
- `e2e/scenarios/library-grid.ts`
- `e2e/scenarios/infinite-scroll.ts`

Filter scenarios based on the argument:
- No argument: Run all scenarios
- `smoke`/`grid`/`scroll`: Filter by tag
- Specific ID: Run single scenario

### 3. Execute Test Steps

For each scenario, execute steps sequentially using Chrome:

**Navigate** (`action: 'navigate'`):
- Use Chrome to go to the specified URL
- Example: Navigate to http://localhost:3000

**Wait** (`action: 'wait'`):
- `networkIdle`: Wait for network activity to settle
- `selector`: Wait for element to appear
- `text`: Wait for text to appear
- `duration`: Wait fixed milliseconds

**Assert** (`action: 'assert'`):
- `elementVisible`: Check element exists and is visible
- `elementHidden`: Check element is not visible
- `textPresent`: Check text appears on page
- `elementCount`: Check number of matching elements

**Screenshot** (`action: 'screenshot'`):
- Capture the current viewport
- Save to `e2e/results/screenshots/{scenario-id}_{name}.png`

**Click** (`action: 'click'`):
- Click the element matching the selector

**Type** (`action: 'type'`):
- Type text into the specified input

**Scroll** (`action: 'scroll'`):
- Scroll the viewport or element
- Direction: 'up' or 'down'
- Amount: pixels to scroll

### 4. Handle Step Failures

On assertion failure:
1. Take an error screenshot
2. Record the failure details (expected vs actual)
3. Mark scenario as failed
4. Continue to next scenario (don't abort the suite)

### 5. Report Results

After all scenarios complete, output a summary:

```
=== QA Results ===
Total: X scenarios
Passed: Y
Failed: Z
Duration: A.Bs

Passed:
[PASS] smoke-page-load (6 steps, 2.1s)
[PASS] smoke-header-count (4 steps, 1.8s)

Failed:
[FAIL] grid-hover-state
  Step 4 failed: Verify hover effect changes opacity
  Expected: element opacity < 1
  Actual: element not found
  Screenshot: e2e/results/screenshots/grid-hover-state_error.png
```

### 6. Save Report

Write JSON report to `e2e/results/reports/{timestamp}.json` with structure:
- runId, timestamp, duration
- summary: { total, passed, failed }
- scenarios: array of results with step details

## Element Selection

Use these selectors (in order of preference):

1. **data-testid** (most reliable):
   - `[data-testid="header"]`
   - `[data-testid="game-count"]`
   - `[data-testid="game-grid"]`
   - `[data-testid="game-card"]`
   - `[data-testid="loading-spinner"]`
   - `[data-testid="error-message"]`
   - `[data-testid="retry-button"]`
   - `[data-testid="empty-message"]`

2. **Semantic elements**:
   - `header`, `main`, `h1`, `h3`
   - `img`, `svg`, `button`

3. **CSS classes** (least reliable, may change):
   - `.group.relative` (game cards)
   - `.animate-pulse` (skeleton loaders)

## Virtualization Note

The game grid uses `react-window` for virtualization. This means:
- Only visible items are in the DOM
- Scroll to bring items into view before asserting
- Use the game count in header as proxy for total count
- Cards are recycled when scrolling

## Skill Chain Usage

After completing code changes to the frontend, invoke `/qa smoke` to verify:

```
User: "Add search filter to game grid"
Claude: [Makes changes]
Claude: "Let me verify the changes work."
Claude: /qa smoke
[QA agent runs tests]
Claude: "All smoke tests passed. The search filter is working."
```

## Troubleshooting

**"Cannot find elements"**
- Wait for networkIdle before asserting
- Check if element is virtualized (may need to scroll)
- Verify data-testid attributes exist

**"Screenshots not saving"**
- Ensure e2e/results/screenshots/ directory exists
- Check write permissions

**"Tests timeout"**
- Default timeout is 10 seconds per step
- Increase timeout in scenario step if needed
- Check network/server performance
