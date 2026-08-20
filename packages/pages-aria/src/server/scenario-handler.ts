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

function executeCommand(cmd: CommandPayload): void | Promise<void> {
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

  function onEvent(e: Event): void {
    const detail = (e as CustomEvent).detail as { topic?: string; payload?: unknown };
    if (detail?.topic !== SCENARIO_TOPIC) return;

    const cmd = detail.payload as CommandPayload;
    if (!cmd?.id || !cmd?.action) return;

    try {
      const result = executeCommand(cmd);
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

  eventTarget.addEventListener('pages-event', onEvent);

  return {
    dispose() {
      eventTarget.removeEventListener('pages-event', onEvent);
      connection.unlisten(['scenario:exec']);
    },
  };
}
