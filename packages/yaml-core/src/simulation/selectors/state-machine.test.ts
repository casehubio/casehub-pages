import { describe, it, expect } from 'vitest';
import { StateMachineSelector } from './state-machine.js';

describe('StateMachineSelector', () => {
  function twoStateSelector() {
    return new StateMachineSelector('idle', new Map([
      ['idle', new Map([['start', 'running']])],
      ['running', new Map([['stop', 'idle'], ['complete', 'done']])],
    ]));
  }

  it('starts in initial state', () => {
    const s = twoStateSelector();
    expect(s.activePhase()).toBe('idle');
  });

  it('advance transitions to target state', () => {
    const s = twoStateSelector();
    s.advance('start');
    expect(s.activePhase()).toBe('running');
  });

  it('advance with unknown trigger is no-op', () => {
    const s = twoStateSelector();
    s.advance('unknown');
    expect(s.activePhase()).toBe('idle');
  });

  it('advance in terminal state (no transitions) is no-op', () => {
    const s = twoStateSelector();
    s.advance('start');
    s.advance('complete');
    expect(s.activePhase()).toBe('done');
    s.advance('anything');
    expect(s.activePhase()).toBe('done');
  });

  it('reset returns to initial', () => {
    const s = twoStateSelector();
    s.advance('start');
    expect(s.activePhase()).toBe('running');
    s.reset();
    expect(s.activePhase()).toBe('idle');
  });

  it('type returns state-machine', () => {
    expect(twoStateSelector().type()).toBe('state-machine');
  });

  it('onResolved is no-op', () => {
    const s = twoStateSelector();
    s.onResolved();
    expect(s.activePhase()).toBe('idle');
  });
});
