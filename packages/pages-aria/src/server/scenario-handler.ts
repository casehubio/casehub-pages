import { click, fill, select, expand, collapse, assertState, waitFor } from '../executor/index.js';
import type { AriaTarget, AriaState } from '@casehubio/pages-primitives';
import type { EventConnection } from '@casehubio/pages-data';

const SCENARIO_TOPIC = 'scenario:exec';

interface CommandPayload {
  id: string;
  action: string;
  target?: AriaTarget;
  value?: string;
  state?: Record<string, unknown>;
  timeout?: number;
}

interface ScenarioCommand {
  action: string;
  target?: AriaTarget;
  value?: string;
  data?: Record<string, unknown>;
  state?: Record<string, unknown>;
  timeout?: number;
}

interface DispatchStep {
  name: string;
  label: string;
  actor?: string;
  commands: ScenarioCommand[];
}

interface DispatchSequence {
  op: 'dispatch-sequence';
  sessionId: string;
  steps: DispatchStep[];
  speed: number;
  paused: boolean;
}

interface ExecutorControl {
  op: 'executor-control';
  sessionId: string;
  command: 'pause' | 'resume' | 'step' | 'speed';
  speed?: number;
}

export interface ScenarioHandler {
  dispose(): void;
}

function toAriaState(state: Record<string, unknown>): Partial<AriaState> {
  const result: Partial<AriaState> = {};
  if ('aria-busy' in state) result.busy = state['aria-busy'] as boolean;
  if ('aria-disabled' in state) result.disabled = state['aria-disabled'] as boolean;
  if ('aria-expanded' in state) result.expanded = state['aria-expanded'] as boolean;
  if ('aria-selected' in state) result.selected = state['aria-selected'] as boolean;
  if ('aria-hidden' in state) result.hidden = state['aria-hidden'] as boolean;
  return result;
}

function sendResult(conn: EventConnection, id: string, ok: boolean, error: string | null): void {
  conn.send({ op: 'command-result', id, ok, error });
}

function sendStepResult(
  conn: EventConnection,
  sessionId: string,
  stepName: string,
  ok: boolean,
  error: string | null,
  result?: Record<string, unknown>,
): void {
  conn.send({
    op: 'step-result',
    id: crypto.randomUUID(),
    sessionId,
    stepName,
    ok,
    error,
    ...(result ? { result } : {}),
  });
}

function executeAriaCommand(cmd: ScenarioCommand): void | Promise<void> {
  const { action, target, value, state, timeout } = cmd;

  switch (action) {
    case 'navigate':
      window.location.href = value!;
      return;
    case 'click':
      click(target!);
      return;
    case 'fill':
      fill(target!, value!);
      return;
    case 'select':
      select(target!, value!);
      return;
    case 'expand':
      expand(target!);
      return;
    case 'collapse':
      collapse(target!);
      return;
    case 'assert':
      assertState(target!, toAriaState(state!));
      return;
    case 'wait':
      return waitFor(target!, toAriaState(state!), timeout ?? 5000);
    case 'ready':
      return;
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

export function createScenarioHandler(
  connection: EventConnection,
  eventTarget: EventTarget,
): ScenarioHandler {
  connection.listen(['scenario:exec']);

  let paused = false;
  let speed = 1.0;
  let sessionId: string | null = null;
  let stepQueue: DispatchStep[] = [];
  let executing = false;
  let resumeResolve: (() => void) | null = null;

  connection.send({
    op: 'executor-register',
    id: crypto.randomUUID(),
    name: 'browser',
    actions: ['navigate', 'click', 'fill', 'select', 'expand', 'collapse', 'assert', 'wait', 'ready'],
  });

  async function executeSequence(): Promise<void> {
    if (executing) return;
    executing = true;

    while (stepQueue.length > 0) {
      if (paused) {
        await new Promise<void>((resolve) => { resumeResolve = resolve; });
        continue;
      }

      const step = stepQueue.shift()!;
      let stepOk = true;
      let stepError: string | null = null;

      console.log(`[scenario-handler] executing step: ${step.name}, commands:`, step.commands?.length);
      for (const cmd of step.commands) {
        try {
          console.log(`[scenario-handler]   cmd: ${cmd.action} target:`, cmd.target, 'value:', cmd.value);
          const result = executeAriaCommand(cmd);
          if (result) await result;
          console.log(`[scenario-handler]   cmd OK`);
        } catch (err) {
          console.error(`[scenario-handler]   cmd FAILED:`, (err as Error).message);
          stepOk = false;
          stepError = (err as Error).message;
          break;
        }
      }

      console.log(`[scenario-handler] step result: ${step.name} ok=${stepOk}`);
      sendStepResult(connection, sessionId!, step.name, stepOk, stepError);

      if (stepQueue.length > 0 && !paused && speed < 1000) {
        const delay = Math.max(10, 1000 / speed);
        await new Promise<void>((resolve) => setTimeout(resolve, delay));
      }
    }

    executing = false;
  }

  function onDispatch(e: Event): void {
    const detail = (e as CustomEvent).detail as DispatchSequence;
    console.log('[scenario-handler] dispatch received:', detail.steps.length, 'steps, paused:', detail.paused);
    detail.steps.forEach((s, i) => console.log(`  step[${i}]: ${s.name}`, s.commands?.map((c: ScenarioCommand) => `${c.action}(${c.target?.name ?? c.value ?? ''})`)));
    sessionId = detail.sessionId;
    paused = detail.paused;
    speed = detail.speed;
    stepQueue.push(...detail.steps);
    void executeSequence();
  }

  function onControl(e: Event): void {
    const detail = (e as CustomEvent).detail as ExecutorControl;
    if (sessionId && detail.sessionId !== sessionId) return;

    switch (detail.command) {
      case 'pause':
        paused = true;
        break;
      case 'resume':
        paused = false;
        if (resumeResolve) {
          resumeResolve();
          resumeResolve = null;
        }
        break;
      case 'step':
        paused = false;
        if (resumeResolve) {
          resumeResolve();
          resumeResolve = null;
        }
        queueMicrotask(() => { paused = true; });
        break;
      case 'speed':
        if (detail.speed !== undefined) speed = detail.speed;
        break;
    }
  }

  function onLegacyEvent(e: Event): void {
    const detail = (e as CustomEvent).detail as { topic?: string; payload?: unknown };
    if (detail?.topic !== SCENARIO_TOPIC) return;

    const cmd = detail.payload as CommandPayload;
    if (!cmd?.id || !cmd?.action) return;

    try {
      const result = executeAriaCommand(cmd);
      if (result) {
        result
          .then(() => sendResult(connection, cmd.id, true, null))
          .catch((err: Error) => sendResult(connection, cmd.id, false, err.message));
      } else {
        sendResult(connection, cmd.id, true, null);
      }
    } catch (err) {
      sendResult(connection, cmd.id, false, (err as Error).message);
    }
  }

  eventTarget.addEventListener('pages-event', onLegacyEvent);
  eventTarget.addEventListener('scenario-dispatch', onDispatch);
  eventTarget.addEventListener('scenario-control', onControl);

  return {
    dispose() {
      eventTarget.removeEventListener('pages-event', onLegacyEvent);
      eventTarget.removeEventListener('scenario-dispatch', onDispatch);
      eventTarget.removeEventListener('scenario-control', onControl);
      connection.unlisten(['scenario:exec']);
      stepQueue = [];
      paused = false;
      if (resumeResolve) {
        resumeResolve();
        resumeResolve = null;
      }
    },
  };
}
