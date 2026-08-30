import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseScenario } from './parser.js';
import { runScenario } from './runner.js';
import { isSectioned } from './types.js';
import type { FlatScenario, SectionedScenario, ScenarioStep } from './types.js';

describe('scenario parser', () => {
  it('parses ARIA shorthand and produces delivery: aria', () => {
    const yaml = `
scenario: test-form
steps:
  - click:
      role: button
      name: Submit
`;
    const scenario = parseScenario(yaml);
    expect(scenario.scenario).toBe('test-form');
    expect(scenario.steps).toHaveLength(1);
    const step = scenario.steps[0];
    expect(step.delivery).toBe('aria');
    expect((step as Extract<ScenarioStep, { delivery: 'aria' }>).action).toBe('click');
    expect((step as Extract<ScenarioStep, { delivery: 'aria' }>).name).toBe('click-button-Submit');
  });

  it('parses scenario with multiple step types', () => {
    const yaml = `
scenario: full-flow
steps:
  - navigate: /login
  - fill:
      role: textbox
      name: Username
      value: alice
  - click:
      role: button
      name: Login
  - assert:
      role: button
      name: Logout
      state:
        aria-hidden: false
`;
    const scenario = parseScenario(yaml);
    expect(scenario.steps).toHaveLength(4);
    expect(scenario.steps.every(s => s.delivery === 'aria')).toBe(true);
  });

  it('parses scenario with within scoping', () => {
    const yaml = `
scenario: scoped-click
steps:
  - click:
      role: button
      name: Delete
      within:
        role: row
        name: "Case #42"
`;
    const scenario = parseScenario(yaml);
    const step = scenario.steps[0] as Extract<ScenarioStep, { delivery: 'aria' }>;
    expect(step.target!.within!.role).toBe('row');
    expect(step.target!.within!.name).toBe('Case #42');
  });

  it('navigate shorthand produces auto-generated name', () => {
    const yaml = `
scenario: nav
steps:
  - navigate: /login
`;
    const scenario = parseScenario(yaml);
    const step = scenario.steps[0] as Extract<ScenarioStep, { delivery: 'aria' }>;
    expect(step.action).toBe('navigate');
    expect(step.name).toBe('navigate-/login');
    expect(step.value).toBe('/login');
  });

  it('parses GraphQL step', () => {
    const yaml = `
scenario: graphql-test
steps:
  - name: inject-chat
    delivery: graphql
    domain: connectors
    operation: injectChat
    params:
      platform: slack
      sender: Alice
`;
    const scenario = parseScenario(yaml);
    expect(scenario.steps).toHaveLength(1);
    const step = scenario.steps[0] as Extract<ScenarioStep, { delivery: 'graphql' }>;
    expect(step.delivery).toBe('graphql');
    expect(step.name).toBe('inject-chat');
    expect(step.domain).toBe('connectors');
    expect(step.operation).toBe('injectChat');
    expect(step.params).toEqual({ platform: 'slack', sender: 'Alice' });
  });

  it('parses GraphQL step with await', () => {
    const yaml = `
scenario: await-test
steps:
  - name: check
    delivery: graphql
    domain: engine
    operation: caseContext
    params:
      caseId: "123"
    await:
      match:
        status: RESOLVED
      timeout: 10000
      interval: 200
`;
    const scenario = parseScenario(yaml);
    const step = scenario.steps[0] as Extract<ScenarioStep, { delivery: 'graphql' }>;
    expect(step.await).toBeDefined();
    expect(step.await!.match).toEqual({ status: 'RESOLVED' });
    expect(step.await!.timeout).toBe(10000);
    expect(step.await!.interval).toBe(200);
  });

  it('parses hybrid scenario with mixed delivery types', () => {
    const yaml = `
scenario: hybrid
steps:
  - navigate: /helpdesk
  - click:
      role: button
      name: Submit
  - name: inject
    delivery: graphql
    domain: connectors
    operation: injectChat
    params:
      sender: Alice
`;
    const scenario = parseScenario(yaml);
    expect(scenario.steps).toHaveLength(3);
    expect(scenario.steps[0].delivery).toBe('aria');
    expect(scenario.steps[1].delivery).toBe('aria');
    expect(scenario.steps[2].delivery).toBe('graphql');
  });

  it('parses simulated step', () => {
    const yaml = `
scenario: simulated-test
steps:
  - name: inject-data
    delivery: simulated
    dataset: helpdesk-tickets
    data:
      op: snapshot
      columns: [id, customer]
`;
    const scenario = parseScenario(yaml);
    const step = scenario.steps[0] as Extract<ScenarioStep, { delivery: 'simulated' }>;
    expect(step.delivery).toBe('simulated');
    expect(step.dataset).toBe('helpdesk-tickets');
    expect(step.data).toEqual({ op: 'snapshot', columns: ['id', 'customer'] });
  });

  it('throws on invalid scenario — missing steps and sections', () => {
    expect(() => parseScenario('scenario: test')).toThrow('must have');
  });

  it('throws on invalid scenario — missing name', () => {
    expect(() => parseScenario('steps: []')).toThrow('must have "scenario"');
  });

  it('throws on unknown step format', () => {
    const yaml = `
scenario: bad
steps:
  - unknown: value
`;
    expect(() => parseScenario(yaml)).toThrow('Unknown step format');
  });
});

describe('scenario runner', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('executes click step', async () => {
    document.body.innerHTML = '<button aria-label="Submit">Submit</button>';
    const handler = vi.fn();
    document.querySelector('button')!.addEventListener('click', handler);

    await runScenario({
      scenario: 'test',
      steps: [{ delivery: 'aria', action: 'click', target: { role: 'button', name: 'Submit' } }],
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('executes fill step', async () => {
    document.body.innerHTML = '<input aria-label="Name" />';

    await runScenario({
      scenario: 'test',
      steps: [{ delivery: 'aria', action: 'fill', target: { role: 'textbox', name: 'Name' }, value: 'Alice' }],
    });

    expect((document.querySelector('input') as HTMLInputElement).value).toBe('Alice');
  });

  it('executes assert step — passes when state matches', async () => {
    document.body.innerHTML = '<button aria-label="Submit" aria-busy="false">Submit</button>';

    await expect(runScenario({
      scenario: 'test',
      steps: [{ delivery: 'aria', action: 'assert', target: { role: 'button', name: 'Submit' }, state: { 'aria-busy': false } }],
    })).resolves.toBeUndefined();
  });

  it('executes assert step — throws when state mismatches', async () => {
    document.body.innerHTML = '<button aria-label="Submit" aria-busy="true">Submit</button>';

    await expect(runScenario({
      scenario: 'test',
      steps: [{ delivery: 'aria', action: 'assert', target: { role: 'button', name: 'Submit' }, state: { 'aria-busy': false } }],
    })).rejects.toThrow('State mismatch');
  });

  it('executes multiple steps in sequence', async () => {
    document.body.innerHTML = `
      <input aria-label="Name" />
      <button aria-label="Submit">Submit</button>
    `;
    const clickHandler = vi.fn();
    document.querySelector('button')!.addEventListener('click', clickHandler);

    await runScenario({
      scenario: 'multi-step',
      steps: [
        { delivery: 'aria', action: 'fill', target: { role: 'textbox', name: 'Name' }, value: 'Bob' },
        { delivery: 'aria', action: 'click', target: { role: 'button', name: 'Submit' } },
      ],
    });

    expect((document.querySelector('input') as HTMLInputElement).value).toBe('Bob');
    expect(clickHandler).toHaveBeenCalledOnce();
  });

  it('executes expand step — dispatches click', async () => {
    document.body.innerHTML = '<div role="group" aria-label="Details" aria-expanded="false">Details</div>';
    const handler = vi.fn();
    document.querySelector('[role="group"]')!.addEventListener('click', handler);

    await runScenario({
      scenario: 'test',
      steps: [{ delivery: 'aria', action: 'expand', target: { role: 'group', name: 'Details' } }],
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('executes collapse step — dispatches click', async () => {
    document.body.innerHTML = '<div role="group" aria-label="Details" aria-expanded="true">Details</div>';
    const handler = vi.fn();
    document.querySelector('[role="group"]')!.addEventListener('click', handler);

    await runScenario({
      scenario: 'test',
      steps: [{ delivery: 'aria', action: 'collapse', target: { role: 'group', name: 'Details' } }],
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('skips non-aria steps without error', async () => {
    await expect(runScenario({
      scenario: 'test',
      steps: [{ delivery: 'graphql', name: 'inject', domain: 'connectors', operation: 'injectChat' }],
    })).resolves.toBeUndefined();
  });
});

describe('parseScenario — sectioned format', () => {
  it('parses sections with inline content', () => {
    const yaml = `
scenario: test-tutorial
meta:
  title: Test
  description: A test tutorial
  area: testing
sections:
  - title: Introduction
    content:
      type: inline
      markdown: "Hello world"
    steps: []
  - title: Demo
    steps:
      - click:
          role: button
          name: Submit
`;
    const result = parseScenario(yaml);
    expect(isSectioned(result)).toBe(true);
    if (!isSectioned(result)) throw new Error('Expected sectioned');
    expect(result.sections).toHaveLength(2);
    expect(result.sections[0].title).toBe('Introduction');
    expect(result.sections[0].content?.type).toBe('inline');
    expect(result.sections[0].content?.markdown).toBe('Hello world');
    expect(result.sections[0].steps).toHaveLength(0);
    expect(result.sections[1].title).toBe('Demo');
    expect(result.sections[1].steps).toHaveLength(1);
    expect(result.meta?.title).toBe('Test');
  });

  it('normalizes missing steps to empty array', () => {
    const yaml = `
scenario: slides-only
sections:
  - title: Slide 1
    content:
      type: inline
      markdown: Just a slide
`;
    const result = parseScenario(yaml);
    if (!isSectioned(result)) throw new Error('Expected sectioned');
    expect(result.sections[0].steps).toEqual([]);
  });

  it('rejects when both steps and sections present', () => {
    const yaml = `
scenario: invalid
steps:
  - click:
      role: button
      name: Test
sections:
  - title: Section 1
    steps: []
`;
    expect(() => parseScenario(yaml)).toThrow('mutually exclusive');
  });

  it('rejects when neither steps nor sections present', () => {
    const yaml = `
scenario: empty
`;
    expect(() => parseScenario(yaml)).toThrow('must have');
  });

  it('parses template content reference', () => {
    const yaml = `
scenario: template-test
sections:
  - title: Slide
    content:
      type: template
      path: content/slide.md
    steps: []
`;
    const result = parseScenario(yaml);
    if (!isSectioned(result)) throw new Error('Expected sectioned');
    expect(result.sections[0].content?.type).toBe('template');
    expect(result.sections[0].content?.path).toBe('content/slide.md');
  });

  it('preserves meta on flat scenarios', () => {
    const yaml = `
scenario: flat-with-meta
meta:
  title: Flat Test
  description: A flat scenario with meta
  area: testing
steps:
  - click:
      role: button
      name: Go
`;
    const result = parseScenario(yaml);
    expect(isSectioned(result)).toBe(false);
    expect(result.meta?.title).toBe('Flat Test');
  });
});

describe('isSectioned type guard', () => {
  it('returns false for flat scenarios', () => {
    const flat: FlatScenario = {
      scenario: 'test',
      steps: [{ delivery: 'aria', action: 'click', target: { role: 'button', name: 'Submit' } }],
    };
    expect(isSectioned(flat)).toBe(false);
  });

  it('returns true for sectioned scenarios', () => {
    const sectioned: SectionedScenario = {
      scenario: 'test',
      sections: [{ title: 'Intro', steps: [] }],
    };
    expect(isSectioned(sectioned)).toBe(true);
  });

  it('preserves meta on both variants', () => {
    const meta = { title: 'T', description: 'D', area: 'a' };
    const flat: FlatScenario = { scenario: 'test', steps: [], meta };
    const sectioned: SectionedScenario = { scenario: 'test', sections: [], meta };
    expect(flat.meta).toEqual(meta);
    expect(sectioned.meta).toEqual(meta);
  });
});
