import { test, expect } from '@playwright/test';
import { waitForGamesLoad, waitForPageLoad } from '../fixtures/test-helpers';

test.describe('Search, Filter & Sort', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test.describe('Search', () => {
    test('displays search input in header', async ({ page }) => {
      await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
    });

    test('filters games when typing in search', async ({ page }) => {
      await waitForGamesLoad(page);

      // Type in search
      const searchInput = page.locator('[data-testid="search-input"]');
      await searchInput.fill('witcher');

      // Wait for debounce and API response
      await page.waitForTimeout(500);
      await page.waitForLoadState('networkidle');

      // Should show filtered count
      const countText = await page.locator('[data-testid="game-count"]').textContent();
      expect(countText).toContain('Showing');
      expect(countText).toContain('of');

      // Should only show Witcher games
      const gameCards = page.locator('[data-testid="game-card"]');
      const count = await gameCards.count();
      expect(count).toBeGreaterThan(0);
      expect(count).toBeLessThan(50); // Should be filtered down
    });

    test('clears search when clear button is clicked', async ({ page }) => {
      await waitForGamesLoad(page);

      // Type in search
      const searchInput = page.locator('[data-testid="search-input"]');
      await searchInput.fill('witcher');
      await page.waitForTimeout(500);

      // Click clear button
      const clearButton = page.locator('[data-testid="search-clear"]');
      await clearButton.click();

      // Search input should be empty
      await expect(searchInput).toHaveValue('');
    });

    test('persists search in URL', async ({ page }) => {
      await waitForGamesLoad(page);

      // Type in search
      const searchInput = page.locator('[data-testid="search-input"]');
      await searchInput.fill('witcher');
      await page.waitForTimeout(500);
      await page.waitForLoadState('networkidle');

      // URL should contain search param
      expect(page.url()).toContain('search=witcher');
    });

    test('restores search from URL on page load', async ({ page }) => {
      // Navigate directly with search param
      await page.goto('/?search=witcher');
      await waitForGamesLoad(page);

      // Search input should have the value
      const searchInput = page.locator('[data-testid="search-input"]');
      await expect(searchInput).toHaveValue('witcher');

      // Should show filtered results
      const countText = await page.locator('[data-testid="game-count"]').textContent();
      expect(countText).toContain('Showing');
    });
  });

  test.describe('Sort', () => {
    test('displays sort dropdown in header', async ({ page }) => {
      await expect(page.locator('[data-testid="sort-dropdown"]')).toBeVisible();
    });

    test('changes sort order when selecting option', async ({ page }) => {
      await waitForGamesLoad(page);

      // Get first game title before changing sort
      const firstGameBefore = await page.locator('[data-testid="game-card"]').first().textContent();

      // Change to Z-A sort
      const sortDropdown = page.locator('[data-testid="sort-dropdown"]');
      await sortDropdown.selectOption('title-desc');
      await page.waitForLoadState('networkidle');

      // Get first game title after
      const firstGameAfter = await page.locator('[data-testid="game-card"]').first().textContent();

      // Should be different (Z games should come first now)
      expect(firstGameAfter).not.toBe(firstGameBefore);
    });

    test('persists sort in URL', async ({ page }) => {
      await waitForGamesLoad(page);

      // Change sort to release date (not default, so both params appear in URL)
      const sortDropdown = page.locator('[data-testid="sort-dropdown"]');
      await sortDropdown.selectOption('release-desc');
      await page.waitForLoadState('networkidle');

      // URL should contain sort params
      expect(page.url()).toContain('sortBy=release_date');
      expect(page.url()).toContain('sortOrder=desc');
    });

    test('restores sort from URL on page load', async ({ page }) => {
      // Navigate with sort params
      await page.goto('/?sortBy=title&sortOrder=desc');
      await waitForGamesLoad(page);

      // Sort dropdown should show Z-A
      const sortDropdown = page.locator('[data-testid="sort-dropdown"]');
      await expect(sortDropdown).toHaveValue('title-desc');
    });
  });

  test.describe('Filter Sidebar', () => {
    test('displays filter sidebar', async ({ page }) => {
      await expect(page.locator('[data-testid="filter-sidebar"]')).toBeVisible();
    });

    test('shows platform filter with Steam checkbox', async ({ page }) => {
      await expect(page.locator('[data-testid="platform-steam"]')).toBeVisible();
    });

    test('shows genre message when no genres available', async ({ page }) => {
      // Should show message about no genres
      const genreMessage = page.locator('text=No genres available');
      await expect(genreMessage).toBeVisible();
    });

    test('filters by platform when checkbox is clicked', async ({ page }) => {
      await waitForGamesLoad(page);

      // Click Steam filter
      const steamCheckbox = page.locator('[data-testid="platform-steam"]');
      await steamCheckbox.check();
      await page.waitForLoadState('networkidle');

      // URL should contain platform param
      expect(page.url()).toContain('platforms=steam');
    });

    test('shows Clear All button when filters are active', async ({ page }) => {
      await waitForGamesLoad(page);

      // Initially no clear button
      await expect(page.locator('[data-testid="clear-filters"]')).not.toBeVisible();

      // Add a filter via URL
      await page.goto('/?search=test');
      await waitForGamesLoad(page);

      // Now clear button should be visible
      await expect(page.locator('[data-testid="clear-filters"]')).toBeVisible();
    });

    test('clears all filters when Clear All is clicked', async ({ page }) => {
      // Start with filters active
      await page.goto('/?search=witcher&platforms=steam');
      await waitForGamesLoad(page);

      // Click clear all
      const clearButton = page.locator('[data-testid="clear-filters"]');
      await clearButton.click();
      await page.waitForLoadState('networkidle');

      // URL should be clean
      expect(page.url()).not.toContain('search=');
      expect(page.url()).not.toContain('platforms=');

      // Search input should be empty
      const searchInput = page.locator('[data-testid="search-input"]');
      await expect(searchInput).toHaveValue('');
    });
  });

  test.describe('Combined Filters', () => {
    test('applies search and sort together', async ({ page }) => {
      await page.goto('/?search=witcher&sortBy=title&sortOrder=desc');
      await waitForGamesLoad(page);

      // Should show filtered count
      const countText = await page.locator('[data-testid="game-count"]').textContent();
      expect(countText).toContain('Showing');

      // Sort should be Z-A
      const sortDropdown = page.locator('[data-testid="sort-dropdown"]');
      await expect(sortDropdown).toHaveValue('title-desc');

      // First game should be Thronebreaker (last alphabetically among Witcher games)
      const firstGame = await page.locator('[data-testid="game-card"]').first().textContent();
      expect(firstGame).toContain('Thronebreaker');
    });

    test('applies search and platform filter together', async ({ page }) => {
      await page.goto('/?search=witcher&platforms=steam');
      await waitForGamesLoad(page);

      // Should show only Steam Witcher games
      const countText = await page.locator('[data-testid="game-count"]').textContent();
      expect(countText).toContain('Showing');

      // Platform checkbox should be checked
      const steamCheckbox = page.locator('[data-testid="platform-steam"]');
      await expect(steamCheckbox).toBeChecked();
    });
  });

  test.describe('Empty State', () => {
    test('shows no results message for search with no matches', async ({ page }) => {
      await page.goto('/?search=xyznonexistentgame123');
      await page.waitForLoadState('networkidle');

      // Should show empty message
      await expect(page.locator('[data-testid="empty-message"]')).toBeVisible();
    });

    test('shows clear filters button in empty state', async ({ page }) => {
      await page.goto('/?search=xyznonexistentgame123');
      await page.waitForLoadState('networkidle');

      // Should have a clear filters option
      const clearText = page.locator('text=Clear all filters');
      await expect(clearText).toBeVisible();
    });
  });
});
