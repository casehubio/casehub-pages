import { describe, it, expect } from 'vitest';
import { DefaultConsumerHandle } from './consumer-handle.js';

describe('DefaultConsumerHandle', () => {
  it('starts not stopped', () => {
    const handle = new DefaultConsumerHandle('enricher');
    expect(handle.isStopped()).toBe(false);
    expect(handle.signal.aborted).toBe(false);
  });

  it('stop sets isStopped and aborts signal', () => {
    const handle = new DefaultConsumerHandle('enricher');
    handle.stop();
    expect(handle.isStopped()).toBe(true);
    expect(handle.signal.aborted).toBe(true);
  });

  it('name returns the consumer name', () => {
    const handle = new DefaultConsumerHandle('my-consumer');
    expect(handle.name).toBe('my-consumer');
  });

  it('double stop is a no-op', () => {
    const handle = new DefaultConsumerHandle('test');
    handle.stop();
    handle.stop();
    expect(handle.isStopped()).toBe(true);
  });
});
