import { describe, it, expect } from 'vitest';
import { createAssertPlugin } from './assert-plugin.js';
import { MapServiceRegistry } from '../../step/walker.js';

describe('assert plugin', () => {
  const plugin = createAssertPlugin();
  const services = new MapServiceRegistry();

  it('passes for truthy expression', async () => {
    const result = await plugin.action.execute({ expression: 'true' }, services);
    expect(result.kind).toBe('success');
  });

  it('passes for non-empty string', async () => {
    const result = await plugin.action.execute({ expression: 'hello' }, services);
    expect(result.kind).toBe('success');
  });

  it('fails for empty string', async () => {
    const result = await plugin.action.execute({ expression: '' }, services);
    expect(result.kind).toBe('failure');
    expect(result.failureCategory).toBe('STEP_ACTION_FAILED');
  });

  it('fails for false string', async () => {
    const result = await plugin.action.execute({ expression: 'false' }, services);
    expect(result.kind).toBe('failure');
  });

  it('uses _subject as fallback', async () => {
    const result = await plugin.action.execute({ _subject: 'true' }, services);
    expect(result.kind).toBe('success');
  });

  it('has absorbSiblings false', () => {
    expect(plugin.definition.absorbSiblings).toBeUndefined();
  });
});
