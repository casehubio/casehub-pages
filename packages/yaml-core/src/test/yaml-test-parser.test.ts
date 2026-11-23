import { describe, it, expect } from 'vitest';
import { YamlTestParser } from './yaml-test-parser.js';

describe('YamlTestParser', () => {
  it('parses multi-test file', () => {
    const raw = {
      name: 'suite',
      tests: [
        { name: 'test-1', steps: [{ log: 'hello' }] },
        { name: 'test-2', steps: [{ log: 'world' }] },
      ],
    };
    const result = YamlTestParser.parse(raw);
    expect(result.name).toBe('suite');
    expect(result.tests).toHaveLength(2);
    expect(result.tests[0]!.name).toBe('test-1');
    expect(result.tests[1]!.name).toBe('test-2');
  });

  it('parses single-test shorthand', () => {
    const raw = {
      name: 'single',
      steps: [{ log: 'hello' }],
    };
    const result = YamlTestParser.parse(raw);
    expect(result.tests).toHaveLength(1);
    expect(result.tests[0]!.name).toBe('single');
    expect(result.tests[0]!.steps).toEqual([{ log: 'hello' }]);
  });

  it('defaults name to unnamed', () => {
    const raw = { steps: [{ log: 'x' }] };
    const result = YamlTestParser.parse(raw);
    expect(result.name).toBe('unnamed');
  });

  it('parses all optional fields', () => {
    const raw = {
      name: 'full',
      simulate: { agent: { strategy: 'sequential' } },
      setup: [{ log: 'setup' }],
      teardown: [{ log: 'teardown' }],
      vars: { api: { baseUrl: 'http://localhost' } },
      params: { count: 5 },
      tests: [{ name: 't', steps: [] }],
    };
    const result = YamlTestParser.parse(raw);
    expect(result.simulate).toBeDefined();
    expect(result.setup).toHaveLength(1);
    expect(result.teardown).toHaveLength(1);
    expect(result.vars).toBeDefined();
    expect(result.params).toBeDefined();
  });

  it('handles empty tests array', () => {
    const raw = { name: 'empty' };
    const result = YamlTestParser.parse(raw);
    expect(result.tests).toHaveLength(0);
  });

  it('preserves rawYaml when provided', () => {
    const yaml = 'name: test\nsteps:\n  - log: hello';
    const raw = { name: 'test', steps: [{ log: 'hello' }] };
    const result = YamlTestParser.parse(raw, yaml);
    expect(result.rawYaml).toBe(yaml);
  });

  it('parses per-test simulate block', () => {
    const raw = {
      name: 'suite',
      simulate: { agent: { strategy: 'sequential', corpus: [] } },
      tests: [
        { name: 'test1', steps: [] },
        { name: 'test2', simulate: { agent: { strategy: 'key-lookup', corpus: [] } }, steps: [] },
      ],
    };
    const result = YamlTestParser.parse(raw);
    expect(result.tests[0]!.simulate).toBeUndefined();
    expect(result.tests[1]!.simulate).toBeDefined();
    expect(result.tests[1]!.simulate!['agent']).toEqual({ strategy: 'key-lookup', corpus: [] });
  });

  it('single-test shorthand does not expose per-test simulate', () => {
    const raw = { name: 'single', steps: [{ log: 'x' }] };
    const result = YamlTestParser.parse(raw);
    expect(result.tests[0]!.simulate).toBeUndefined();
  });

  describe('parseRaw — multi-document YAML', () => {
    it('parses multi-document format (metadata + bare step list)', () => {
      const yaml = 'name: multi-doc\n---\n- log: hello\n- assert: "true"\n';
      const result = YamlTestParser.parseRaw(yaml);
      expect(result.name).toBe('multi-doc');
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0]!.steps).toEqual([{ log: 'hello' }, { assert: 'true' }]);
    });

    it('carries metadata fields through multi-document parse', () => {
      const yaml = 'name: full\nsimulate:\n  agent:\n    strategy: sequential\nvars:\n  x: 1\n---\n- log: hello\n';
      const result = YamlTestParser.parseRaw(yaml);
      expect(result.name).toBe('full');
      expect(result.simulate).toEqual({ agent: { strategy: 'sequential' } });
      expect(result.vars).toEqual({ x: 1 });
    });

    it('falls back to single-document parse for old format', () => {
      const yaml = 'name: old\ntests:\n  - name: t1\n    steps:\n      - log: hello\n';
      const result = YamlTestParser.parseRaw(yaml);
      expect(result.name).toBe('old');
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0]!.name).toBe('t1');
    });

    it('falls back to single-document parse for steps shorthand', () => {
      const yaml = 'name: short\nsteps:\n  - log: hello\n';
      const result = YamlTestParser.parseRaw(yaml);
      expect(result.tests).toHaveLength(1);
      expect(result.tests[0]!.steps).toEqual([{ log: 'hello' }]);
    });

    it('preserves rawYaml in multi-document parse', () => {
      const yaml = 'name: raw\n---\n- log: hello\n';
      const result = YamlTestParser.parseRaw(yaml);
      expect(result.rawYaml).toBe(yaml);
    });
  });
});
