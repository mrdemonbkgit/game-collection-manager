import { test, expect } from '@playwright/test';
import { waitForGamesLoad } from '../fixtures/test-helpers';

test.describe('Game Detail Page', () => {
  test('clicking a game card navigates to detail page', async ({ page }) => {
    await page.goto('/');
    await waitForGamesLoad(page);

    // Get the first game card's link
    const firstCard = page.locator('[data-testid="game-card"]').first();
    const link = firstCard.locator('a');

    // Get the href to verify it has the correct format
    const href = await link.getAttribute('href');
    expect(href).toMatch(/^\/game\/.+$/);

    // Click on the card
    await link.click();

    // Verify we navigated to the detail page
    await expect(page).toHaveURL(/\/game\/.+/);
  });

  test('detail page displays game title', async ({ page }) => {
    await page.goto('/');
    await waitForGamesLoad(page);

    // Get the first game's title
    const firstCard = page.locator('[data-testid="game-card"]').first();
    const gameTitle = await firstCard.locator('h3').textContent();

    // Navigate to detail page
    await firstCard.locator('a').click();
    await page.waitForLoadState('networkidle');

    // Verify the title is displayed on the detail page
    const pageTitle = page.locator('h1');
    await expect(pageTitle).toBeVisible();
    await expect(pageTitle).toContainText(gameTitle || '');
  });

  test('detail page has back button that returns to library', async ({ page }) => {
    await page.goto('/');
    await waitForGamesLoad(page);

    // Navigate to a game detail page
    await page.locator('[data-testid="game-card"]').first().locator('a').click();
    await page.waitForLoadState('networkidle');

    // Verify we're on the detail page
    await expect(page).toHaveURL(/\/game\/.+/);

    // Find and click the back button
    const backButton = page.locator('button:has-text("Back to Library")');
    await expect(backButton).toBeVisible();
    await backButton.click();

    // Verify we're back on the library page
    await expect(page).toHaveURL('/');
    await waitForGamesLoad(page);
  });

  test('detail page shows game metadata', async ({ page }) => {
    await page.goto('/');
    await waitForGamesLoad(page);

    // Navigate to a game detail page
    await page.locator('[data-testid="game-card"]').first().locator('a').click();
    await page.waitForLoadState('networkidle');

    // Verify basic metadata sections exist
    const title = page.locator('h1');
    await expect(title).toBeVisible();

    // Should have release date info
    await expect(page.getByText('Release Date:')).toBeVisible();
  });

  test('detail page shows ratings section', async ({ page }) => {
    await page.goto('/');
    await waitForGamesLoad(page);

    // Navigate to a game detail page
    await page.locator('[data-testid="game-card"]').first().locator('a').click();
    await page.waitForLoadState('networkidle');

    // Ratings section should exist (may show "No ratings available" if no scores)
    const ratingsSection = page.getByRole('heading', { name: 'Ratings' });
    await expect(ratingsSection).toBeVisible();
  });

  test('slug route API returns game data', async ({ request }) => {
    // First get a list of games to find a valid slug
    const gamesResponse = await request.get('http://localhost:3001/api/games?limit=1');
    expect(gamesResponse.ok()).toBeTruthy();

    const gamesData = await gamesResponse.json();
    const firstGame = gamesData.data.items[0];
    expect(firstGame.slug).toBeDefined();

    // Fetch the game by slug
    const slugResponse = await request.get(
      `http://localhost:3001/api/games/slug/${firstGame.slug}`
    );
    expect(slugResponse.ok()).toBeTruthy();

    const gameData = await slugResponse.json();
    expect(gameData.success).toBe(true);
    expect(gameData.data.title).toBe(firstGame.title);
    expect(gameData.data.slug).toBe(firstGame.slug);
  });

  test('slug route API returns 404 for non-existent game', async ({ request }) => {
    const response = await request.get(
      'http://localhost:3001/api/games/slug/this-game-does-not-exist-12345'
    );
    expect(response.status()).toBe(404);

    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Game not found');
  });

  test('detail page handles non-existent game gracefully', async ({ page }) => {
    // Navigate directly to a non-existent game
    await page.goto('/game/this-game-does-not-exist-99999');
    await page.waitForLoadState('networkidle');

    // Should show an error state (use heading to be specific)
    await expect(page.getByRole('heading', { name: 'Game Not Found' })).toBeVisible();

    // Should have a back button
    const backButton = page.getByRole('button', { name: 'Go Back' });
    await expect(backButton).toBeVisible();
  });

  test('preserves filter state when navigating back', async ({ page }) => {
    await page.goto('/?search=portal');
    await waitForGamesLoad(page);

    // Verify search is applied
    const searchInput = page.locator('input[type="text"][placeholder*="Search"]');
    await expect(searchInput).toHaveValue('portal');

    // Navigate to a game
    await page.locator('[data-testid="game-card"]').first().locator('a').click();
    await page.waitForLoadState('networkidle');

    // Go back using browser history (navigate(-1) preserves URL params)
    await page.locator('button:has-text("Back to Library")').click();
    await page.waitForLoadState('networkidle');

    // The search parameter should be preserved in history via navigate(-1)
    await expect(page).toHaveURL('/?search=portal');

    // And the search input should still have the value
    await expect(searchInput).toHaveValue('portal');
  });
});
