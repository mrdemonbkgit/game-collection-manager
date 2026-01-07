import { test, expect, request } from '@playwright/test';
import { waitForGamesLoad, waitForPageLoad } from '../fixtures/test-helpers';

// Helper to clear all collections before tests
async function clearAllCollections(baseURL: string) {
  const apiContext = await request.newContext({ baseURL });
  // Get all collections
  const response = await apiContext.get('/api/collections');
  if (response.ok()) {
    const data = await response.json();
    // Delete each collection
    for (const collection of data.data || []) {
      await apiContext.delete(`/api/collections/${collection.id}`);
    }
  }
  await apiContext.dispose();
}

test.describe('Collections', () => {
  // Clear collections before each test to ensure clean state
  test.beforeEach(async ({ page, baseURL }) => {
    await clearAllCollections(baseURL || 'http://localhost:3000');
    await page.goto('/');
    await waitForPageLoad(page);
  });

  test.describe('Collections Section in Sidebar', () => {
    test('displays collections heading in filter sidebar', async ({ page }) => {
      // Use role instead of text selector to be more specific
      const collectionsHeading = page.getByRole('heading', { name: 'Collections' });
      await expect(collectionsHeading).toBeVisible();
    });

    test('shows "No collections yet" when empty', async ({ page }) => {
      const emptyMessage = page.locator('text=No collections yet');
      await expect(emptyMessage).toBeVisible();
    });

    test('shows create collection button', async ({ page }) => {
      const createButton = page.locator('[data-testid="create-collection"]');
      await expect(createButton).toBeVisible();
      await expect(createButton).toHaveText('+ New');
    });
  });

  test.describe('Create Collection Modal', () => {
    test('opens modal when create button is clicked', async ({ page }) => {
      const createButton = page.locator('[data-testid="create-collection"]');
      await createButton.click();

      const modal = page.locator('[data-testid="collection-modal"]');
      await expect(modal).toBeVisible();
      await expect(page.locator('text=Create Collection')).toBeVisible();
    });

    test('shows required name input and description input', async ({ page }) => {
      await page.locator('[data-testid="create-collection"]').click();

      await expect(page.locator('[data-testid="collection-name-input"]')).toBeVisible();
      await expect(page.locator('[data-testid="collection-description-input"]')).toBeVisible();
    });

    test('closes modal when cancel is clicked', async ({ page }) => {
      await page.locator('[data-testid="create-collection"]').click();
      await page.locator('[data-testid="collection-cancel"]').click();

      await expect(page.locator('[data-testid="collection-modal"]')).not.toBeVisible();
    });

    test('closes modal when clicking overlay', async ({ page }) => {
      await page.locator('[data-testid="create-collection"]').click();
      await page.locator('[data-testid="collection-modal-overlay"]').click({ position: { x: 10, y: 10 } });

      await expect(page.locator('[data-testid="collection-modal"]')).not.toBeVisible();
    });

    test('shows error when submitting empty name', async ({ page }) => {
      await page.locator('[data-testid="create-collection"]').click();
      await page.locator('[data-testid="collection-save"]').click();

      await expect(page.locator('[data-testid="collection-error"]')).toBeVisible();
      await expect(page.locator('text=Collection name is required')).toBeVisible();
    });

    test('creates collection with valid name', async ({ page }) => {
      await page.locator('[data-testid="create-collection"]').click();

      // Fill in name
      await page.locator('[data-testid="collection-name-input"]').fill('Test Collection');
      await page.locator('[data-testid="collection-save"]').click();

      // Modal should close
      await expect(page.locator('[data-testid="collection-modal"]')).not.toBeVisible();

      // Collection should appear in sidebar
      await page.waitForTimeout(500); // Wait for state update
      await expect(page.locator('text=Test Collection')).toBeVisible();
    });

    test('creates collection with description', async ({ page }) => {
      await page.locator('[data-testid="create-collection"]').click();

      await page.locator('[data-testid="collection-name-input"]').fill('My Favorites');
      await page.locator('[data-testid="collection-description-input"]').fill('Games I love');
      await page.locator('[data-testid="collection-save"]').click();

      await expect(page.locator('[data-testid="collection-modal"]')).not.toBeVisible();
      await expect(page.locator('text=My Favorites')).toBeVisible();
    });
  });

  test.describe('Smart Filters', () => {
    test('shows smart filter checkbox when filters are active', async ({ page }) => {
      await waitForGamesLoad(page);

      // Apply a search filter
      const searchInput = page.locator('[data-testid="search-input"]');
      await searchInput.fill('witcher');
      await page.waitForTimeout(500);
      await page.waitForLoadState('networkidle');

      // Open collection modal
      await page.locator('[data-testid="create-collection"]').click();

      // Smart filter checkbox should be visible
      await expect(page.locator('[data-testid="smart-filter-checkbox"]')).toBeVisible();
    });

    test('does not show smart filter checkbox when no filters active', async ({ page }) => {
      await waitForGamesLoad(page);

      // Open collection modal without any filters
      await page.locator('[data-testid="create-collection"]').click();

      // Smart filter checkbox should not be visible
      await expect(page.locator('[data-testid="smart-filter-checkbox"]')).not.toBeVisible();
    });

    test('creates smart filter that captures current search', async ({ page }) => {
      await waitForGamesLoad(page);

      // Apply search filter
      const searchInput = page.locator('[data-testid="search-input"]');
      await searchInput.fill('witcher');
      await page.waitForTimeout(500);
      await page.waitForLoadState('networkidle');

      // Create smart filter
      await page.locator('[data-testid="create-collection"]').click();
      await page.locator('[data-testid="collection-name-input"]').fill('Witcher Games');
      await page.locator('[data-testid="smart-filter-checkbox"]').check();
      await page.locator('[data-testid="collection-save"]').click();

      // Wait for modal to close and collection to appear
      await expect(page.locator('[data-testid="collection-modal"]')).not.toBeVisible();
      await page.waitForTimeout(500);

      // Smart filter should show in sidebar
      await expect(page.locator('text=Witcher Games')).toBeVisible();
      // Smart filters show "Smart" instead of count
      await expect(page.locator('[data-testid="filter-sidebar"]').locator('text=Smart')).toBeVisible();
    });
  });

  test.describe('Add Game to Collection', () => {
    test.beforeEach(async ({ page }) => {
      // First create a collection
      await page.locator('[data-testid="create-collection"]').click();
      await page.locator('[data-testid="collection-name-input"]').fill('Test Add Games');
      await page.locator('[data-testid="collection-save"]').click();
      await page.waitForTimeout(500);
    });

    test('shows add to collection button on game card hover', async ({ page }) => {
      await waitForGamesLoad(page);

      // Hover over first game card
      const firstCard = page.locator('[data-testid="game-card"]').first();
      await firstCard.hover();

      // Add button should appear (the button is based on game id, so look for any add button)
      const addButton = firstCard.locator('[data-testid^="add-to-collection-btn-"]');
      await expect(addButton).toBeVisible();
    });

    test('opens collection dropdown when add button is clicked', async ({ page }) => {
      await waitForGamesLoad(page);

      // Hover and click add button
      const firstCard = page.locator('[data-testid="game-card"]').first();
      await firstCard.hover();
      await firstCard.locator('[data-testid^="add-to-collection-btn-"]').click();

      // Dropdown should appear
      await expect(page.locator('[data-testid="add-to-collection-dropdown"]')).toBeVisible();
    });

    test('shows collection in dropdown', async ({ page }) => {
      await waitForGamesLoad(page);

      const firstCard = page.locator('[data-testid="game-card"]').first();
      await firstCard.hover();
      await firstCard.locator('[data-testid^="add-to-collection-btn-"]').click();

      // Our test collection should be in the dropdown (use first() to handle parallel test instances)
      await expect(page.locator('[data-testid="add-to-collection-dropdown"]').locator('text=Test Add Games').first()).toBeVisible();
    });

    test('adds game to collection when clicked', async ({ page }) => {
      await waitForGamesLoad(page);

      const firstCard = page.locator('[data-testid="game-card"]').first();
      await firstCard.hover();
      await firstCard.locator('[data-testid^="add-to-collection-btn-"]').click();

      // Click on the collection option
      const collectionOption = page.locator('[data-testid^="add-to-collection-"]').first();
      await collectionOption.click();

      // Wait for the action to complete
      await page.waitForTimeout(500);
      await page.waitForLoadState('networkidle');
    });
  });

  test.describe('Filter by Collection', () => {
    test.beforeEach(async ({ page }) => {
      // Create a collection and add a game
      await page.locator('[data-testid="create-collection"]').click();
      await page.locator('[data-testid="collection-name-input"]').fill('Filter Test Collection');
      await page.locator('[data-testid="collection-save"]').click();
      await page.waitForTimeout(500);
      await waitForGamesLoad(page);

      // Add a game to the collection
      const firstCard = page.locator('[data-testid="game-card"]').first();
      await firstCard.hover();
      await firstCard.locator('[data-testid^="add-to-collection-btn-"]').click();
      const collectionOption = page.locator('[data-testid^="add-to-collection-"]').first();
      await collectionOption.click();
      await page.waitForTimeout(500);

      // Close dropdown by clicking elsewhere
      await page.click('body');
    });

    test('filters games when collection checkbox is clicked', async ({ page }) => {
      // Get initial count
      const initialCountText = await page.locator('[data-testid="game-count"]').textContent();

      // Click on the collection checkbox in sidebar - find it within the sidebar to avoid modal/input conflicts
      const sidebar = page.locator('[data-testid="filter-sidebar"]');
      const collectionCheckbox = sidebar.locator('input[type="checkbox"][data-testid^="collection-"]').first();
      await collectionCheckbox.click();
      await page.waitForTimeout(500);
      await page.waitForLoadState('networkidle');

      // Count should change - we added 1 game to the collection, so it should show "Showing 1 of X"
      const filteredCountText = await page.locator('[data-testid="game-count"]').textContent();
      expect(filteredCountText).toContain('Showing');
      expect(filteredCountText).not.toBe(initialCountText);
    });

    test('persists collection filter in URL', async ({ page }) => {
      // Click on collection checkbox within sidebar
      const sidebar = page.locator('[data-testid="filter-sidebar"]');
      const collectionCheckbox = sidebar.locator('input[type="checkbox"][data-testid^="collection-"]').first();
      await collectionCheckbox.click();
      await page.waitForTimeout(500);
      await page.waitForLoadState('networkidle');

      // URL should contain collections param
      expect(page.url()).toContain('collections=');
    });
  });

  test.describe('Collection Sidebar Display', () => {
    test('shows game count for collections', async ({ page }) => {
      // Create a collection
      await page.locator('[data-testid="create-collection"]').click();
      await page.locator('[data-testid="collection-name-input"]').fill('Count Test');
      await page.locator('[data-testid="collection-save"]').click();
      await page.waitForTimeout(500);
      await waitForGamesLoad(page);

      // Collection should show with count 0
      const collectionLabel = page.locator('text=Count Test');
      await expect(collectionLabel).toBeVisible();

      // The count should be 0
      const sidebar = page.locator('[data-testid="filter-sidebar"]');
      // Count is displayed near the collection name
      await expect(sidebar.locator('text=0').first()).toBeVisible();
    });

    test('distinguishes smart filters from regular collections', async ({ page }) => {
      await waitForGamesLoad(page);

      // Create a regular collection
      await page.locator('[data-testid="create-collection"]').click();
      await page.locator('[data-testid="collection-name-input"]').fill('Regular Collection');
      await page.locator('[data-testid="collection-save"]').click();
      await page.waitForTimeout(500);

      // Apply a filter and create a smart filter
      const searchInput = page.locator('[data-testid="search-input"]');
      await searchInput.fill('witcher');
      await page.waitForTimeout(500);
      await page.waitForLoadState('networkidle');

      await page.locator('[data-testid="create-collection"]').click();
      await page.locator('[data-testid="collection-name-input"]').fill('Smart Filter');
      await page.locator('[data-testid="smart-filter-checkbox"]').check();
      await page.locator('[data-testid="collection-save"]').click();
      await page.waitForTimeout(500);

      // Both should appear in sidebar
      await expect(page.locator('text=Regular Collection')).toBeVisible();
      await expect(page.locator('text=Smart Filter')).toBeVisible();
    });
  });

  test.describe('Clear Filters with Collections', () => {
    test('clears collection filter when Clear All is clicked', async ({ page }) => {
      // Create and select a collection
      await page.locator('[data-testid="create-collection"]').click();
      await page.locator('[data-testid="collection-name-input"]').fill('Clear Test');
      await page.locator('[data-testid="collection-save"]').click();
      await page.waitForTimeout(500);
      await waitForGamesLoad(page);

      const sidebar = page.locator('[data-testid="filter-sidebar"]');
      const collectionCheckbox = sidebar.locator('input[type="checkbox"][data-testid^="collection-"]').first();
      await collectionCheckbox.click();
      await page.waitForTimeout(500);
      await page.waitForLoadState('networkidle');

      // Clear all filters
      const clearButton = page.locator('[data-testid="clear-filters"]');
      await clearButton.click();
      await page.waitForTimeout(500);
      await page.waitForLoadState('networkidle');

      // Collection should be unchecked
      await expect(collectionCheckbox).not.toBeChecked();

      // URL should not have collections param
      expect(page.url()).not.toContain('collections=');
    });
  });
});
