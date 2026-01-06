/**
 * E2E Test Scenarios Index
 *
 * Exports all test scenarios for the QA agent.
 */

export { smokeTests } from './smoke';
export { libraryGridTests } from './library-grid';
export { infiniteScrollTests } from './infinite-scroll';

import { smokeTests } from './smoke';
import { libraryGridTests } from './library-grid';
import { infiniteScrollTests } from './infinite-scroll';
import { TestScenario } from '../types/scenario';

// All scenarios combined
export const allScenarios: TestScenario[] = [
  ...smokeTests,
  ...libraryGridTests,
  ...infiniteScrollTests,
];

// Helper to get scenarios by tag
export function getScenariosByTag(tag: string): TestScenario[] {
  return allScenarios.filter((s) => s.tags?.includes(tag));
}

// Helper to get scenario by ID
export function getScenarioById(id: string): TestScenario | undefined {
  return allScenarios.find((s) => s.id === id);
}
