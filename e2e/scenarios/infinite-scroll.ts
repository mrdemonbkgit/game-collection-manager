/**
 * Infinite Scroll Tests
 *
 * Tests for pagination and infinite scroll functionality.
 * The grid uses react-window for virtualization.
 */

import { TestScenario } from '../types/scenario';

export const infiniteScrollTests: TestScenario[] = [
  {
    id: 'scroll-loads-more',
    name: 'Scrolling loads more games',
    description: 'Verify infinite scroll triggers additional game loading',
    tags: ['scroll', 'regression'],
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
        description: 'Wait for initial batch to load',
      },
      {
        action: 'screenshot',
        name: 'before-scroll',
        description: 'Capture initial state',
      },
      {
        action: 'scroll',
        direction: 'down',
        amount: 2000,
        description: 'Scroll down to trigger load more',
      },
      {
        action: 'wait',
        condition: { type: 'duration', ms: 500 },
        description: 'Wait for scroll to settle',
      },
      {
        action: 'wait',
        condition: { type: 'networkIdle' },
        description: 'Wait for additional games to load',
      },
      {
        action: 'screenshot',
        name: 'after-scroll',
        description: 'Capture state after scrolling',
      },
      // The agent should verify different games are visible after scrolling
      // Due to virtualization, game cards are recycled - visible content changes
    ],
  },
  {
    id: 'scroll-continuous',
    name: 'Multiple scroll loads work',
    description: 'Verify scrolling multiple times continues loading games',
    tags: ['scroll', 'regression'],
    priority: 'medium',
    steps: [
      {
        action: 'navigate',
        url: 'http://localhost:5173',
        description: 'Navigate to library page',
      },
      {
        action: 'wait',
        condition: { type: 'networkIdle' },
        description: 'Wait for initial load',
      },
      {
        action: 'scroll',
        direction: 'down',
        amount: 3000,
        description: 'First scroll',
      },
      {
        action: 'wait',
        condition: { type: 'networkIdle' },
        description: 'Wait for load',
      },
      {
        action: 'scroll',
        direction: 'down',
        amount: 3000,
        description: 'Second scroll',
      },
      {
        action: 'wait',
        condition: { type: 'networkIdle' },
        description: 'Wait for more games',
      },
      {
        action: 'screenshot',
        name: 'after-multiple-scrolls',
        description: 'Capture state after multiple scrolls',
      },
    ],
  },
  {
    id: 'scroll-back-to-top',
    name: 'Scroll back to top shows original games',
    description: 'Verify scrolling back up returns to the beginning of the list',
    tags: ['scroll'],
    priority: 'low',
    steps: [
      {
        action: 'navigate',
        url: 'http://localhost:5173',
        description: 'Navigate to library page',
      },
      {
        action: 'wait',
        condition: { type: 'networkIdle' },
        description: 'Wait for initial load',
      },
      {
        action: 'scroll',
        direction: 'down',
        amount: 5000,
        description: 'Scroll down significantly',
      },
      {
        action: 'wait',
        condition: { type: 'duration', ms: 500 },
        description: 'Wait for scroll',
      },
      {
        action: 'scroll',
        direction: 'up',
        amount: 10000,
        description: 'Scroll back to top',
      },
      {
        action: 'wait',
        condition: { type: 'duration', ms: 500 },
        description: 'Wait for scroll',
      },
      {
        action: 'screenshot',
        name: 'back-to-top',
        description: 'Capture state back at top',
      },
    ],
  },
];
