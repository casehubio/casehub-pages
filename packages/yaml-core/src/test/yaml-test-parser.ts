export interface TestCase {
  name: string;
  steps: Record<string, unknown>[];
}

export interface TestFile {
  name: string;
  simulate?: Record<string, unknown>;
  setup?: Record<string, unknown>[];
  teardown?: Record<string, unknown>[];
  vars?: Record<string, unknown>;
  params?: Record<string, unknown>;
  tests: TestCase[];
  rawYaml?: string;
}

export class YamlTestParser {
  static parse(raw: Record<string, unknown>, rawYaml?: string): TestFile {
    const name = (raw['name'] as string) ?? 'unnamed';

    if (raw['steps'] && !raw['tests']) {
      return {
        name,
        simulate: raw['simulate'] as Record<string, unknown> | undefined,
        setup: raw['setup'] as Record<string, unknown>[] | undefined,
        teardown: raw['teardown'] as Record<string, unknown>[] | undefined,
        vars: raw['vars'] as Record<string, unknown> | undefined,
        params: raw['params'] as Record<string, unknown> | undefined,
        tests: [{ name, steps: raw['steps'] as Record<string, unknown>[] }],
        rawYaml,
      };
    }

    const rawTests = (raw['tests'] as Record<string, unknown>[]) ?? [];
    const tests = rawTests.map(t => ({
      name: (t['name'] as string) ?? 'unnamed',
      steps: (t['steps'] as Record<string, unknown>[]) ?? [],
    }));

    return {
      name,
      simulate: raw['simulate'] as Record<string, unknown> | undefined,
      setup: raw['setup'] as Record<string, unknown>[] | undefined,
      teardown: raw['teardown'] as Record<string, unknown>[] | undefined,
      vars: raw['vars'] as Record<string, unknown> | undefined,
      params: raw['params'] as Record<string, unknown> | undefined,
      tests,
      rawYaml,
    };
  }
}
