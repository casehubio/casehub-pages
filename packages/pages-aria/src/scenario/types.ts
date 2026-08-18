import type { AriaTarget } from '@casehubio/pages-primitives';

export type ScenarioStep =
  | { navigate: string }
  | { click: AriaTarget }
  | { fill: AriaTarget & { value: string } }
  | { select: AriaTarget & { value: string } }
  | { expand: AriaTarget }
  | { collapse: AriaTarget }
  | { assert: AriaTarget & { state: Record<string, unknown> } }
  | { wait: AriaTarget & { state: Record<string, unknown>; timeout?: number } };

export interface Scenario {
  scenario: string;
  steps: ScenarioStep[];
}
