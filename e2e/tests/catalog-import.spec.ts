import { test, expect } from '@playwright/test';

test.describe('Catalog Import', () => {
  test.describe('Admin Page', () => {
    test('admin page is accessible', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Should show admin heading
      await expect(page.getByRole('heading', { name: 'Admin' })).toBeVisible();
    });

    test('shows import section with file upload', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Should show import section
      await expect(
        page.getByRole('heading', { name: 'Import Subscription Catalog' })
      ).toBeVisible();

      // Should have file input
      await expect(page.locator('input[type="file"]')).toBeVisible();
    });

    test('shows JSON format reference', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Should show format section
      await expect(
        page.getByRole('heading', { name: 'Expected JSON Format' })
      ).toBeVisible();

      // Should show example JSON
      await expect(page.locator('pre')).toBeVisible();
    });

    test('has link back to library', async ({ page }) => {
      await page.goto('/admin');
      await page.waitForLoadState('networkidle');

      // Should have back link
      const backLink = page.getByRole('link', { name: 'Back to Library' });
      await expect(backLink).toBeVisible();

      // Clicking should navigate to library
      await backLink.click();
      await expect(page).toHaveURL('/');
    });
  });

  test.describe('API Endpoint', () => {
    test('catalog import endpoint accepts valid JSON', async ({ request }) => {
      const catalog = {
        platform: 'gamepass',
        games: [
          {
            title: 'E2E Test Game - Unique Title 12345',
            external_id: 'e2e-test-game',
            genres: ['Action', 'Adventure'],
          },
        ],
      };

      const response = await request.post(
        'http://localhost:3001/api/sync/catalog',
        {
          data: catalog,
        }
      );

      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.total).toBe(1);
      // Should either add or link (depending on if game exists)
      expect(data.data.added + data.data.linked).toBe(1);
    });

    test('catalog import endpoint validates platform', async ({ request }) => {
      const catalog = {
        platform: 'invalid-platform',
        games: [{ title: 'Test Game' }],
      };

      const response = await request.post(
        'http://localhost:3001/api/sync/catalog',
        {
          data: catalog,
        }
      );

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid platform');
    });

    test('catalog import endpoint requires games array', async ({ request }) => {
      const catalog = {
        platform: 'gamepass',
        // missing games array
      };

      const response = await request.post(
        'http://localhost:3001/api/sync/catalog',
        {
          data: catalog,
        }
      );

      expect(response.status()).toBe(400);

      const data = await response.json();
      expect(data.success).toBe(false);
      expect(data.error).toContain('games must be an array');
    });

    test('catalog import links existing games by Steam App ID', async ({
      request,
    }) => {
      // First, get an existing game to find a valid Steam App ID
      const gamesResponse = await request.get(
        'http://localhost:3001/api/games?limit=1'
      );
      const gamesData = await gamesResponse.json();
      const existingGame = gamesData.data.items[0];

      if (!existingGame.steam_app_id) {
        test.skip();
        return;
      }

      const catalog = {
        platform: 'eaplay',
        games: [
          {
            title: 'Different Title But Same Steam ID',
            steam_app_id: existingGame.steam_app_id,
            external_id: 'ea-test-game',
          },
        ],
      };

      const response = await request.post(
        'http://localhost:3001/api/sync/catalog',
        {
          data: catalog,
        }
      );

      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
      // Should link to existing game, not add new
      expect(data.data.linked).toBe(1);
      expect(data.data.added).toBe(0);
    });

    test('catalog import adds new games', async ({ request }) => {
      const uniqueTitle = `E2E New Game ${Date.now()}`;

      const catalog = {
        platform: 'ubisoftplus',
        games: [
          {
            title: uniqueTitle,
            external_id: `ubisoft-${Date.now()}`,
            developer: 'E2E Test Developer',
            genres: ['RPG'],
          },
        ],
      };

      const response = await request.post(
        'http://localhost:3001/api/sync/catalog',
        {
          data: catalog,
        }
      );

      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.added).toBe(1);
    });

    test('catalog import handles multiple games', async ({ request }) => {
      const catalog = {
        platform: 'gamepass',
        games: [
          { title: `E2E Batch Game 1 - ${Date.now()}`, external_id: 'batch-1' },
          { title: `E2E Batch Game 2 - ${Date.now()}`, external_id: 'batch-2' },
          { title: `E2E Batch Game 3 - ${Date.now()}`, external_id: 'batch-3' },
        ],
      };

      const response = await request.post(
        'http://localhost:3001/api/sync/catalog',
        {
          data: catalog,
        }
      );

      expect(response.ok()).toBeTruthy();

      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.data.total).toBe(3);
    });
  });
});
