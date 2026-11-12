import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';
import { YamlTestDiscovery } from './yaml-test-discovery.js';
import { YamlTestParser } from './yaml-test-parser.js';
import { YamlTestExecutor } from './yaml-test-executor.js';
import type { Catalog, ServiceRegistry } from '../step/walker.js';

export function describeYamlTests(
  dir: string,
  catalog: Catalog,
  services: ServiceRegistry,
): void {
  const files = YamlTestDiscovery.scan(dir);
  const executor = new YamlTestExecutor(catalog, services);

  for (const filePath of files) {
    const rawYaml = readFileSync(filePath, 'utf-8');
    const raw = parseYaml(rawYaml) as Record<string, unknown>;
    const testFile = YamlTestParser.parse(raw, rawYaml);

    describe(testFile.name, () => {
      for (const testCase of testFile.tests) {
        it(testCase.name, async () => {
          const singleFile = { ...testFile, tests: [testCase] };
          const result = await executor.run(singleFile);
          const testResult = result.results[0]!;
          if (testResult.status !== 'pass') {
            throw new Error(testResult.message ?? `Test '${testCase.name}' failed`);
          }
        });
      }
    });
  }
}
