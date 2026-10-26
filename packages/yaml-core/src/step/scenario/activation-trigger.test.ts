import { describe, it, expect } from 'vitest';
import { parseActivationTriggers } from './activation-trigger.js';

describe('parseActivationTriggers', () => {
  it('parses a cloud-event trigger', () => {
    const raw = [{
      type: 'cloud-event',
      'event-type': 'io.casehub.ras.situation',
      filter: { situationType: 'fraud-detected' },
      'on-retrigger': 'skip',
    }];
    const triggers = parseActivationTriggers(raw);
    expect(triggers).toHaveLength(1);
    expect(triggers[0].type).toBe('cloud-event');
    if (triggers[0].type === 'cloud-event') {
      expect(triggers[0].eventType).toBe('io.casehub.ras.situation');
      expect(triggers[0].filter).toEqual({ situationType: 'fraud-detected' });
      expect(triggers[0].onRetrigger).toBe('skip');
      expect(triggers[0].maxQueued).toBe(10);
    }
  });

  it('parses a scheduled trigger', () => {
    const raw = [{
      type: 'scheduled',
      cron: '0 0 */4 * * ?',
      'on-retrigger': 'queue',
      'max-queued': 3,
    }];
    const triggers = parseActivationTriggers(raw);
    expect(triggers).toHaveLength(1);
    expect(triggers[0].type).toBe('scheduled');
    if (triggers[0].type === 'scheduled') {
      expect(triggers[0].cron).toBe('0 0 */4 * * ?');
      expect(triggers[0].onRetrigger).toBe('queue');
      expect(triggers[0].maxQueued).toBe(3);
    }
  });

  it('defaults onRetrigger to skip and maxQueued to 10', () => {
    const raw = [{
      type: 'cloud-event',
      'event-type': 'io.casehub.test',
    }];
    const triggers = parseActivationTriggers(raw);
    expect(triggers[0].onRetrigger).toBe('skip');
    expect(triggers[0].maxQueued).toBe(10);
  });

  it('returns empty array for undefined input', () => {
    expect(parseActivationTriggers(undefined as any)).toEqual([]);
  });

  it('throws on unknown trigger type', () => {
    expect(() => parseActivationTriggers([{ type: 'webhook' }]))
      .toThrow('Unknown activation trigger type: webhook');
  });
});
