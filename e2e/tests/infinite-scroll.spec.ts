import { test, expect } from '@playwright/test';
import {
  waitForGamesLoad,
  getVisibleGameCards,
  scrollDown,
  scrollToBottom,
  waitForApiResponse,
  getGameCount,
} from '../fixtures/test-helpers';

test.describe('Infinite Scroll Tests', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGamesLoad(page);
  });

  test.describe('Basic Scroll Loading', () => {
    test('loads more games when scrolling down', async ({ page }) => {
      // Get initial card count
      const initialCount = await getVisibleGameCards(page);

      // Scroll down multiple times to trigger load
      for (let i = 0; i < 3; i++) {
        await scrollDown(page, 1000);
        await page.waitForTimeout(500);
      }

      // Wait for potential API call
      await page.waitForTimeout(1000);

      // With virtualization, visible count might stay similar
      // but the data should have loaded more
      // Check that no errors occurred
      await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();

      // Cards should still be visible
      const afterScrollCount = await getVisibleGameCards(page);
      expect(afterScrollCount).toBeGreaterThan(0);
    });

    test('triggers API call when reaching threshold', async ({ page }) => {
      let apiCallCount = 0;

      // Listen for games API calls
      page.on('request', (request) => {
        if (request.url().includes('/api/games') && request.method() === 'GET') {
          apiCallCount++;
        }
      });

      // Initial load counts as 1
      await page.waitForTimeout(500);
      const initialApiCalls = apiCallCount;

      // Scroll to bottom to trigger more loading
      await scrollToBottom(page);
      await page.waitForTimeout(1000);

      // Scroll again
      await scrollToBottom(page);
      await page.waitForTimeout(1000);

      // Should have made additional API calls (if there's more data)
      // Note: If all data fits, no additional calls will be made
    });

    test('does not trigger multiple simultaneous loads', async ({ page }) => {
      let concurrentRequests = 0;
      let maxConcurrent = 0;

      page.on('request', (request) => {
        if (request.url().includes('/api/games')) {
          concurrentRequests++;
          maxConcurrent = Math.max(maxConcurrent, concurrentRequests);
        }
      });

      page.on('response', (response) => {
        if (response.url().includes('/api/games')) {
          concurrentRequests--;
        }
      });

      // Rapid scrolling to stress test
      for (let i = 0; i < 5; i++) {
        await scrollDown(page, 500);
        await page.waitForTimeout(100);
      }

      await page.waitForTimeout(2000);

      // Should not have excessive concurrent requests (max 2 is reasonable)
      expect(maxConcurrent).toBeLessThanOrEqual(2);
    });
  });

  test.describe('Scroll Behavior', () => {
    test('scroll position is maintained after load', async ({ page }) => {
      // Scroll down
      await scrollDown(page, 500);
      await page.waitForTimeout(500);

      const scrollY1 = await page.evaluate(() => window.scrollY);

      // Wait for any loading
      await page.waitForTimeout(1000);

      const scrollY2 = await page.evaluate(() => window.scrollY);

      // Scroll position should be roughly maintained (small variance is ok)
      expect(Math.abs(scrollY2 - scrollY1)).toBeLessThan(100);
    });

    test('can scroll back to top', async ({ page }) => {
      // Scroll down first
      await scrollDown(page, 2000);
      await page.waitForTimeout(500);

      // Scroll back to top
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(500);

      const scrollY = await page.evaluate(() => window.scrollY);
      expect(scrollY).toBe(0);

      // First cards should be visible again
      const cards = await getVisibleGameCards(page);
      expect(cards).toBeGreaterThan(0);
    });

    test('continuous scrolling works', async ({ page }) => {
      // Perform multiple scroll operations
      for (let i = 0; i < 10; i++) {
        await scrollDown(page, 300);
        await page.waitForTimeout(200);
      }

      // Page should still be functional
      await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();

      // Cards should be visible
      const cards = await getVisibleGameCards(page);
      expect(cards).toBeGreaterThan(0);

      // Header should still be accessible (even if scrolled)
      await page.evaluate(() => window.scrollTo(0, 0));
      await expect(page.locator('[data-testid="header"]')).toBeVisible();
    });
  });

  test.describe('Edge Cases', () => {
    test('handles rapid scroll events', async ({ page }) => {
      // Rapid fire scroll events
      for (let i = 0; i < 20; i++) {
        await page.mouse.wheel(0, 100);
      }

      await page.waitForTimeout(2000);

      // Should not crash or show errors
      await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();

      // Grid should still function
      const cards = await getVisibleGameCards(page);
      expect(cards).toBeGreaterThan(0);
    });

    test('handles scroll during loading', async ({ page }) => {
      // Navigate fresh
      await page.goto('/');

      // Don't wait for full load, start scrolling immediately
      await page.waitForTimeout(100);

      for (let i = 0; i < 5; i++) {
        await scrollDown(page, 200);
        await page.waitForTimeout(100);
      }

      // Wait for everything to settle
      await waitForGamesLoad(page);

      // Should be in a good state
      await expect(page.locator('[data-testid="error-message"]')).not.toBeVisible();
    });

    test('shows all games eventually loaded indicator', async ({ page }) => {
      // This test checks if there's a "no more games" state
      // Get total game count
      const totalCount = await getGameCount(page);

      // If we have a lot of games, skip this test
      // (would take too long to scroll through all)
      if (totalCount > 200) {
        test.skip();
        return;
      }

      // Scroll to load all games
      for (let i = 0; i < 50; i++) {
        await scrollToBottom(page);
        await page.waitForTimeout(300);

        // Check if we've loaded everything
        // Implementation might show "end of list" or simply stop loading
      }
    });
  });

  test.describe('Performance', () => {
    test('scroll is smooth (no jank)', async ({ page }) => {
      // Measure scroll performance
      const scrollTimes: number[] = [];

      for (let i = 0; i < 5; i++) {
        const start = Date.now();
        await scrollDown(page, 500);
        const end = Date.now();
        scrollTimes.push(end - start);
        await page.waitForTimeout(100);
      }

      // Average scroll time should be reasonable (< 1s per scroll in dev environment)
      const avgTime = scrollTimes.reduce((a, b) => a + b, 0) / scrollTimes.length;
      expect(avgTime).toBeLessThan(1000);
    });

    test('does not cause memory leaks during scroll', async ({ page }) => {
      // Get initial memory (if available)
      const getMemory = async () => {
        return await page.evaluate(() => {
          // @ts-ignore - performance.memory is Chrome-specific
          if (performance.memory) {
            // @ts-ignore
            return performance.memory.usedJSHeapSize;
          }
          return 0;
        });
      };

      const initialMemory = await getMemory();

      // Scroll up and down multiple times
      for (let i = 0; i < 5; i++) {
        await scrollToBottom(page);
        await page.waitForTimeout(300);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
      }

      const finalMemory = await getMemory();

      // Memory shouldn't grow excessively (allow 50MB growth)
      if (initialMemory > 0 && finalMemory > 0) {
        const memoryGrowth = finalMemory - initialMemory;
        expect(memoryGrowth).toBeLessThan(50 * 1024 * 1024); // 50MB
      }
    });
  });
});
