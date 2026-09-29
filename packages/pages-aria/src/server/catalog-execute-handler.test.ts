import { describe, it, expect } from 'vitest';
import { createCatalogExecuteHandler } from './catalog-execute-handler.js';
import type { StepCatalog, CatalogEntry } from '@casehubio/yaml-core/step';

function mockCatalog(entries: Map<string, CatalogEntry>): StepCatalog {
  return {
    resolve: (name: string) => entries.get(name),
    availableActions: () => new Set(entries.keys()),
  };
}

describe('createCatalogExecuteHandler', () => {
  it('executes a catalog action and returns success', async () => {
    const entry: CatalogEntry = {
      qualifiedName: 'greet',
      definition: { name: 'greet', inputs: {}, outputs: {} },
      action: {
        execute: async (params) => ({
          kind: 'success' as const,
          output: { message: `Hello ${params['name']}` },
          executionMetadata: {},
        }),
      },
    };
    const catalog = mockCatalog(new Map([['greet', entry]]));
    const handler = createCatalogExecuteHandler(catalog);

    const result = await handler({ actionName: 'greet', params: { name: 'World' } });
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.output['message']).toBe('Hello World');
    }
  });

  it('returns failure for unknown action', async () => {
    const catalog = mockCatalog(new Map());
    const handler = createCatalogExecuteHandler(catalog);

    const result = await handler({ actionName: 'unknown', params: {} });
    expect(result.kind).toBe('failure');
    if (result.kind === 'failure') {
      expect(result.message).toContain('unknown');
    }
  });

  it('catches thrown errors and returns failure', async () => {
    const entry: CatalogEntry = {
      qualifiedName: 'boom',
      definition: { name: 'boom', inputs: {}, outputs: {} },
      action: {
        execute: async () => { throw new Error('kaboom'); },
      },
    };
    const catalog = mockCatalog(new Map([['boom', entry]]));
    const handler = createCatalogExecuteHandler(catalog);

    const result = await handler({ actionName: 'boom', params: {} });
    expect(result.kind).toBe('failure');
    if (result.kind === 'failure') {
      expect(result.message).toContain('kaboom');
    }
  });

  it('passes params to the action execute method', async () => {
    let capturedParams: Record<string, unknown> = {};
    const entry: CatalogEntry = {
      qualifiedName: 'capture',
      definition: { name: 'capture', inputs: {}, outputs: {} },
      action: {
        execute: async (params) => {
          capturedParams = params;
          return { kind: 'success' as const, output: {}, executionMetadata: {} };
        },
      },
    };
    const catalog = mockCatalog(new Map([['capture', entry]]));
    const handler = createCatalogExecuteHandler(catalog);

    await handler({ actionName: 'capture', params: { foo: 'bar', count: 42 } });
    expect(capturedParams).toEqual({ foo: 'bar', count: 42 });
  });
});
