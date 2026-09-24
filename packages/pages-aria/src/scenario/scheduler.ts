import { DefaultScenarioScope, parseDuration } from '@casehubio/yaml-core/orchestration';
import type { ScenarioScope } from '@casehubio/yaml-core/orchestration';
import { ConditionEvaluator } from '@casehubio/yaml-core/condition';
import type { Scenario, OrchestratedStep, DataTrigger, TimeTrigger, StepDecorators, SectionContent } from './types.js';
import type { LoopDirective } from '@casehubio/yaml-core/orchestration';
import { isSectioned } from './types.js';
import type { ScenarioState, OutlineNode } from '../controller/scenario-connection-controller.js';
import { DefaultVirtualClock } from './virtual-clock.js';
import type { VirtualClock } from './virtual-clock.js';
import { StepQueue } from './step-queue.js';
import type { StepExecutor, ExecutionContext } from './step-executor.js';
import { AriaExecutor } from './step-executor.js';
import { executeStep as ariaExecuteStep } from '../executor/command-executor.js';
import { bindScenario } from './yaml-binder.js';
import type { BindResult } from './yaml-binder.js';
import { evaluateTrigger } from './trigger-evaluator.js';

export interface SchedulerOptions {
  eventTarget: EventTarget;
  contentBase?: string;
  speed?: number;
  startPaused?: boolean;
  executors?: StepExecutor[];
  onComplete?: (scenarioName: string) => void;
}

export interface ScenarioRunner {
  play(): void;
  pause(): void;
  step(): Promise<void>;
  runTo(sectionTitle: string): void;
  setSpeed(multiplier: number): void;
  dispose(): void;

  readonly state: 'idle' | 'playing' | 'paused' | 'done';
  readonly outline: OutlineNode[];
  readonly clock: VirtualClock;

  addEventListener(type: string, handler: EventListener): void;
  removeEventListener(type: string, handler: EventListener): void;
}

type RunnerState = 'idle' | 'playing' | 'paused' | 'done';

export function createScheduler(
  scenario: Scenario,
  options: SchedulerOptions,
): ScenarioRunner {
  const clock = new DefaultVirtualClock();
  const speed = options.speed ?? 1;
  clock.setSpeed(speed);

  let scope: ScenarioScope = new DefaultScenarioScope();
  const conditionEvaluator = new ConditionEvaluator(() => false);
  const builtInAria = new AriaExecutor(ariaExecuteStep as (step: unknown, eventTarget?: EventTarget, speed?: number) => Promise<void>);
  const executors: StepExecutor[] = [...(options.executors ?? []), builtInAria];

  const binding: BindResult = bindScenario(scenario as any, scope);
  let queues = binding.queues;
  const triggers = binding.triggers;

  for (const q of queues) {
    if (q.state === 'ready' && q.isDone()) q.state = 'done';
  }

  let runnerState: RunnerState = options.startPaused ? 'paused' : 'idle';
  let disposed = false;
  let loopRunning = false;
  let resumeResolve: (() => void) | undefined;
  let stepResolve: (() => void) | undefined;
  let steppingMode = false;

  const outline: OutlineNode[] = buildOutline(scenario);
  const totalSteps = countTotalSteps(queues);
  const templates = new Map<number, string>();

  if (isSectioned(scenario) && options.contentBase) {
    resolveTemplates(scenario.sections, options.contentBase, templates);
  }

  function emitState(): void {
    const completedSteps = countCompletedSteps(queues);
    const state: ScenarioState = {
      scenario: scenario.scenario,
      chapter: scenario.meta?.title ?? null,
      section: null,
      step: null,
      paused: runnerState === 'paused',
      speed: clock.speed(),
      progress: totalSteps > 0 ? completedSteps / totalSteps : 1,
      content: null,
      slides: null,
      outline,
    };
    if (runnerState === 'done') state.progress = 1;
    options.eventTarget.dispatchEvent(new CustomEvent('pages-event', {
      detail: { topic: 'scenario:state', payload: state },
    }));
  }

  function emitStepEvent(queue: StepQueue, step: unknown): void {
    options.eventTarget.dispatchEvent(new CustomEvent('pages-event', {
      detail: { topic: 'scenario:step', payload: { queue: queue.id, step, virtualTime: clock.now() } },
    }));
  }

  function emitQueueEvent(queue: StepQueue, reason?: string): void {
    options.eventTarget.dispatchEvent(new CustomEvent('pages-event', {
      detail: { topic: 'scenario:queue', payload: { queueId: queue.id, state: queue.state, reason } },
    }));
  }

  function readyQueues(): StepQueue[] {
    return queues.filter(q => q.state === 'ready' && !q.isDone());
  }

  function blockedQueues(): StepQueue[] {
    return queues.filter(q => q.state === 'blocked');
  }

  function suspendedQueues(): StepQueue[] {
    return queues.filter(q => q.state === 'suspended');
  }

  function hasActiveQueues(): boolean {
    return queues.some(q => q.state === 'ready' || q.state === 'blocked' || q.state === 'suspended');
  }

  function queueStateSnapshot(): string {
    return queues.map(q => `${q.id}:${q.state}:${q.position}`).join(',');
  }

  function earliestWakeTime(): number | undefined {
    let earliest: number | undefined;
    for (const q of blockedQueues()) {
      if (q.wakeTime !== undefined) {
        earliest = earliest === undefined ? q.wakeTime : Math.min(earliest, q.wakeTime);
      }
    }
    for (const q of suspendedQueues()) {
      const trigger = q.trigger as TimeTrigger | undefined;
      if (trigger?.type === 'time' && trigger.fireTime !== undefined) {
        earliest = earliest === undefined ? trigger.fireTime : Math.min(earliest, trigger.fireTime);
      }
    }
    return earliest;
  }

  function resolveParentIfChildrenDone(queue: StepQueue): void {
    if (!queue.parent) return;
    const parent = queue.parent;
    if (parent.state === 'done') return;
    if (parent.children.every(c => c.state === 'done' || c.isDone())) {
      parent.unblock();
      parent.advance();
      if (parent.isDone()) {
        parent.state = 'done';
        resolveParentIfChildrenDone(parent);
      }
    }
  }

  async function dispatchStep(step: OrchestratedStep, queue: StepQueue, context: ExecutionContext): Promise<void> {
    if ((step as any).delivery === 'orchestration') {
      await dispatchOrchestration(step as any, queue, context);
      return;
    }

    const executor = executors.find(e => e.canExecute(step));
    if (!executor) return;
    await executor.execute(step, context);
  }

  async function dispatchOrchestration(
    step: OrchestratedStep & { construct: string; [key: string]: unknown },
    queue: StepQueue,
    _context: ExecutionContext,
  ): Promise<void> {
    switch (step.construct) {
      case 'concurrent': {
        queue.block();
        break;
      }
      case 'signal': {
        scope.signal(step.name as string).signal();
        break;
      }
      case 'await': {
        if (step.signal) {
          const sig = scope.signal(step.signal as string);
          if (sig.isSignalled()) break;
          queue.advance();
          const promise = sig.await();
          queue.block(promise);
          promise.then(() => {
            if (!disposed) {
              queue.unblock();
              if (queue.isDone()) {
                queue.state = 'done';
                resolveParentIfChildrenDone(queue);
              }
            }
          });
          return;
        }
        if (step.barrier) {
          const latch = scope.latch(step.barrier as string, 1);
          latch.countDown();
          if (latch.getCount() <= 0) break;
          queue.advance();
          const promise = latch.await();
          queue.block(promise);
          promise.then(() => {
            if (!disposed) {
              queue.unblock();
              if (queue.isDone()) {
                queue.state = 'done';
                resolveParentIfChildrenDone(queue);
              }
            }
          });
          return;
        }
        break;
      }
      case 'delay': {
        const ms = parseDuration(step.duration as string);
        queue.advance();
        queue.block(undefined, clock.now() + ms);
        return;
      }
    }
  }

  function evaluateLoopContinuation(
    loop: LoopDirective, posKey: string, state: Map<string, number>,
  ): boolean {
    if (loop.type === 'count') {
      const remaining = state.get(posKey) ?? loop.count;
      if (remaining > 1) { state.set(posKey, remaining - 1); return true; }
      return false;
    }
    if (loop.type === 'until') {
      return !conditionEvaluator.evaluate(loop.until);
    }
    if (loop.type === 'count-until') {
      if (conditionEvaluator.evaluate(loop.until)) return false;
      const remaining = state.get(posKey) ?? loop.count;
      if (remaining > 1) { state.set(posKey, remaining - 1); return true; }
      return false;
    }
    return false;
  }

  async function tickLoop(): Promise<void> {
    let staleTicks = 0;
    const retryState = new Map<string, number>();
    const loopState = new Map<string, number>();

    while (hasActiveQueues()) {
      if (disposed) return;

      if (runnerState === 'paused') {
        await new Promise<void>(resolve => { resumeResolve = resolve; });
        if (disposed) return;
      }

      const snapshotBefore = queueStateSnapshot();

      const ready = readyQueues();
      if (ready.length > 0) {
        const context: ExecutionContext = {
          scope,
          clock,
          eventTarget: options.eventTarget,
          speed: clock.speed(),
          conditionEvaluator,
        };

        await Promise.all(ready.map(async (queue) => {
          if (disposed) return;
          const step = queue.currentStep() as OrchestratedStep;
          if (!step) {
            queue.state = 'done';
            resolveParentIfChildrenDone(queue);
            return;
          }

          const decorators = step.decorators;
          const posKey = `${queue.id}:${queue.position}`;

          if (decorators?.when) {
            if (!conditionEvaluator.evaluate(decorators.when)) {
              queue.advance();
              return;
            }
          }

          try {
            await dispatchStep(step, queue, context);
            emitStepEvent(queue, step);

            if (queue.state !== 'ready') {
              emitQueueEvent(queue);
              return;
            }

            let advancePosition = true;
            if (decorators?.loop) {
              if (evaluateLoopContinuation(decorators.loop, posKey, loopState)) {
                advancePosition = false;
                retryState.delete(posKey);
              } else {
                loopState.delete(posKey);
              }
            }

            if (advancePosition) {
              retryState.delete(posKey);
              queue.advance();
            }

            if (decorators?.delay) {
              queue.block(undefined, clock.now() + parseDuration(decorators.delay));
              emitQueueEvent(queue, 'delay');
              return;
            }

            if (advancePosition && queue.isDone()) {
              queue.state = 'done';
              emitQueueEvent(queue);
              resolveParentIfChildrenDone(queue);
            }
          } catch (err) {
            const stepName = (step as { name?: string }).name ?? posKey;
            scope.resultStore().recordFailure(stepName, {
              message: (err as Error).message ?? String(err),
              stepName,
            });
            const retryMax = decorators?.retry?.max ?? 0;
            const retryCount = retryState.get(posKey) ?? 0;
            if (retryCount < retryMax) {
              retryState.set(posKey, retryCount + 1);
            } else {
              retryState.delete(posKey);
              queue.state = 'done';
              emitQueueEvent(queue, 'error');
              options.eventTarget.dispatchEvent(new CustomEvent('pages-event', {
                detail: { topic: 'scenario:state', payload: {
                  scenario: scenario.scenario, chapter: null, section: null,
                  step: stepName, paused: true, speed: clock.speed(),
                  progress: totalSteps > 0 ? countCompletedSteps(queues) / totalSteps : 0,
                  content: null, slides: null,
                  error: { step: stepName, message: (err as Error).message ?? String(err) },
                } },
              }));
            }
          }
        }));

        emitState();
      }

      // Advance virtual time to next wake point
      const nextWake = earliestWakeTime();
      if (nextWake !== undefined && nextWake > clock.now()) {
        const delta = nextWake - clock.now();
        const spd = clock.speed();
        if (spd !== Infinity && delta > 0) {
          await new Promise<void>(r => setTimeout(r, delta / spd));
        }
        clock.advance(delta);
      }
      for (const q of blockedQueues()) {
        if (q.wakeTime !== undefined && q.wakeTime <= clock.now()) {
          q.unblock();
        }
      }

      // Check triggers
      for (const q of suspendedQueues()) {
        if (q.trigger && evaluateTrigger(q.trigger, scope, clock)) {
          q.activate();
        }
      }

      // Deadlock detection
      if (queueStateSnapshot() === snapshotBefore) {
        const hasDataTriggers = suspendedQueues().some(q => (q.trigger as any)?.type === 'data');
        if (!hasDataTriggers) {
          staleTicks++;
          if (staleTicks > 100) {
            runnerState = 'done';
            options.eventTarget.dispatchEvent(new CustomEvent('pages-event', {
              detail: { topic: 'scenario:state', payload: {
                scenario: scenario.scenario, chapter: null, section: null,
                step: null, paused: false, speed: clock.speed(),
                progress: totalSteps > 0 ? countCompletedSteps(queues) / totalSteps : 0,
                content: null, slides: null,
                error: { step: 'scheduler', message: 'Scheduler deadlock: no progress for 100 ticks' },
              } },
            }));
            return;
          }
        }
      } else {
        staleTicks = 0;
      }

      // Stepping mode: pause after one iteration
      if (steppingMode) {
        steppingMode = false;
        runnerState = 'paused';
        emitState();
        if (stepResolve) {
          stepResolve();
          stepResolve = undefined;
        }
      }

      // Yield — in speed=Infinity tests this is just a microtask yield
      await Promise.resolve();
    }

    runnerState = 'done';
    emitState();
    options.onComplete?.(scenario.scenario);
  }

  function startLoop(): void {
    if (loopRunning) return;
    loopRunning = true;
    tickLoop().catch(() => {
      runnerState = 'done';
      emitState();
    }).finally(() => { loopRunning = false; });
  }

  const onCommand = (e: Event) => {
    const { command, speed: spd, label } = (e as CustomEvent).detail;
    switch (command) {
      case 'pause': runner.pause(); break;
      case 'resume': runner.play(); break;
      case 'step': runner.step(); break;
      case 'speed': if (spd != null) runner.setSpeed(spd); break;
      case 'run-to': if (label) runner.runTo(label); break;
    }
  };
  options.eventTarget.addEventListener('scenario-command', onCommand);

  const runner: ScenarioRunner = {
    get state(): RunnerState { return runnerState; },
    get outline(): OutlineNode[] { return outline; },
    get clock(): VirtualClock { return clock; },

    play(): void {
      if (disposed || runnerState === 'done') return;
      runnerState = 'playing';
      emitState();
      if (resumeResolve) {
        resumeResolve();
        resumeResolve = undefined;
      }
      startLoop();
    },

    pause(): void {
      if (disposed || runnerState === 'done') return;
      runnerState = 'paused';
      emitState();
    },

    async step(): Promise<void> {
      if (disposed || runnerState === 'done') return;
      steppingMode = true;
      runnerState = 'playing';
      const promise = new Promise<void>(resolve => { stepResolve = resolve; });
      if (resumeResolve) {
        resumeResolve();
        resumeResolve = undefined;
      }
      startLoop();
      await promise;
    },

    runTo(sectionTitle: string): void {
      if (disposed || !isSectioned(scenario)) return;
      const targetIdx = scenario.sections.findIndex(s => s.title === sectionTitle);
      if (targetIdx < 0) return;

      scope.close();
      scope = new DefaultScenarioScope();
      const remaining = { ...scenario, sections: scenario.sections.slice(targetIdx) } as any;
      const rebind = bindScenario(remaining, scope);
      queues = rebind.queues;

      runnerState = 'paused';
      emitState();
    },

    setSpeed(multiplier: number): void {
      clock.setSpeed(multiplier);
    },

    dispose(): void {
      disposed = true;
      options.eventTarget.removeEventListener('scenario-command', onCommand);
      scope.close();
      queues.length = 0;
      if (resumeResolve) {
        resumeResolve();
        resumeResolve = undefined;
      }
      if (stepResolve) {
        stepResolve();
        stepResolve = undefined;
      }
    },

    addEventListener(type: string, handler: EventListener): void {
      options.eventTarget.addEventListener(type, handler);
    },
    removeEventListener(type: string, handler: EventListener): void {
      options.eventTarget.removeEventListener(type, handler);
    },
  };

  return runner;
}

function buildOutline(scenario: Scenario): OutlineNode[] {
  if (!isSectioned(scenario)) return [];
  return scenario.sections.map((section) => ({
    label: section.title,
    target: null,
    children: section.steps.map(step => ({
      label: (step as { name?: string }).name ?? 'step',
      target: null,
      children: [],
    })),
  }));
}

function countTotalSteps(queues: StepQueue[]): number {
  return queues.reduce((sum, q) => sum + q.steps.length, 0);
}

function countCompletedSteps(queues: StepQueue[]): number {
  return queues.reduce((sum, q) => sum + Math.min(q.position, q.steps.length), 0);
}

function resolveTemplates(
  sections: Array<{ title: string; content?: SectionContent }>,
  contentBase: string,
  templates: Map<number, string>,
): void {
  for (let i = 0; i < sections.length; i++) {
    const content = sections[i].content;
    if (content?.type === 'template' && content.path) {
      fetch(`${contentBase}/${content.path}`)
        .then(resp => resp.ok ? resp.text() : Promise.reject(new Error(`Template fetch failed: ${resp.status}`)))
        .then(text => { templates.set(i, text); })
        .catch(() => {});
    }
  }
}
