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

export interface TutorialMeta {
  title: string;
  description: string;
  area: string;
  labels?: string[];
  tags?: string[];
  estimated?: string;
  prerequisites?: string[];
  hero?: { title: string; subtitle?: string; icon?: string };
}

export interface SectionContent {
  type: 'inline' | 'template';
  markdown?: string;
  path?: string;
  section?: string;
}

export interface TutorialSection {
  title: string;
  content?: SectionContent;
  steps: ScenarioStep[];
}

export interface ScenarioBase {
  scenario: string;
  meta?: TutorialMeta;
}

export interface FlatScenario extends ScenarioBase {
  steps: ScenarioStep[];
}

export interface SectionedScenario extends ScenarioBase {
  sections: TutorialSection[];
}

export type Scenario = FlatScenario | SectionedScenario;

export function isSectioned(s: Scenario): s is SectionedScenario {
  return 'sections' in s;
}
