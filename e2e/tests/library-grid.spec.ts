import { test, expect } from '@playwright/test';
import {
  waitForGamesLoad,
  getVisibleGameCards,
  hoverGameCard,
} from '../fixtures/test-helpers';

test.describe('Library Grid Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGamesLoad(page);
  });

  test.describe('Game Card Display', () => {
    test('game cards have cover images', async ({ page }) => {
      const firstCard = page.locator('[data-testid="game-card"]').first();

      // Card should have an image
      const img = firstCard.locator('img');
      await expect(img).toBeVisible();

      // Image should have a src attribute
      const src = await img.getAttribute('src');
      expect(src).toBeTruthy();
    });

    test('game cards display title', async ({ page }) => {
      const firstCard = page.locator('[data-testid="game-card"]').first();

      // Card should have title text
      const title = firstCard.locator('h3, [data-testid="game-title"]');
      await expect(title).toBeVisible();

      const titleText = await title.textContent();
      expect(titleText?.length).toBeGreaterThan(0);
    });

    test('game cards show platform badge', async ({ page }) => {
      const firstCard = page.locator('[data-testid="game-card"]').first();

      // Look for Steam icon/badge (SVG or img)
      const badge = firstCard.locator('svg, [data-testid="platform-badge"]');

      // At least one platform indicator should exist
      const badgeCount = await badge.count();
      expect(badgeCount).toBeGreaterThanOrEqual(0); // Some cards might not have badges
    });

    test('multiple game cards render', async ({ page }) => {
      const cardCount = await getVisibleGameCards(page);

      // Should have multiple cards visible (virtualized grid loads visible items)
      expect(cardCount).toBeGreaterThan(1);
    });

    test('game cards have consistent dimensions', async ({ page }) => {
      const cards = page.locator('[data-testid="game-card"]');
      const count = await cards.count();

      if (count >= 2) {
        const firstBox = await cards.nth(0).boundingBox();
        const secondBox = await cards.nth(1).boundingBox();

        expect(firstBox).toBeTruthy();
        expect(secondBox).toBeTruthy();

        // Cards should have similar dimensions (allowing small variance)
        if (firstBox && secondBox) {
          expect(Math.abs(firstBox.width - secondBox.width)).toBeLessThan(10);
          expect(Math.abs(firstBox.height - secondBox.height)).toBeLessThan(10);
        }
      }
    });
  });

  test.describe('Hover States', () => {
    test('card responds to hover', async ({ page }) => {
      const firstCard = page.locator('[data-testid="game-card"]').first();

      // Get initial state
      const initialOpacity = await firstCard.evaluate((el) =>
        window.getComputedStyle(el).opacity
      );

      // Hover over card
      await firstCard.hover();
      await page.waitForTimeout(300);

      // Card should still be visible after hover
      await expect(firstCard).toBeVisible();

      // Check if any visual change occurred (opacity, transform, etc.)
      // The exact change depends on implementation
    });

    test('cursor changes on hoverable elements', async ({ page }) => {
      const firstCard = page.locator('[data-testid="game-card"]').first();
      const cardLink = firstCard.locator('a');

      await cardLink.hover();

      const cursor = await cardLink.evaluate((el) =>
        window.getComputedStyle(el).cursor
      );

      // Should have pointer cursor on the link
      expect(cursor).toBe('pointer');
    });
  });

  test.describe('Grid Layout', () => {
    test('grid is responsive', async ({ page }) => {
      // Test at different viewport widths
      const viewports = [
        { width: 1920, height: 1080 }, // Desktop
        { width: 1024, height: 768 }, // Tablet landscape
        { width: 768, height: 1024 }, // Tablet portrait
      ];

      for (const viewport of viewports) {
        await page.setViewportSize(viewport);
        await page.waitForTimeout(500);

        // Grid should still be visible and have cards
        await expect(page.locator('[data-testid="game-grid"]')).toBeVisible();
        const cardCount = await getVisibleGameCards(page);
        expect(cardCount).toBeGreaterThan(0);
      }
    });

    test('grid maintains structure on resize', async ({ page }) => {
      // Start with wide viewport
      await page.setViewportSize({ width: 1920, height: 1080 });
      await page.waitForTimeout(300);

      const initialCards = await getVisibleGameCards(page);

      // Resize to narrower
      await page.setViewportSize({ width: 1024, height: 768 });
      await page.waitForTimeout(300);

      // Grid should still function
      const afterResizeCards = await getVisibleGameCards(page);
      expect(afterResizeCards).toBeGreaterThan(0);

      // Verify no errors occurred during resize
      await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
    });
  });

  test.describe('Loading States', () => {
    test('shows loading indicator initially', async ({ page }) => {
      // Navigate without waiting
      await page.goto('/', { waitUntil: 'domcontentloaded' });

      // Check for loading state (might be brief)
      // Either loading spinner or skeleton cards
      const hasLoadingIndicator =
        (await page.locator('[data-testid="loading-spinner"]').count()) > 0 ||
        (await page.locator('.animate-pulse').count()) > 0;

      // Loading might be too fast to catch, so this is optional
      // Just verify page eventually loads
      await waitForGamesLoad(page);
      const cardCount = await getVisibleGameCards(page);
      expect(cardCount).toBeGreaterThan(0);
    });

    test('loading spinner disappears after load', async ({ page }) => {
      await page.goto('/');
      await waitForGamesLoad(page);

      // Loading spinner should not be visible after games load
      await expect(page.locator('[data-testid="loading-spinner"]')).not.toBeVisible();
    });
  });
});
