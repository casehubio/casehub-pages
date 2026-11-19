import { describe, it, expect } from 'vitest';
import { assignStepAddresses } from './step-click.js';
import type {
  ResolvedStep, PluginStep, IfElseStep, TryCatchFinallyStep,
  MatchStep, ParallelStep, BlockStep, RaceStep, SelectStep,
} from '@casehubio/yaml-core/step';
import type { ResolvedMatchCase, SelectBranch, NamedBranch } from '@casehubio/yaml-core/step';

function plugin(name: string): PluginStep {
  return {
    kind: 'plugin',
    name,
    entry: { qualifiedName: name, definition: {} as never, action: {} as never },
    params: {},
    decorators: {},
    annotations: [],
  };
}

describe('assignStepAddresses', () => {
  it('assigns flat sequential addresses', () => {
    const steps: ResolvedStep[] = [plugin('a'), plugin('b'), plugin('c')];
    const map = assignStepAddresses(steps);
    expect(map.get(steps[0]!)).toBe('0');
    expect(map.get(steps[1]!)).toBe('1');
    expect(map.get(steps[2]!)).toBe('2');
  });

  it('assigns nested addresses for if-else', () => {
    const thenStep = plugin('then-action');
    const elseStep = plugin('else-action');
    const ifStep: IfElseStep = {
      kind: 'if-else',
      name: null,
      condition: 'x > 0',
      thenSteps: [thenStep],
      elseSteps: [elseStep],
      decorators: {},
      annotations: [],
    };
    const map = assignStepAddresses([ifStep]);
    expect(map.get(ifStep)).toBe('0');
    expect(map.get(thenStep)).toBe('0.then.0');
    expect(map.get(elseStep)).toBe('0.else.0');
  });

  it('assigns nested addresses for try-catch-finally', () => {
    const tryStep = plugin('try-action');
    const catchStep = plugin('catch-action');
    const finallyStep = plugin('finally-action');
    const tcf: TryCatchFinallyStep = {
      kind: 'try-catch-finally',
      name: null,
      trySteps: [tryStep],
      catchSteps: [catchStep],
      finallySteps: [finallyStep],
      decorators: {},
      annotations: [],
    };
    const map = assignStepAddresses([tcf]);
    expect(map.get(tcf)).toBe('0');
    expect(map.get(tryStep)).toBe('0.body.0');
    expect(map.get(catchStep)).toBe('0.catch.0');
    expect(map.get(finallyStep)).toBe('0.finally.0');
  });

  it('assigns nested addresses for match with cases', () => {
    const openStep = plugin('handle-open');
    const closedStep = plugin('handle-closed');
    const matchStep: MatchStep = {
      kind: 'match',
      name: null,
      scrutinee: 'status',
      cases: [
        { pattern: { type: 'literal', value: 'open' } as never, guard: null, steps: [openStep] },
        { pattern: { type: 'literal', value: 'closed' } as never, guard: null, steps: [closedStep] },
      ],
      decorators: {},
      annotations: [],
    };
    const map = assignStepAddresses([matchStep]);
    expect(map.get(matchStep)).toBe('0');
    expect(map.get(openStep)).toBe('0.match.0.0');
    expect(map.get(closedStep)).toBe('0.match.1.0');
  });

  it('assigns nested addresses for parallel with named branches', () => {
    const agentStep = plugin('agent-work');
    const reviewStep = plugin('review-work');
    const par: ParallelStep = {
      kind: 'parallel',
      name: null,
      steps: [],
      branches: [
        { name: 'agent', steps: [agentStep] },
        { name: 'reviewer', steps: [reviewStep] },
      ],
      decorators: {},
      annotations: [],
    };
    const map = assignStepAddresses([par]);
    expect(map.get(par)).toBe('0');
    expect(map.get(agentStep)).toBe('0.lane.agent.0');
    expect(map.get(reviewStep)).toBe('0.lane.reviewer.0');
  });

  it('assigns nested addresses for parallel with unnamed steps', () => {
    const s1 = plugin('step-1');
    const s2 = plugin('step-2');
    const par: ParallelStep = {
      kind: 'parallel',
      name: null,
      steps: [s1, s2],
      decorators: {},
      annotations: [],
    };
    const map = assignStepAddresses([par]);
    expect(map.get(par)).toBe('0');
    expect(map.get(s1)).toBe('0.lane.0.0');
    expect(map.get(s2)).toBe('0.lane.1.0');
  });

  it('assigns nested addresses for block steps', () => {
    const inner = plugin('inner');
    const block: BlockStep = {
      kind: 'block',
      name: null,
      steps: [inner],
      decorators: {},
      annotations: [],
    };
    const map = assignStepAddresses([block]);
    expect(map.get(block)).toBe('0');
    expect(map.get(inner)).toBe('0.block.0');
  });

  it('assigns nested addresses for race steps', () => {
    const r1 = plugin('racer-1');
    const r2 = plugin('racer-2');
    const race: RaceStep = {
      kind: 'race',
      name: null,
      steps: [r1, r2],
      decorators: {},
      annotations: [],
    };
    const map = assignStepAddresses([race]);
    expect(map.get(race)).toBe('0');
    expect(map.get(r1)).toBe('0.race.0');
    expect(map.get(r2)).toBe('0.race.1');
  });

  it('assigns nested addresses for select branches', () => {
    const subStep = plugin('sub-action');
    const sel: SelectStep = {
      kind: 'select',
      name: null,
      branches: [
        { type: 'subscribe', name: 'events', steps: [subStep] },
      ],
      decorators: {},
      annotations: [],
    };
    const map = assignStepAddresses([sel]);
    expect(map.get(sel)).toBe('0');
    expect(map.get(subStep)).toBe('0.select.events.0');
  });

  it('handles prefix for nested calls', () => {
    const steps: ResolvedStep[] = [plugin('a')];
    const map = assignStepAddresses(steps, '5.then');
    expect(map.get(steps[0]!)).toBe('5.then.0');
  });
});
