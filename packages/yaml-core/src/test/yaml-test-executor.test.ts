import { describe, it, expect } from 'vitest';
import { YamlTestExecutor } from './yaml-test-executor.js';
import type { TestFile } from './yaml-test-parser.js';
import type { Catalog, CatalogEntry, Action, Result } from '../step/walker.js';
import { stepSuccess, MapServiceRegistry } from '../step/walker.js';

function makeCatalog(entries: Record<string, Action> = {}): Catalog {
  const map = new Map<string, CatalogEntry>();
  for (const [name, action] of Object.entries(entries)) {
    map.set(name, {
      qualifiedName: name,
      definition: { name, inputs: {}, outputs: {} },
      action,
    });
  }
  return {
    resolve: (name: string) => map.get(name),
    availableActions: () => new Set(map.keys()),
  };
}

describe('YamlTestExecutor', () => {
  it('executes a simple passing test', async () => {
    const testFile: TestFile = {
      name: 'simple',
      tests: [{ name: 'passes', steps: [{ assert: 'true' }] }],
    };

    const executor = new YamlTestExecutor(makeCatalog(), new MapServiceRegistry());
    const result = await executor.run(testFile);

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.status).toBe('pass');
    expect(result.results[0]!.name).toBe('passes');
  });

  it('executes a failing test', async () => {
    const testFile: TestFile = {
      name: 'failing',
      tests: [{ name: 'fails', steps: [{ assert: 'false' }] }],
    };

    const executor = new YamlTestExecutor(makeCatalog(), new MapServiceRegistry());
    const result = await executor.run(testFile);

    expect(result.results).toHaveLength(1);
    expect(result.results[0]!.status).toBe('fail');
  });

  it('executes multiple test cases', async () => {
    const testFile: TestFile = {
      name: 'multi',
      tests: [
        { name: 'a', steps: [{ assert: 'true' }] },
        { name: 'b', steps: [{ assert: 'true' }] },
      ],
    };

    const executor = new YamlTestExecutor(makeCatalog(), new MapServiceRegistry());
    const result = await executor.run(testFile);

    expect(result.results).toHaveLength(2);
    expect(result.results.every(r => r.status === 'pass')).toBe(true);
  });

  it('runs setup steps before test', async () => {
    const order: string[] = [];
    const tracker: Action = {
      execute: async (params) => {
        order.push(String(params['_subject']));
        return stepSuccess({});
      },
    };

    const testFile: TestFile = {
      name: 'with-setup',
      setup: [{ track: 'setup' }],
      tests: [{ name: 't', steps: [{ track: 'test' }] }],
    };

    const catalog = makeCatalog({ track: tracker });
    const executor = new YamlTestExecutor(catalog, new MapServiceRegistry());
    await executor.run(testFile);

    expect(order).toEqual(['setup', 'test']);
  });

  it('setup failure aborts the test', async () => {
    const failAction: Action = {
      execute: async () => ({ kind: 'failure', message: 'setup boom' }),
    };

    const testFile: TestFile = {
      name: 'setup-fail',
      setup: [{ fail: 'boom' }],
      tests: [{ name: 't', steps: [{ assert: 'true' }] }],
    };

    const catalog = makeCatalog({ fail: failAction });
    const executor = new YamlTestExecutor(catalog, new MapServiceRegistry());
    const result = await executor.run(testFile);

    expect(result.results[0]!.status).toBe('fail');
    expect(result.results[0]!.message).toContain('Setup failed');
  });

  it('teardown runs even on failure', async () => {
    let teardownRan = false;
    const teardownAction: Action = {
      execute: async () => { teardownRan = true; return stepSuccess({}); },
    };

    const testFile: TestFile = {
      name: 'with-teardown',
      teardown: [{ cleanup: '' }],
      tests: [{ name: 't', steps: [{ assert: 'false' }] }],
    };

    const catalog = makeCatalog({ cleanup: teardownAction });
    const executor = new YamlTestExecutor(catalog, new MapServiceRegistry());
    await executor.run(testFile);

    expect(teardownRan).toBe(true);
  });

  it('reports total duration', async () => {
    const testFile: TestFile = {
      name: 'timed',
      tests: [{ name: 't', steps: [{ assert: 'true' }] }],
    };

    const executor = new YamlTestExecutor(makeCatalog(), new MapServiceRegistry());
    const result = await executor.run(testFile);

    expect(result.totalDuration).toBeGreaterThanOrEqual(0);
    expect(result.results[0]!.duration).toBeGreaterThanOrEqual(0);
  });
});
