import { describe, it, expect } from 'vitest';
import { FusionPass } from './fusion-pass.js';
import type { PluginStep, InvokeStep, ResolvedStep } from './walker.js';
import type { Definition } from './types.js';
import type { StreamingStepFactory } from './streaming-types.js';

const textFactory: StreamingStepFactory = async function* (_p, input) { for await (const v of input) yield v; };

function streamingDef(inputType: string, outputType: string, inputKey = 'input'): Definition {
  return {
    name: 'action',
    inputs: {},
    outputs: {},
    streamingType: { inputType, outputType, inputKey, factory: textFactory },
  };
}

function plainDef(): Definition {
  return { name: 'action', inputs: {}, outputs: {} };
}

function pluginStep(name: string | null, def: Definition, decorators: Record<string, unknown> = {}): PluginStep {
  return {
    kind: 'plugin', name,
    entry: { qualifiedName: def.name, definition: def, action: { execute: async () => ({ kind: 'success' as const, output: {}, executionMetadata: {} }) } },
    params: {}, decorators, annotations: [],
  };
}

function invokeStep(name: string): InvokeStep {
  return { kind: 'invoke', name, invokeSpec: {}, decorators: {}, annotations: [] };
}

describe('FusionPass', () => {
  it('returns steps unchanged when fewer than 2', () => {
    const steps = [pluginStep('a', streamingDef('text', 'text'))];
    expect(FusionPass.fuse(steps)).toEqual(steps);
  });

  it('returns steps unchanged when no streaming types', () => {
    const steps = [pluginStep('a', plainDef()), pluginStep('b', plainDef())];
    expect(FusionPass.fuse(steps)).toEqual(steps);
  });

  it('fuses two type-compatible consecutive streaming steps', () => {
    const steps = [
      pluginStep('a', streamingDef('text', 'json')),
      pluginStep('b', streamingDef('json', 'text')),
    ];
    const result = FusionPass.fuse(steps);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('fused-pipeline');
    if (result[0].kind === 'fused-pipeline') {
      expect(result[0].stages).toHaveLength(2);
      expect(result[0].name).toBe('b');
      expect(result[0].stages[0].stepName).toBe('a');
      expect(result[0].stages[1].stepName).toBe('b');
    }
  });

  it('fuses three-step chain', () => {
    const steps = [
      pluginStep('a', streamingDef('text', 'json')),
      pluginStep('b', streamingDef('json', 'binary')),
      pluginStep('c', streamingDef('binary', 'text')),
    ];
    const result = FusionPass.fuse(steps);
    expect(result).toHaveLength(1);
    if (result[0].kind === 'fused-pipeline') {
      expect(result[0].stages).toHaveLength(3);
      expect(result[0].name).toBe('c');
    }
  });

  it('breaks chain on type incompatibility', () => {
    const steps = [
      pluginStep('a', streamingDef('text', 'json')),
      pluginStep('b', streamingDef('binary', 'text')),
    ];
    const result = FusionPass.fuse(steps);
    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe('plugin');
    expect(result[1].kind).toBe('plugin');
  });

  it('breaks chain on chain-breaking decorator', () => {
    const steps = [
      pluginStep('a', streamingDef('text', 'json')),
      pluginStep('b', streamingDef('json', 'text'), { forEach: 'items' }),
    ];
    const result = FusionPass.fuse(steps);
    expect(result).toHaveLength(2);
  });

  it('breaks chain on non-PluginStep', () => {
    const steps: ResolvedStep[] = [
      pluginStep('a', streamingDef('text', 'json')),
      invokeStep('inv'),
      pluginStep('b', streamingDef('json', 'text')),
    ];
    const result = FusionPass.fuse(steps);
    expect(result).toHaveLength(3);
  });

  it('does not fuse when mid-chain step is referenced by name', () => {
    const a = pluginStep('a', streamingDef('text', 'json'));
    const b = pluginStep('b', streamingDef('json', 'text'));
    const c = pluginStep('c', plainDef());
    c.params = { ref: '${result.a}' };
    const result = FusionPass.fuse([a, b, c]);
    expect(result).toHaveLength(3);
    expect(result[0].kind).toBe('plugin');
    expect(result[1].kind).toBe('plugin');
  });

  it('handles mixed fusible and non-fusible steps', () => {
    const steps: ResolvedStep[] = [
      pluginStep('a', streamingDef('text', 'json')),
      pluginStep('b', streamingDef('json', 'text')),
      pluginStep('c', plainDef()),
      pluginStep('d', streamingDef('text', 'text')),
    ];
    const result = FusionPass.fuse(steps);
    expect(result).toHaveLength(3);
    expect(result[0].kind).toBe('fused-pipeline');
    expect(result[1].kind).toBe('plugin');
    expect(result[2].kind).toBe('plugin');
  });
});
