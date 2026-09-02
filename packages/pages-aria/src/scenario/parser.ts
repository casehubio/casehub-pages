import { parse } from 'yaml';
import type { AriaTarget } from '@casehubio/pages-primitives';
import type {
  Scenario, FlatScenario, SectionedScenario,
  ScenarioStep, TutorialMeta, TutorialSection, SectionContent,
} from './types.js';

const ARIA_ACTIONS = new Set([
  'navigate', 'click', 'fill', 'select',
  'expand', 'collapse', 'assert', 'wait',
  'show-markdown',
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

  if (action === 'show-markdown') {
    const body = raw[action] as Record<string, unknown>;
    const step: ScenarioStep = {
      delivery: 'aria',
      name: `show-markdown-${(body.file as string) ?? 'inline'}`,
      action: 'show-markdown',
      state: body,
    };
    if (body.content != null) (step as Record<string, unknown>).value = body.content;
    return step;
  }

  const body = raw[action] as Record<string, unknown>;
  const role = (body.role as string) ?? 'unknown';
  const name = (body.name as string) ?? 'unknown';
  const autoName = `${action}-${role}-${name}`;

  const target: AriaTarget = { role, name };
  if (body.index != null) target.index = body.index as string;
  if (body.within != null) target.within = body.within as AriaTarget;

  const step: ScenarioStep = { delivery: 'aria', name: autoName, action, target };
  if (body.value != null) (step as Record<string, unknown>).value = body.value;
  if (body.state != null) (step as Record<string, unknown>).state = body.state;
  if (body.timeout != null) (step as Record<string, unknown>).timeout = body.timeout;
  return step;
}

function parseSteps(rawSteps: unknown[]): ScenarioStep[] {
  return rawSteps.map((raw: unknown) => {
    const step = raw as Record<string, unknown>;
    if (step.delivery) return step as ScenarioStep;
    return expandAriaShorthand(step);
  });
}

function parseSections(rawSections: unknown[]): TutorialSection[] {
  return rawSections.map((raw: unknown) => {
    const sec = raw as Record<string, unknown>;
    const title = sec.title as string;
    const content = sec.content as SectionContent | undefined;
    const rawSteps = Array.isArray(sec.steps) ? sec.steps : [];
    return { title, content, steps: parseSteps(rawSteps) };
  });
}

export function parseScenario(yamlString: string): Scenario {
  const parsed = parse(yamlString) as Record<string, unknown>;
  if (!parsed.scenario) {
    throw new Error('Invalid scenario: must have "scenario" name');
  }

  const hasSteps = Array.isArray(parsed.steps);
  const hasSections = Array.isArray(parsed.sections);

  if (hasSteps && hasSections) {
    throw new Error('Invalid scenario: "steps" and "sections" are mutually exclusive — use one or the other');
  }
  if (!hasSteps && !hasSections) {
    throw new Error('Invalid scenario: must have "steps" or "sections"');
  }

  const meta = parsed.meta as TutorialMeta | undefined;

  if (hasSections) {
    const result: SectionedScenario = {
      scenario: parsed.scenario as string,
      sections: parseSections(parsed.sections as unknown[]),
    };
    if (meta) result.meta = meta;
    return result;
  }

  const result: FlatScenario = {
    scenario: parsed.scenario as string,
    steps: parseSteps(parsed.steps as unknown[]),
  };
  if (meta) result.meta = meta;
  return result;
}
