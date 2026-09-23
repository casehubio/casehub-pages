import type { ScenarioScope } from '@casehubio/yaml-core/orchestration';
import { StepQueue } from './step-queue.js';
import type { OrchestratedStep, OrchestrationBlock, DataTrigger, TimeTrigger } from './types.js';

export interface BindResult {
  queues: StepQueue[];
  triggers: Map<string, DataTrigger | TimeTrigger>;
}

export function bindScenario(
  scenario: { orchestration?: OrchestrationBlock; steps?: OrchestratedStep[]; sections?: Array<{ steps: OrchestratedStep[] }> },
  scope: ScenarioScope,
): BindResult {
  if (scenario.orchestration) {
    bindOrchestrationBlock(scenario.orchestration, scope);
  }

  const allSteps = scenario.sections
    ? scenario.sections.flatMap(s => s.steps)
    : (scenario.steps ?? []);

  const triggers = new Map<string, DataTrigger | TimeTrigger>();
  const mainQueue = new StepQueue('main', []);
  const allQueues: StepQueue[] = [mainQueue];

  buildQueueTree(allSteps as OrchestratedStep[], mainQueue, allQueues, triggers, scope);

  return { queues: allQueues, triggers };
}

function bindOrchestrationBlock(block: OrchestrationBlock, scope: ScenarioScope): void {
  const allNames = [
    ...Object.keys(block.barriers ?? {}),
    ...Object.keys(block.channels ?? {}),
    ...(block.signals ?? []),
    ...Object.keys(block.machines ?? {}),
    ...Object.keys(block.quorums ?? {}),
  ];
  for (const name of allNames) {
    if (name.startsWith('__anon_')) {
      throw new Error(`Orchestration name '${name}' uses reserved '__anon_' prefix`);
    }
  }

  for (const [name, def] of Object.entries(block.barriers ?? {})) {
    scope.latch(name, def.count);
  }
  for (const [name, def] of Object.entries(block.quorums ?? {})) {
    scope.latch(name, def.required);
  }
  for (const [name, def] of Object.entries(block.channels ?? {})) {
    scope.channel(name, def.capacity);
  }
  for (const name of block.signals ?? []) {
    scope.signal(name);
  }
  for (const [name, def] of Object.entries(block.machines ?? {})) {
    scope.stateMachine(name, def.states, def.initial);
  }
}

function buildQueueTree(
  steps: OrchestratedStep[],
  currentQueue: StepQueue,
  allQueues: StepQueue[],
  triggers: Map<string, DataTrigger | TimeTrigger>,
  scope: ScenarioScope,
): void {
  for (const step of steps) {
    if (isOrchestration(step) && step.construct === 'concurrent') {
      for (const [branchName, branchSteps] of Object.entries(step.branches)) {
        const child = new StepQueue(branchName, branchSteps as unknown[], currentQueue);
        allQueues.push(child);
      }
      (currentQueue.steps as unknown[]).push(step);
    } else if (isOrchestration(step) && step.construct === 'trigger') {
      const triggerQueue = new StepQueue(`trigger-${triggers.size}`, (step as any).steps);
      triggerQueue.suspend((step as any).trigger);
      triggers.set(triggerQueue.id, (step as any).trigger);
      allQueues.push(triggerQueue);
    } else {
      if ((step as OrchestratedStep).decorators?.mutex) {
        scope.semaphore(`__anon_mutex_${(step as OrchestratedStep).decorators!.mutex!}`, 1);
      }
      (currentQueue.steps as unknown[]).push(step);
    }
  }
}

function isOrchestration(step: unknown): step is { delivery: 'orchestration'; construct: string; [key: string]: unknown } {
  return (step as any).delivery === 'orchestration';
}
