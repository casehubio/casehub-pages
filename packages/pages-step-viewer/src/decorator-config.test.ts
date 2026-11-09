import { describe, it, expect } from 'vitest';
import { nothing } from 'lit';
import { getDecoratorConfig, DECORATOR_CONFIG, renderDecorators } from './decorator-config.js';

describe('DECORATOR_CONFIG', () => {
  it('has entries for all 36 DECORATOR_KEYS', () => {
    const expected = [
      'if', 'on-success', 'on-failure', 'forEach', 'loop',
      'retry', 'timeout', 'delay', 'on-error', 'trigger',
      'transform', 'signal', 'publish', 'transition',
      'semaphore', 'barrier', 'quorum',
      'label', 'target', 'actor', 'when', 'speed', 'content', 'await', 'mode', 'mutex', 'wait',
      'from', 'cancel', 'background',
      'simulation',
      'at', 'on-complete', 'resource', 'priority', 'capture',
    ];
    for (const key of expected) {
      expect(DECORATOR_CONFIG[key], `missing config for '${key}'`).toBeDefined();
    }
  });

  it('each entry has icon, bg, fg, and label function', () => {
    for (const [key, cfg] of Object.entries(DECORATOR_CONFIG)) {
      expect(cfg.icon, `${key}.icon`).toBeTruthy();
      expect(cfg.bg, `${key}.bg`).toMatch(/^\d+,\s*\d+,\s*\d+$/);
      expect(cfg.fg, `${key}.fg`).toMatch(/^#[0-9a-fA-F]{6}$/);
      expect(typeof cfg.label, `${key}.label`).toBe('function');
    }
  });
});

describe('getDecoratorConfig', () => {
  it('returns config for known decorator', () => {
    const cfg = getDecoratorConfig('retry');
    expect(cfg).toBeDefined();
    expect(cfg!.icon).toBe('↻');
  });

  it('returns undefined for unknown decorator', () => {
    expect(getDecoratorConfig('nonexistent')).toBeUndefined();
  });
});

describe('label functions', () => {
  it('retry formats as "retry: N"', () => {
    expect(DECORATOR_CONFIG.retry!.label(3)).toBe('retry: 3');
  });

  it('timeout formats as "Nms"', () => {
    expect(DECORATOR_CONFIG.timeout!.label(5000)).toBe('5000ms');
  });

  it('forEach handles string value', () => {
    expect(DECORATOR_CONFIG.forEach!.label('items')).toBe('items');
  });

  it('forEach handles object value with item and collection', () => {
    expect(DECORATOR_CONFIG.forEach!.label({ item: 'user', collection: 'users' })).toBe('user in users');
  });

  it('publish formats with arrow prefix', () => {
    expect(DECORATOR_CONFIG.publish!.label('channel')).toBe('→ channel');
  });

  it('from formats with arrow prefix', () => {
    expect(DECORATOR_CONFIG.from!.label('source')).toBe('← source');
  });

  it('background has no-arg label', () => {
    expect(DECORATOR_CONFIG.background!.label(true)).toBe('background');
  });

  it('when passes through value', () => {
    expect(DECORATOR_CONFIG.when!.label('${x} > 5')).toBe('${x} > 5');
  });

  it('if passes through value', () => {
    expect(DECORATOR_CONFIG.if!.label('${done}')).toBe('${done}');
  });

  it('cancel formats as "cancel: value"', () => {
    expect(DECORATOR_CONFIG.cancel!.label('timeout')).toBe('cancel: timeout');
  });
});

describe('renderDecorators', () => {
  it('returns nothing for empty decorators', () => {
    expect(renderDecorators({})).toBe(nothing);
  });

  it('returns nothing for undefined', () => {
    expect(renderDecorators(undefined)).toBe(nothing);
  });

  it('returns nothing for decorators with only null values', () => {
    expect(renderDecorators({ retry: null })).toBe(nothing);
  });

  it('skips unknown decorator keys', () => {
    expect(renderDecorators({ unknownThing: 'value' })).toBe(nothing);
  });
});
