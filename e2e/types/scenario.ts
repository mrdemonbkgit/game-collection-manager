/**
 * E2E Test Scenario Type Definitions
 *
 * Defines the structure for test steps and scenarios used by the QA agent.
 */

// ============================================================================
// Step Types
// ============================================================================

export interface BaseStep {
  description: string;
  timeout?: number; // ms, default 10000
}

export interface NavigateStep extends BaseStep {
  action: 'navigate';
  url: string;
}

export interface ClickStep extends BaseStep {
  action: 'click';
  selector: string; // CSS selector, data-testid, or text content
  waitForNavigation?: boolean;
}

export interface TypeStep extends BaseStep {
  action: 'type';
  selector: string;
  text: string;
  clearFirst?: boolean;
}

export interface ScrollStep extends BaseStep {
  action: 'scroll';
  selector?: string; // Element to scroll, or viewport if omitted
  direction: 'up' | 'down';
  amount?: number; // pixels
}

export interface WaitStep extends BaseStep {
  action: 'wait';
  condition:
    | { type: 'selector'; selector: string; state?: 'visible' | 'hidden' }
    | { type: 'text'; text: string }
    | { type: 'networkIdle'; timeout?: number }
    | { type: 'duration'; ms: number };
}

export interface ScreenshotStep extends BaseStep {
  action: 'screenshot';
  name: string; // Will be saved as {scenario}-{name}.png
  fullPage?: boolean;
  selector?: string; // Screenshot specific element
}

export interface AssertStep extends BaseStep {
  action: 'assert';
  assertion:
    | { type: 'elementVisible'; selector: string }
    | { type: 'elementHidden'; selector: string }
    | { type: 'textPresent'; text: string; inSelector?: string }
    | { type: 'textAbsent'; text: string; inSelector?: string }
    | {
        type: 'elementCount';
        selector: string;
        count: number;
        operator?: 'eq' | 'gt' | 'lt' | 'gte' | 'lte';
      }
    | { type: 'urlContains'; substring: string }
    | { type: 'urlEquals'; url: string };
}

export type TestStep =
  | NavigateStep
  | ClickStep
  | TypeStep
  | ScrollStep
  | WaitStep
  | ScreenshotStep
  | AssertStep;

// ============================================================================
// Scenario and Suite Types
// ============================================================================

export interface TestScenario {
  id: string;
  name: string;
  description: string;
  tags?: string[]; // e.g., ['smoke', 'regression', 'grid']
  priority?: 'critical' | 'high' | 'medium' | 'low';
  preconditions?: string[]; // Human-readable preconditions
  steps: TestStep[];
}

export interface TestSuite {
  name: string;
  description: string;
  baseUrl: string;
  scenarios: TestScenario[];
  setup?: TestStep[]; // Run before each scenario
  teardown?: TestStep[]; // Run after each scenario
}
