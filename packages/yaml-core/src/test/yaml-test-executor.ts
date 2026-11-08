import type { Catalog, CatalogEntry, Result } from '../step/walker.js';
import { Walker, stepSuccess } from '../step/walker.js';
import { StructuralEvaluator } from '../step/structural-evaluator.js';
import type { Context } from '../step/decorator-chain.js';
import { VariableResolver } from '../variable-resolver.js';
import type { VariableSource } from '../types.js';
import { SimulationRuntime } from '../step/simulation-runtime.js';
import { SimulateBlockParser } from './simulate-block-parser.js';
import type { TestFile, TestCase } from './yaml-test-parser.js';
import { TestCatalog } from './plugins/test-catalog.js';
import { DefaultScenarioScope } from '../orchestration/scenario-scope.js';
import type { ServiceRegistry } from '../step/walker.js';
import { MapServiceRegistry } from '../step/walker.js';

export interface TestResult {
  name: string;
  status: 'pass' | 'fail' | 'error';
  message?: string;
  duration: number;
}

export interface TestSuiteResult {
  name: string;
  results: TestResult[];
  totalDuration: number;
}

class CatalogChain implements Catalog {
  constructor(private readonly catalogs: Catalog[]) {}

  resolve(actionName: string): CatalogEntry | undefined {
    for (const c of this.catalogs) {
      const entry = c.resolve(actionName);
      if (entry) return entry;
    }
    return undefined;
  }

  availableActions(): Set<string> {
    const all = new Set<string>();
    for (const c of this.catalogs) {
      for (const a of c.availableActions()) all.add(a);
    }
    return all;
  }
}

export class YamlTestExecutor {
  private readonly catalog: Catalog;
  private readonly services: ServiceRegistry;

  constructor(catalog: Catalog, services: ServiceRegistry) {
    this.catalog = catalog;
    this.services = services;
  }

  async run(testFile: TestFile): Promise<TestSuiteResult> {
    const startTime = Date.now();
    const results: TestResult[] = [];
    const compositeCatalog = new CatalogChain([new TestCatalog(), this.catalog]);

    for (const testCase of testFile.tests) {
      const result = await this.runTestCase(testCase, testFile, compositeCatalog);
      results.push(result);
    }

    return {
      name: testFile.name,
      results,
      totalDuration: Date.now() - startTime,
    };
  }

  private async runTestCase(
    testCase: TestCase, testFile: TestFile, catalog: Catalog,
  ): Promise<TestResult> {
    const startTime = Date.now();
    const runtime = new SimulationRuntime();
    const scope = new DefaultScenarioScope();
    const evaluator = new StructuralEvaluator();

    const testServices = new MapServiceRegistry();
    testServices.register({ name: 'SimulationRuntime' }, runtime);
    testServices.register({ name: 'Catalog' }, catalog);
    testServices.register({ name: 'StructuralEvaluator' }, evaluator);

    try {
      if (testFile.simulate) {
        const config = SimulateBlockParser.parse(testFile.simulate);
        runtime.pushOverlay(config);
      }

      const resolver = this.buildResolver(testFile.vars, testFile.params);
      const context: Context = {
        params: {},
        services: testServices,
        scope,
        stepName: testCase.name,
        resolver,
      };

      testServices.register({ name: 'TestContext' }, context);

      if (testFile.setup) {
        const setupSteps = Walker.resolve(testFile.setup, catalog);
        for (const step of setupSteps) {
          const result = await evaluator.evaluate(step, context);
          if (result.kind === 'failure') {
            return { name: testCase.name, status: 'fail', message: `Setup failed: ${result.message}`, duration: Date.now() - startTime };
          }
        }
      }

      const testSteps = Walker.resolve(testCase.steps, catalog);
      let lastResult: Result = stepSuccess({});
      for (const step of testSteps) {
        lastResult = await evaluator.evaluate(step, context);
        if (lastResult.kind === 'failure') {
          return { name: testCase.name, status: 'fail', message: lastResult.message, duration: Date.now() - startTime };
        }
      }

      return { name: testCase.name, status: 'pass', duration: Date.now() - startTime };
    } catch (e) {
      return {
        name: testCase.name,
        status: 'error',
        message: e instanceof Error ? e.message : String(e),
        duration: Date.now() - startTime,
      };
    } finally {
      if (testFile.teardown) {
        try {
          const teardownSteps = Walker.resolve(testFile.teardown, catalog);
          const teardownCtx: Context = {
            params: {},
            services: testServices,
            scope,
            stepName: `${testCase.name}-teardown`,
            resolver: this.buildResolver(testFile.vars, testFile.params),
          };
          for (const step of teardownSteps) {
            await evaluator.evaluate(step, teardownCtx);
          }
        } catch {
          // teardown errors are swallowed — primary result takes precedence
        }
      }
      runtime.popAll();
    }
  }

  private buildResolver(
    vars?: Record<string, unknown>,
    params?: Record<string, unknown>,
  ): VariableResolver {
    const sources: Record<string, VariableSource> = {};
    if (vars) {
      for (const [prefix, map] of Object.entries(vars)) {
        if (typeof map === 'object' && map !== null) {
          sources[prefix] = (name) => {
            const v = (map as Record<string, unknown>)[name];
            return v !== undefined ? String(v) : undefined;
          };
        }
      }
    }
    if (params) {
      sources['params'] = (name) => {
        const v = params[name];
        return v !== undefined ? String(v) : undefined;
      };
    }
    return new VariableResolver(sources, new Set());
  }
}
