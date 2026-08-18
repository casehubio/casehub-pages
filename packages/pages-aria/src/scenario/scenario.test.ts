import { describe, it, expect, beforeEach, vi } from 'vitest';
import { parseScenario } from './parser.js';
import { runScenario } from './runner.js';

describe('scenario parser', () => {
  it('parses valid YAML scenario', () => {
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
    const step = scenario.steps[0] as { click: { role: string; name: string; within: { role: string; name: string } } };
    expect(step.click.within.role).toBe('row');
    expect(step.click.within.name).toBe('Case #42');
  });

  it('throws on invalid scenario — missing steps', () => {
    expect(() => parseScenario('scenario: test')).toThrow('Invalid scenario');
  });

  it('throws on invalid scenario — missing name', () => {
    expect(() => parseScenario('steps: []')).toThrow('Invalid scenario');
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
      steps: [{ click: { role: 'button', name: 'Submit' } }],
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('executes fill step', async () => {
    document.body.innerHTML = '<input aria-label="Name" />';

    await runScenario({
      scenario: 'test',
      steps: [{ fill: { role: 'textbox', name: 'Name', value: 'Alice' } }],
    });

    expect((document.querySelector('input') as HTMLInputElement).value).toBe('Alice');
  });

  it('executes assert step — passes when state matches', async () => {
    document.body.innerHTML = '<button aria-label="Submit" aria-busy="false">Submit</button>';

    await expect(runScenario({
      scenario: 'test',
      steps: [{ assert: { role: 'button', name: 'Submit', state: { 'aria-busy': false } } }],
    })).resolves.toBeUndefined();
  });

  it('executes assert step — throws when state mismatches', async () => {
    document.body.innerHTML = '<button aria-label="Submit" aria-busy="true">Submit</button>';

    await expect(runScenario({
      scenario: 'test',
      steps: [{ assert: { role: 'button', name: 'Submit', state: { 'aria-busy': false } } }],
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
        { fill: { role: 'textbox', name: 'Name', value: 'Bob' } },
        { click: { role: 'button', name: 'Submit' } },
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
      steps: [{ expand: { role: 'group', name: 'Details' } }],
    });

    expect(handler).toHaveBeenCalledOnce();
  });

  it('executes collapse step — dispatches click', async () => {
    document.body.innerHTML = '<div role="group" aria-label="Details" aria-expanded="true">Details</div>';
    const handler = vi.fn();
    document.querySelector('[role="group"]')!.addEventListener('click', handler);

    await runScenario({
      scenario: 'test',
      steps: [{ collapse: { role: 'group', name: 'Details' } }],
    });

    expect(handler).toHaveBeenCalledOnce();
  });
});
