import { Page, expect } from '@playwright/test';

/**
 * Wait for the page to fully load (network idle + elements visible)
 */
export async function waitForPageLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('[data-testid="header"]', { state: 'visible' });
}

/**
 * Wait for games to load in the grid
 */
export async function waitForGamesLoad(page: Page): Promise<void> {
  await page.waitForLoadState('networkidle');
  // Wait for at least one game card to appear
  await page.waitForSelector('[data-testid="game-card"]', {
    state: 'visible',
    timeout: 15000,
  });
}

/**
 * Get the game count from the header
 */
export async function getGameCount(page: Page): Promise<number> {
  const countElement = page.locator('[data-testid="game-count"]');
  const text = await countElement.textContent();
  // Parse number from text like "2,420 games"
  const match = text?.match(/[\d,]+/);
  if (!match) return 0;
  return parseInt(match[0].replace(/,/g, ''), 10);
}

/**
 * Get all visible game cards
 */
export async function getVisibleGameCards(page: Page): Promise<number> {
  const cards = page.locator('[data-testid="game-card"]');
  return await cards.count();
}

/**
 * Scroll down the page by a specified amount
 */
export async function scrollDown(page: Page, pixels: number = 1000): Promise<void> {
  await page.evaluate((scrollAmount) => {
    window.scrollBy(0, scrollAmount);
  }, pixels);
  // Wait for potential new content to load
  await page.waitForTimeout(500);
}

/**
 * Scroll to the bottom of the page
 */
export async function scrollToBottom(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.scrollTo(0, document.body.scrollHeight);
  });
  await page.waitForTimeout(500);
}

/**
 * Check if there are any console errors
 */
export function setupConsoleErrorCapture(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push(msg.text());
    }
  });
  return errors;
}

/**
 * Check for JavaScript errors on the page
 */
export function setupPageErrorCapture(page: Page): Error[] {
  const errors: Error[] = [];
  page.on('pageerror', (error) => {
    errors.push(error);
  });
  return errors;
}

/**
 * Wait for network requests to complete
 */
export async function waitForApiResponse(
  page: Page,
  urlPattern: string | RegExp
): Promise<void> {
  await page.waitForResponse(
    (response) =>
      (typeof urlPattern === 'string'
        ? response.url().includes(urlPattern)
        : urlPattern.test(response.url())) && response.status() === 200
  );
}

/**
 * Hover over a game card and verify hover state
 */
export async function hoverGameCard(
  page: Page,
  index: number = 0
): Promise<void> {
  const card = page.locator('[data-testid="game-card"]').nth(index);
  await card.hover();
  await page.waitForTimeout(300); // Wait for hover animation
}
