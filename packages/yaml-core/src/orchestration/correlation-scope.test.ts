import { describe, it, expect } from 'vitest';
import { DefaultCorrelationScope, CorrelationTimeoutError } from './correlation-scope.js';
import { valuePattern, defaultPattern } from '../match.js';

describe('CorrelationScope', () => {
  it('delivers item to awaiting correlation', async () => {
    const scope = new DefaultCorrelationScope<Record<string, unknown>>((item) => item['type']);
    scope.expect('req-1', valuePattern('response'));
    const promise = scope.await('req-1');
    scope.deliver({ type: 'response', data: 42 });
    const result = await promise;
    expect(result).toEqual({ type: 'response', data: 42 });
  });

  it('buffers early arrivals and delivers on await', async () => {
    const scope = new DefaultCorrelationScope<Record<string, unknown>>((item) => item['type']);
    scope.expect('req-1', valuePattern('response'));
    scope.deliver({ type: 'response', data: 'early' });
    const result = await scope.await('req-1');
    expect(result).toEqual({ type: 'response', data: 'early' });
  });

  it('times out when no matching item arrives', async () => {
    const scope = new DefaultCorrelationScope<string>((item) => item);
    scope.expect('req-1', valuePattern('never'));
    await expect(scope.await('req-1', 50)).rejects.toThrow(CorrelationTimeoutError);
  });

  it('does not deliver unmatched items', () => {
    const scope = new DefaultCorrelationScope<string>((item) => item);
    scope.expect('req-1', valuePattern('expected'));
    const matched = scope.deliver('unexpected');
    expect(matched).toBe(false);
  });

  it('matches using default pattern', async () => {
    const scope = new DefaultCorrelationScope<string>((item) => item);
    scope.expect('catch-all', defaultPattern());
    scope.deliver('anything');
    const result = await scope.await('catch-all');
    expect(result).toBe('anything');
  });

  it('handles multiple correlations independently', async () => {
    const scope = new DefaultCorrelationScope<string>((item) => item);
    scope.expect('a', valuePattern('alpha'));
    scope.expect('b', valuePattern('beta'));
    scope.deliver('beta');
    scope.deliver('alpha');
    const [a, b] = await Promise.all([scope.await('a'), scope.await('b')]);
    expect(a).toBe('alpha');
    expect(b).toBe('beta');
  });

  it('evicts expired entries', async () => {
    const scope = new DefaultCorrelationScope<string>((item) => item, { evictionMs: 10 });
    scope.expect('old', valuePattern('stale'));
    scope.deliver('stale');
    await new Promise((r) => setTimeout(r, 20));
    scope.evict();
    await expect(scope.await('old', 10)).rejects.toThrow(/No correlation registered/);
  });

  it('throws on await for unknown correlation id', async () => {
    const scope = new DefaultCorrelationScope<string>((item) => item);
    await expect(scope.await('nonexistent', 10)).rejects.toThrow();
  });
});
