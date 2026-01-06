import { test, expect } from '@playwright/test';
import {
  waitForPageLoad,
  waitForGamesLoad,
  getGameCount,
  getVisibleGameCards,
  setupConsoleErrorCapture,
  setupPageErrorCapture,
} from '../fixtures/test-helpers';

test.describe('Smoke Tests - Critical Path', () => {
  test.describe.configure({ mode: 'serial' });

  test('page loads successfully', async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);

    // Verify header is visible
    await expect(page.locator('[data-testid="header"]')).toBeVisible();

    // Verify page title or heading
    await expect(page.locator('h1')).toBeVisible();
  });

  test('displays game grid with cards', async ({ page }) => {
    await page.goto('/');
    await waitForGamesLoad(page);

    // Verify at least one game card is rendered
    const cardCount = await getVisibleGameCards(page);
    expect(cardCount).toBeGreaterThan(0);

    // Verify game grid container exists
    await expect(page.locator('[data-testid="game-grid"]')).toBeVisible();
  });

  test('header shows correct game count', async ({ page }) => {
    await page.goto('/');
    await waitForGamesLoad(page);

    // Get the game count from header
    const count = await getGameCount(page);

    // Should have games (we know the user has 2420)
    expect(count).toBeGreaterThan(0);

    // Verify the count element displays properly
    await expect(page.locator('[data-testid="game-count"]')).toBeVisible();
  });

  test('no JavaScript errors on page load', async ({ page }) => {
    const consoleErrors = setupConsoleErrorCapture(page);
    const pageErrors = setupPageErrorCapture(page);

    await page.goto('/');
    await waitForGamesLoad(page);

    // Allow some time for any async errors
    await page.waitForTimeout(2000);

    // Filter out known acceptable errors (e.g., third-party scripts)
    const criticalErrors = pageErrors.filter(
      (err) => !err.message.includes('ResizeObserver loop')
    );

    expect(criticalErrors).toHaveLength(0);
  });

  test('no error messages displayed', async ({ page }) => {
    await page.goto('/');
    await waitForGamesLoad(page);

    // Verify no error message is visible
    await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();

    // Verify no empty state message (should have games)
    await expect(page.locator('[data-testid="empty-message"]')).not.toBeVisible();
  });

  test('API health check responds', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/health');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.status).toBe('ok');
  });

  test('games API returns data', async ({ request }) => {
    const response = await request.get('http://localhost:3001/api/games?limit=10');
    expect(response.ok()).toBeTruthy();

    const data = await response.json();
    expect(data.data.items).toBeDefined();
    expect(data.data.items.length).toBeGreaterThan(0);
    expect(data.data.total).toBeGreaterThan(0);
  });
});
