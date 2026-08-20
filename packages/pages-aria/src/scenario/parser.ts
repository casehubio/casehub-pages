import { parse } from 'yaml';
import type { Scenario, ScenarioStep } from './types.js';

const ARIA_ACTIONS = new Set([
  'navigate', 'click', 'fill', 'select',
  'expand', 'collapse', 'assert', 'wait',
]);

function expandAriaShorthand(raw: Record<string, unknown>): ScenarioStep {
  const action = Object.keys(raw).find(k => ARIA_ACTIONS.has(k));
  if (!action) throw new Error(`Unknown step format: ${JSON.stringify(raw)}`);

  if (action === 'navigate') {
    return {
      delivery: 'aria',
      name: `navigate-${raw[action] as string}`,
      action: 'navigate',
      value: raw[action] as string,
    };
  }

  const body = raw[action] as Record<string, unknown>;
  const role = (body.role as string) ?? 'unknown';
  const name = (body.name as string) ?? 'unknown';
  const autoName = `${action}-${role}-${name}`;

  return {
    delivery: 'aria',
    name: autoName,
    action,
    target: { role, name, within: body.within as never },
    value: body.value as string | undefined,
    state: body.state as Record<string, unknown> | undefined,
    timeout: body.timeout as number | undefined,
  };
}

export function parseScenario(yamlString: string): Scenario {
  const parsed = parse(yamlString) as { scenario?: string; steps?: unknown[] };
  if (!parsed.scenario || !Array.isArray(parsed.steps)) {
    throw new Error('Invalid scenario: must have "scenario" name and "steps" array');
  }

  const steps: ScenarioStep[] = parsed.steps.map((raw: unknown) => {
    const step = raw as Record<string, unknown>;
    if (step.delivery) return step as ScenarioStep;
    return expandAriaShorthand(step);
  });

  return { scenario: parsed.scenario, steps };
}
