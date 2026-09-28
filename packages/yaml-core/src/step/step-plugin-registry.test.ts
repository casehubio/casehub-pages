import { describe, it, expect } from 'vitest';
import { StepPluginRegistry } from './step-plugin-registry.js';
import type { PluginRegistration } from './step-plugin-registry.js';
import type { CatalogEntry } from './step-walker.js';

function plugin(name: string): PluginRegistration {
  return {
    name,
    inputs: { x: { type: 'STRING', required: true } },
    outputs: {},
    execute: async () => ({ kind: 'success' as const, output: {}, executionMetadata: {} }),
  };
}

describe('StepPluginRegistry', () => {
  it('register and has', () => {
    const reg = new StepPluginRegistry();
    reg.register(plugin('greet'));
    expect(reg.has('greet')).toBe(true);
    expect(reg.has('missing')).toBe(false);
  });

  it('register duplicate throws', () => {
    const reg = new StepPluginRegistry();
    reg.register(plugin('greet'));
    expect(() => reg.register(plugin('greet'))).toThrow("already registered");
  });

  it('unregister removes plugin', () => {
    const reg = new StepPluginRegistry();
    reg.register(plugin('greet'));
    expect(reg.unregister('greet')).toBe(true);
    expect(reg.has('greet')).toBe(false);
  });

  it('unregister returns false for unknown', () => {
    const reg = new StepPluginRegistry();
    expect(reg.unregister('missing')).toBe(false);
  });

  it('createSource populates catalog entries', () => {
    const reg = new StepPluginRegistry();
    reg.register(plugin('alpha'));
    reg.register(plugin('beta'));
    const src = reg.createSource();
    const entries = new Map<string, CatalogEntry>();
    src.populate(entries);
    expect(entries.has('alpha')).toBe(true);
    expect(entries.has('beta')).toBe(true);
    expect(entries.get('alpha')!.definition.name).toBe('alpha');
  });

  it('createSource respects priority parameter', () => {
    const reg = new StepPluginRegistry();
    const src = reg.createSource(42);
    expect(src.priority).toBe(42);
  });
});
