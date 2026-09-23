import { parse } from 'yaml';
import type { AriaTarget } from '@casehubio/pages-primitives';
import { parseRetryDirective, parseLoopDirective } from '@casehubio/yaml-core/orchestration';
import type {
  Scenario, FlatScenario, SectionedScenario,
  ScenarioStep, TutorialMeta, TutorialSection, SectionContent,
  OrchestratedStep, StepDecorators, OrchestrationBlock,
} from './types.js';

const ARIA_ACTIONS = new Set([
  'navigate', 'click', 'fill', 'select',
  'expand', 'collapse', 'assert', 'wait',
  'show-markdown', 'spotlight',
  'editor-insert', 'editor-replace', 'editor-delete',
  'editor-set-content', 'editor-cursor',
  'editor-highlight', 'editor-completion',
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

  if (action === 'spotlight') {
    const body = raw[action] as Record<string, unknown>;
    const tgt = body.target as Record<string, unknown> | undefined;
    const target: AriaTarget | undefined = tgt
      ? { role: tgt.role as string, name: tgt.name as string,
          ...(tgt.index != null ? { index: tgt.index as string } : {}),
          ...(tgt.within != null ? { within: tgt.within as AriaTarget } : {}) }
      : undefined;
    const step: ScenarioStep = {
      delivery: 'aria',
      name: `spotlight-${target?.role ?? 'unknown'}-${target?.name ?? 'unknown'}`,
      action: 'spotlight',
      ...(target ? { target } : {}),
    };
    for (const [key, val] of Object.entries(body)) {
      if (key !== 'target' && val != null) {
        (step as Record<string, unknown>)[key] = val;
      }
    }
    return step;
  }

  const body = raw[action] as Record<string, unknown>;
  const role = (body.role as string) ?? 'unknown';
  const name = (body.name as string) ?? 'unknown';
  const autoName = `${action}-${role}-${name}`;

  const target: AriaTarget = { role, name };
  if (body.index != null) target.index = body.index as string;
  if (body.within != null) target.within = body.within as AriaTarget;

  const targetKeys = new Set(['role', 'name', 'index', 'within']);
  const step: ScenarioStep = { delivery: 'aria', name: autoName, action, target };
  for (const [key, val] of Object.entries(body)) {
    if (!targetKeys.has(key) && val != null) {
      (step as Record<string, unknown>)[key] = val;
    }
  }
  return step;
}

const ORCHESTRATION_KEYS = new Set(['concurrent', 'signal', 'await', 'delay', 'trigger']);
const DECORATOR_KEYS = new Set(['mutex', 'retry', 'loop', 'when', 'timeout', 'delay']);
const DELIVERY_KEYS = new Set(['simulated', 'graphql']);

function extractDecorators(raw: Record<string, unknown>): StepDecorators | undefined {
  const decorators: StepDecorators = {};
  let found = false;
  if (raw.mutex != null) { decorators.mutex = raw.mutex as string; found = true; }
  if (raw.retry != null) { decorators.retry = parseRetryDirective(raw.retry); found = true; }
  if (raw.loop != null) { decorators.loop = parseLoopDirective(raw.loop); found = true; }
  if (raw.when != null) { decorators.when = raw.when as string; found = true; }
  if (raw.timeout != null) { decorators.timeout = raw.timeout as string; found = true; }
  if (raw.delay != null) { decorators.delay = raw.delay as string; found = true; }
  return found ? decorators : undefined;
}

function parseOrchestrationStep(raw: Record<string, unknown>): OrchestratedStep | undefined {
  if ('concurrent' in raw) {
    const branches = raw.concurrent as Record<string, unknown[]>;
    const parsed: Record<string, ScenarioStep[]> = {};
    for (const [name, steps] of Object.entries(branches)) {
      parsed[name] = parseSteps(steps);
    }
    return { delivery: 'orchestration', construct: 'concurrent', branches: parsed } as OrchestratedStep;
  }
  if ('signal' in raw) {
    return { delivery: 'orchestration', construct: 'signal', name: raw.signal as string } as OrchestratedStep;
  }
  if ('await' in raw) {
    const body = raw.await as Record<string, unknown>;
    return {
      delivery: 'orchestration', construct: 'await',
      ...(body.signal != null ? { signal: body.signal as string } : {}),
      ...(body.barrier != null ? { barrier: body.barrier as string } : {}),
      ...(body.timeout != null ? { timeout: body.timeout as string } : {}),
    } as OrchestratedStep;
  }
  if ('delay' in raw && !Object.keys(raw).some(k => ARIA_ACTIONS.has(k))) {
    return { delivery: 'orchestration', construct: 'delay', duration: raw.delay as string } as OrchestratedStep;
  }
  if ('trigger' in raw) {
    const trigger = raw.trigger as Record<string, unknown>;
    const innerSteps = Array.isArray(raw.steps) ? parseSteps(raw.steps) : [];
    return {
      delivery: 'orchestration', construct: 'trigger',
      trigger: { type: trigger.type as string, ...trigger },
      steps: innerSteps,
    } as OrchestratedStep;
  }
  return undefined;
}

function parseDeliveryStep(raw: Record<string, unknown>): ScenarioStep | undefined {
  if ('simulated' in raw) {
    const body = raw.simulated as Record<string, unknown>;
    return { delivery: 'simulated', dataset: body.dataset as string, data: body.data as Record<string, unknown> } as ScenarioStep;
  }
  if ('graphql' in raw) {
    const body = raw.graphql as Record<string, unknown>;
    return {
      delivery: 'graphql',
      name: body.name as string,
      domain: body.domain as string,
      operation: body.operation as string,
      ...(body.params != null ? { params: body.params as Record<string, unknown> } : {}),
    } as ScenarioStep;
  }
  return undefined;
}

function parseSteps(rawSteps: unknown[]): OrchestratedStep[] {
  return rawSteps.map((raw: unknown) => {
    const step = raw as Record<string, unknown>;
    if (step.delivery) return step as OrchestratedStep;

    const orch = parseOrchestrationStep(step);
    if (orch) return orch;

    const delivery = parseDeliveryStep(step);
    if (delivery) return delivery as OrchestratedStep;

    const ariaStep = expandAriaShorthand(step) as OrchestratedStep;
    const decorators = extractDecorators(step);
    if (decorators) ariaStep.decorators = decorators;
    return ariaStep;
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

  const orchestration = parsed.orchestration as OrchestrationBlock | undefined;

  if (hasSections) {
    const result: SectionedScenario & { orchestration?: OrchestrationBlock } = {
      scenario: parsed.scenario as string,
      sections: parseSections(parsed.sections as unknown[]),
    };
    if (meta) result.meta = meta;
    if (orchestration) result.orchestration = orchestration;
    return result;
  }

  const result: FlatScenario & { orchestration?: OrchestrationBlock } = {
    scenario: parsed.scenario as string,
    steps: parseSteps(parsed.steps as unknown[]),
  };
  if (meta) result.meta = meta;
  if (orchestration) result.orchestration = orchestration;
  return result;
}
