/**
 * Smoke Tests - Critical Path Verification
 *
 * These tests verify the most critical functionality works.
 * Run these after any significant change to catch major regressions.
 */

import { TestScenario } from '../types/scenario';

export const smokeTests: TestScenario[] = [
  {
    id: 'smoke-page-load',
    name: 'Page loads with game grid',
    description: 'Verify the library page loads and displays games correctly',
    tags: ['smoke', 'critical'],
    priority: 'critical',
    steps: [
      {
        action: 'navigate',
        url: 'http://localhost:5173',
        description: 'Navigate to library page',
      },
      {
        action: 'wait',
        condition: { type: 'networkIdle', timeout: 10000 },
        description: 'Wait for initial data load',
      },
      {
        action: 'assert',
        assertion: { type: 'elementVisible', selector: '[data-testid="header"]' },
        description: 'Verify header is visible',
      },
      {
        action: 'assert',
        assertion: { type: 'textPresent', text: 'games' },
        description: 'Verify game count text is displayed',
      },
      {
        action: 'assert',
        assertion: {
          type: 'elementCount',
          selector: '[data-testid="game-card"]',
          count: 1,
          operator: 'gte',
        },
        description: 'Verify at least one game card is rendered',
      },
      {
        action: 'screenshot',
        name: 'initial-load',
        description: 'Capture initial page state',
      },
    ],
  },
  {
    id: 'smoke-header-count',
    name: 'Header shows correct game count',
    description: 'Verify the header displays total game count from API',
    tags: ['smoke'],
    priority: 'high',
    steps: [
      {
        action: 'navigate',
        url: 'http://localhost:5173',
        description: 'Navigate to library page',
      },
      {
        action: 'wait',
        condition: { type: 'selector', selector: '[data-testid="game-count"]', state: 'visible' },
        description: 'Wait for game count to render',
      },
      {
        action: 'wait',
        condition: { type: 'networkIdle' },
        description: 'Wait for API response',
      },
      {
        action: 'assert',
        assertion: {
          type: 'textPresent',
          text: '2,420',
          inSelector: '[data-testid="game-count"]',
        },
        description: 'Verify game count matches expected total (2,420 games)',
      },
    ],
  },
  {
    id: 'smoke-no-errors',
    name: 'Page loads without console errors',
    description: 'Verify no JavaScript errors appear in browser console',
    tags: ['smoke'],
    priority: 'high',
    steps: [
      {
        action: 'navigate',
        url: 'http://localhost:5173',
        description: 'Navigate to library page',
      },
      {
        action: 'wait',
        condition: { type: 'networkIdle' },
        description: 'Wait for page to fully load',
      },
      {
        action: 'assert',
        assertion: { type: 'elementHidden', selector: '[data-testid="error-message"]' },
        description: 'Verify no error message is displayed',
      },
    ],
  },
];
