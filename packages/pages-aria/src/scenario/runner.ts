import { click, fill, select, expand, collapse, assertState, waitFor } from '../executor/index.js';
import type { Scenario, ScenarioStep } from './types.js';
import type { AriaState } from '@casehubio/pages-primitives';

function toAriaState(state: Record<string, unknown>): Partial<AriaState> {
  const result: Partial<AriaState> = {};
  if ('aria-busy' in state) result.busy = state['aria-busy'] as boolean;
  if ('aria-disabled' in state) result.disabled = state['aria-disabled'] as boolean;
  if ('aria-expanded' in state) result.expanded = state['aria-expanded'] as boolean;
  if ('aria-selected' in state) result.selected = state['aria-selected'] as boolean;
  if ('aria-hidden' in state) result.hidden = state['aria-hidden'] as boolean;
  return result;
}

async function executeStep(step: ScenarioStep): Promise<void> {
  if ('navigate' in step) {
    window.location.href = step.navigate;
    return;
  }
  if ('click' in step) { click(step.click); return; }
  if ('fill' in step) { fill(step.fill, step.fill.value); return; }
  if ('select' in step) { select(step.select, step.select.value); return; }
  if ('expand' in step) { expand(step.expand); return; }
  if ('collapse' in step) { collapse(step.collapse); return; }
  if ('assert' in step) { assertState(step.assert, toAriaState(step.assert.state)); return; }
  if ('wait' in step) {
    await waitFor(step.wait, toAriaState(step.wait.state), step.wait.timeout ?? 5000);
    return;
  }
}

export async function runScenario(scenario: Scenario): Promise<void> {
  for (const step of scenario.steps) {
    await executeStep(step);
  }
}
