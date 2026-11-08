import { describe, it, expect } from 'vitest';
import { createAssertThatPlugin } from './assert-that-plugin.js';
import { MapServiceRegistry } from '../../step/walker.js';

describe('assertThat plugin', () => {
  const plugin = createAssertThatPlugin();
  const services = new MapServiceRegistry();

  it('has absorbSiblings true', () => {
    expect(plugin.definition.absorbSiblings).toBe(true);
  });

  it('equals — passes on match', async () => {
    const result = await plugin.action.execute({ expression: 'hello', equals: 'hello' }, services);
    expect(result.kind).toBe('success');
  });

  it('equals — fails on mismatch', async () => {
    const result = await plugin.action.execute({ expression: 'hello', equals: 'world' }, services);
    expect(result.kind).toBe('failure');
  });

  it('contains — passes for substring', async () => {
    const result = await plugin.action.execute({ expression: 'hello world', contains: 'world' }, services);
    expect(result.kind).toBe('success');
  });

  it('contains — fails for missing substring', async () => {
    const result = await plugin.action.execute({ expression: 'hello', contains: 'world' }, services);
    expect(result.kind).toBe('failure');
  });

  it('matches — passes for regex match', async () => {
    const result = await plugin.action.execute({ expression: 'hello123', matches: '\\d+' }, services);
    expect(result.kind).toBe('success');
  });

  it('hasSize — checks string length', async () => {
    const result = await plugin.action.execute({ expression: 'abc', hasSize: 3 }, services);
    expect(result.kind).toBe('success');
  });

  it('startsWith — passes', async () => {
    const result = await plugin.action.execute({ expression: 'hello world', startsWith: 'hello' }, services);
    expect(result.kind).toBe('success');
  });

  it('endsWith — passes', async () => {
    const result = await plugin.action.execute({ expression: 'hello world', endsWith: 'world' }, services);
    expect(result.kind).toBe('success');
  });

  it('greaterThan — numeric comparison', async () => {
    const result = await plugin.action.execute({ expression: '10', greaterThan: 5 }, services);
    expect(result.kind).toBe('success');
  });

  it('greaterThanOrEqual — passes on equal', async () => {
    const result = await plugin.action.execute({ expression: '5', greaterThanOrEqual: 5 }, services);
    expect(result.kind).toBe('success');
  });

  it('lessThan — numeric comparison', async () => {
    const result = await plugin.action.execute({ expression: '3', lessThan: 5 }, services);
    expect(result.kind).toBe('success');
  });

  it('not-null — passes for non-null', async () => {
    const result = await plugin.action.execute({ expression: 'value', 'not-null': true }, services);
    expect(result.kind).toBe('success');
  });

  it('not-empty — passes for non-empty string', async () => {
    const result = await plugin.action.execute({ expression: 'value', 'not-empty': true }, services);
    expect(result.kind).toBe('success');
  });

  it('empty — passes for empty string', async () => {
    const result = await plugin.action.execute({ expression: '', empty: true }, services);
    expect(result.kind).toBe('success');
  });

  it('multiple matchers AND-combined — all pass', async () => {
    const result = await plugin.action.execute({
      expression: 'hello',
      startsWith: 'hel',
      endsWith: 'llo',
      hasSize: 5,
    }, services);
    expect(result.kind).toBe('success');
  });

  it('multiple matchers AND-combined — one fails', async () => {
    const result = await plugin.action.execute({
      expression: 'hello',
      startsWith: 'hel',
      hasSize: 10,
    }, services);
    expect(result.kind).toBe('failure');
  });
});
