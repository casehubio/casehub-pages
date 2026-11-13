export interface TestCase {
  name: string;
  steps: Record<string, unknown>[];
}

export interface TestFile {
  name: string;
  simulate?: Record<string, unknown> | undefined;
  setup?: Record<string, unknown>[] | undefined;
  teardown?: Record<string, unknown>[] | undefined;
  vars?: Record<string, unknown> | undefined;
  params?: Record<string, unknown> | undefined;
  tests: TestCase[];
  rawYaml?: string | undefined;
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Preserve the published static facade.
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
