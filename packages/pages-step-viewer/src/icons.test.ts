import { describe, it, expect } from 'vitest';
import { getActionIcon } from './icons.js';

describe('getActionIcon', () => {
  it('returns icon for known action', () => {
    expect(getActionIcon('click')).toEqual({ symbol: '⊡', colorClass: 'click' });
  });

  it('returns fill icon for fill action', () => {
    expect(getActionIcon('fill')).toEqual({ symbol: '✎', colorClass: 'fill' });
  });

  it('maps select to fill color class', () => {
    expect(getActionIcon('select').colorClass).toBe('fill');
  });

  it('returns default icon for unknown action', () => {
    const icon = getActionIcon('unknown-action');
    expect(icon.symbol).toBe('▸');
    expect(icon.colorClass).toBe('default');
  });

  it('returns navigate icon', () => {
    expect(getActionIcon('navigate')).toEqual({ symbol: '⤳', colorClass: 'nav' });
  });

  it('returns assert icon', () => {
    expect(getActionIcon('assert')).toEqual({ symbol: '✓', colorClass: 'assert' });
  });

  it('returns signal icon', () => {
    expect(getActionIcon('signal')).toEqual({ symbol: '◇', colorClass: 'signal' });
  });

  it('returns await icon', () => {
    expect(getActionIcon('await')).toEqual({ symbol: '◈', colorClass: 'await' });
  });

  it('returns rest-request icon', () => {
    expect(getActionIcon('rest-request')).toEqual({ symbol: '⇄', colorClass: 'rest' });
  });

  it('returns process icon', () => {
    expect(getActionIcon('process')).toEqual({ symbol: '⊞', colorClass: 'process' });
  });

  it('returns agent-invoke icon', () => {
    expect(getActionIcon('agent-invoke')).toEqual({ symbol: '◈', colorClass: 'agent' });
  });

  it('returns mcp icon', () => {
    expect(getActionIcon('mcp')).toEqual({ symbol: '⊛', colorClass: 'mcp' });
  });

  it('returns emit-event icon', () => {
    expect(getActionIcon('emit-event')).toEqual({ symbol: '◇', colorClass: 'event' });
  });

  it('returns verify-simulation icon', () => {
    expect(getActionIcon('verify-simulation')).toEqual({ symbol: '✓', colorClass: 'assert' });
  });
});
