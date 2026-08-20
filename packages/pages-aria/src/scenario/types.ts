import type { AriaTarget } from '@casehubio/pages-primitives';

export interface AwaitCondition {
  match: Record<string, unknown>;
  timeout?: number;
  interval?: number;
}

export type ScenarioStep =
  | { delivery: 'aria'; name?: string; action: string;
      target?: AriaTarget; value?: string;
      state?: Record<string, unknown>; timeout?: number }
  | { delivery: 'graphql'; name: string; domain: string;
      operation: string; params?: Record<string, unknown>;
      await?: AwaitCondition }
  | { delivery: 'simulated'; name?: string; dataset: string;
      data: Record<string, unknown> };

export interface Scenario {
  scenario: string;
  steps: ScenarioStep[];
}
