/**
 * Library Grid Tests
 *
 * Tests for the game grid display, card rendering, and visual elements.
 */

import { TestScenario } from '../types/scenario';

export const libraryGridTests: TestScenario[] = [
  {
    id: 'grid-card-display',
    name: 'Game cards display correctly',
    description: 'Verify game cards show cover image, title, and Steam badge',
    tags: ['grid', 'regression'],
    priority: 'high',
    steps: [
      {
        action: 'navigate',
        url: 'http://localhost:3000',
        description: 'Navigate to library page',
      },
      {
        action: 'wait',
        condition: { type: 'networkIdle' },
        description: 'Wait for games to load',
      },
      {
        action: 'assert',
        assertion: {
          type: 'elementVisible',
          selector: '[data-testid="game-grid"]',
        },
        description: 'Verify game grid container is visible',
      },
      {
        action: 'assert',
        assertion: {
          type: 'elementVisible',
          selector: '[data-testid="game-card"] img',
        },
        description: 'Verify game cover images are present',
      },
      {
        action: 'assert',
        assertion: {
          type: 'elementVisible',
          selector: '[data-testid="game-card"] h3',
        },
        description: 'Verify game titles are displayed',
      },
      {
        action: 'assert',
        assertion: {
          type: 'elementVisible',
          selector: '[data-testid="game-card"] svg',
        },
        description: 'Verify platform badges (Steam icon) are shown',
      },
      {
        action: 'screenshot',
        name: 'game-cards',
        description: 'Capture game cards display',
      },
    ],
  },
  {
    id: 'grid-multiple-cards',
    name: 'Multiple game cards render in grid',
    description: 'Verify multiple cards are visible in the grid layout',
    tags: ['grid', 'regression'],
    priority: 'medium',
    steps: [
      {
        action: 'navigate',
        url: 'http://localhost:3000',
        description: 'Navigate to library page',
      },
      {
        action: 'wait',
        condition: { type: 'networkIdle' },
        description: 'Wait for games to load',
      },
      {
        action: 'assert',
        assertion: {
          type: 'elementCount',
          selector: '[data-testid="game-card"]',
          count: 10,
          operator: 'gte',
        },
        description: 'Verify at least 10 game cards are visible (first batch)',
      },
    ],
  },
  {
    id: 'grid-hover-state',
    name: 'Game card hover effects work',
    description: 'Verify hover state changes on game cards',
    tags: ['grid', 'visual'],
    priority: 'low',
    steps: [
      {
        action: 'navigate',
        url: 'http://localhost:3000',
        description: 'Navigate to library page',
      },
      {
        action: 'wait',
        condition: { type: 'networkIdle' },
        description: 'Wait for games to load',
      },
      {
        action: 'screenshot',
        name: 'card-before-hover',
        selector: '[data-testid="game-card"]:first-child',
        description: 'Capture first card before hover',
      },
      // Note: Hover testing requires mouse interaction
      // The QA agent should move mouse over first card and verify visual change
    ],
  },
];
