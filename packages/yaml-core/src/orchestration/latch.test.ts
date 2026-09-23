import { describe, it, expect } from 'vitest';
import { DefaultOrcLatch } from './latch.js';

describe('DefaultOrcLatch', () => {
  it('resolves when count reaches zero', async () => {
    const latch = new DefaultOrcLatch(2);
    const p = latch.await();
    latch.countDown();
    expect(latch.getCount()).toBe(1);
    latch.countDown();
    expect(latch.getCount()).toBe(0);
    await p;
  });

  it('resolves immediately if count is already zero', async () => {
    const latch = new DefaultOrcLatch(0);
    await latch.await();
  });

  it('resolves all waiters at once', async () => {
    const latch = new DefaultOrcLatch(1);
    const results: number[] = [];
    const p1 = latch.await().then(() => results.push(1));
    const p2 = latch.await().then(() => results.push(2));
    latch.countDown();
    await Promise.all([p1, p2]);
    expect(results).toHaveLength(2);
  });

  it('ignores countDown below zero', () => {
    const latch = new DefaultOrcLatch(1);
    latch.countDown();
    latch.countDown();
    expect(latch.getCount()).toBe(0);
  });

  it('timeout returns false when latch not released', async () => {
    const latch = new DefaultOrcLatch(1);
    expect(await latch.await(10)).toBe(false);
  });

  it('timeout returns true when released before expiry', async () => {
    const latch = new DefaultOrcLatch(1);
    const p = latch.await(1000);
    latch.countDown();
    expect(await p).toBe(true);
  });
});
