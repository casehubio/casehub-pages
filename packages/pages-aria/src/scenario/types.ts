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
  orchestration?: OrchestrationBlock;
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

// --- Orchestration types (DES scheduler) ---

import type { RetryDirective, LoopDirective } from '@casehubio/yaml-core/orchestration';

export interface StepDecorators {
  mutex?: string;
  retry?: RetryDirective;
  loop?: LoopDirective;
  when?: string;
  timeout?: string;
  delay?: string;
}

export type OrchestrationConstruct =
  | { delivery: 'orchestration'; construct: 'concurrent'; branches: Record<string, ScenarioStep[]> }
  | { delivery: 'orchestration'; construct: 'signal'; name: string }
  | { delivery: 'orchestration'; construct: 'await'; signal?: string; barrier?: string; timeout?: string }
  | { delivery: 'orchestration'; construct: 'delay'; duration: string }
  | { delivery: 'orchestration'; construct: 'trigger'; trigger: DataTrigger | TimeTrigger; steps: OrchestratedStep[] };

export type OrchestratedStep = (ScenarioStep | OrchestrationConstruct) & {
  name?: string;
  decorators?: StepDecorators;
};

export interface DataTrigger {
  type: 'data';
  channel: string;
  condition?: string;
}

export interface TimeTrigger {
  type: 'time';
  delay: string;
  repeat?: boolean;
  fireTime?: number;
}

export interface StateMachineDefinition {
  initial: string;
  states: string[];
  transitions: Array<{ from: string; to: string; guard?: string }>;
  terminal?: string[];
}

export interface OrchestrationBlock {
  machines?: Record<string, StateMachineDefinition>;
  barriers?: Record<string, { count: number }>;
  quorums?: Record<string, { required: number; of: string[] }>;
  channels?: Record<string, { capacity?: number }>;
  signals?: string[];
}
