import { describe, it, expect } from 'vitest';
import { StepPositionScanner } from './step-position-scanner.js';
import type { StepLineInfo } from './step-position-scanner.js';

describe('StepPositionScanner', () => {
  describe('flat steps', () => {
    it('identifies step positions from YAML array items', () => {
      const yaml = '- log: hello\n- rest-request GET /api:\n    body: {}';
      const positions = StepPositionScanner.scan(yaml);
      expect(positions).toHaveLength(2);
      expect(positions[0]).toEqual({ line: 0, endLine: 1, address: '0' });
      expect(positions[1]).toEqual({ line: 1, endLine: 3, address: '1' });
    });

    it('handles indented array items', () => {
      const yaml = 'steps:\n  - log: hello\n  - log: world';
      const positions = StepPositionScanner.scan(yaml);
      expect(positions).toHaveLength(2);
      expect(positions[0]).toEqual({ line: 1, endLine: 2, address: '0' });
      expect(positions[1]).toEqual({ line: 2, endLine: 3, address: '1' });
    });

    it('returns empty for YAML with no array items', () => {
      const yaml = 'name: test\nvars:\n  x: 1';
      const positions = StepPositionScanner.scan(yaml);
      expect(positions).toHaveLength(0);
    });

    it('handles single step', () => {
      const yaml = '- log: hello';
      const positions = StepPositionScanner.scan(yaml);
      expect(positions).toHaveLength(1);
      expect(positions[0]).toEqual({ line: 0, endLine: 1, address: '0' });
    });

    it('skips annotation comment lines between steps', () => {
      const yaml = '- log: hello\n#@Timeout("5s")\n- log: world';
      const positions = StepPositionScanner.scan(yaml);
      expect(positions).toHaveLength(2);
      expect(positions[0]).toEqual({ line: 0, endLine: 2, address: '0' });
      expect(positions[1]).toEqual({ line: 2, endLine: 3, address: '1' });
    });

    it('scans flat steps with multi-line properties', () => {
      const yaml = [
        '- action: step-a',
        '  with:',
        '    key: val',
        '- action: step-b',
        '  with:',
        '    other: val',
      ].join('\n');
      const result = StepPositionScanner.scan(yaml);
      expect(result).toEqual([
        { line: 0, endLine: 3, address: '0' },
        { line: 3, endLine: 6, address: '1' },
      ]);
    });
  });

  describe('nested if-else', () => {
    it('scans if-else with then and else branches', () => {
      const yaml = [
        '- action: step-0',
        '- if: condition',
        '  then:',
        '    - action: then-step-0',
        '    - action: then-step-1',
        '  else:',
        '    - action: else-step-0',
        '- action: step-2',
      ].join('\n');
      const result = StepPositionScanner.scan(yaml);
      expect(result).toEqual([
        { line: 0, endLine: 1, address: '0' },
        { line: 1, endLine: 7, address: '1' },
        { line: 3, endLine: 4, address: '1.then.0' },
        { line: 4, endLine: 5, address: '1.then.1' },
        { line: 6, endLine: 7, address: '1.else.0' },
        { line: 7, endLine: 8, address: '2' },
      ]);
    });
  });

  describe('nested try-catch', () => {
    it('scans try-catch with body and catch blocks', () => {
      const yaml = [
        '- try:',
        '    - action: body-0',
        '    - action: body-1',
        '  catch:',
        '    - action: catch-0',
      ].join('\n');
      const result = StepPositionScanner.scan(yaml);
      expect(result).toEqual([
        { line: 0, endLine: 5, address: '0' },
        { line: 1, endLine: 2, address: '0.body.0' },
        { line: 2, endLine: 3, address: '0.body.1' },
        { line: 4, endLine: 5, address: '0.catch.0' },
      ]);
    });
  });

  describe('nested match', () => {
    it('scans match with cases', () => {
      const yaml = [
        '- match: status',
        '  cases:',
        '    - when: open',
        '      action: handle-open',
        '    - when: closed',
        '      action: handle-closed',
      ].join('\n');
      const result = StepPositionScanner.scan(yaml);
      expect(result).toEqual([
        { line: 0, endLine: 6, address: '0' },
        { line: 3, endLine: 4, address: '0.match.0.0' },
        { line: 5, endLine: 6, address: '0.match.1.0' },
      ]);
    });

    it('scans match with default case', () => {
      const yaml = [
        '- match: status',
        '  cases:',
        '    - when: open',
        '      action: handle-open',
        '    - default:',
        '        - action: fallback',
      ].join('\n');
      const result = StepPositionScanner.scan(yaml);
      expect(result).toEqual([
        { line: 0, endLine: 6, address: '0' },
        { line: 3, endLine: 4, address: '0.match.0.0' },
        { line: 5, endLine: 6, address: '0.match.1.0' },
      ]);
    });
  });

  describe('nested parallel / swim-lane', () => {
    it('scans parallel steps with named lanes', () => {
      const yaml = [
        '- parallel:',
        '    agent:',
        '      - action: agent-step',
        '    reviewer:',
        '      - action: review-step',
      ].join('\n');
      const result = StepPositionScanner.scan(yaml);
      expect(result).toEqual([
        { line: 0, endLine: 5, address: '0' },
        { line: 2, endLine: 3, address: '0.lane.agent.0' },
        { line: 4, endLine: 5, address: '0.lane.reviewer.0' },
      ]);
    });

    it('scans parallel steps with unnamed lanes', () => {
      const yaml = [
        '- parallel:',
        '    - action: step-1',
        '    - action: step-2',
      ].join('\n');
      const result = StepPositionScanner.scan(yaml);
      expect(result).toEqual([
        { line: 0, endLine: 3, address: '0' },
        { line: 1, endLine: 2, address: '0.lane.0.0' },
        { line: 2, endLine: 3, address: '0.lane.1.0' },
      ]);
    });

    it('scans single unnamed lane', () => {
      const yaml = [
        '- parallel:',
        '    - action: only',
      ].join('\n');
      const result = StepPositionScanner.scan(yaml);
      expect(result).toEqual([
        { line: 0, endLine: 2, address: '0' },
        { line: 1, endLine: 2, address: '0.lane.0.0' },
      ]);
    });

    it('scans unnamed lanes with nested control flow', () => {
      const yaml = [
        '- parallel:',
        '    - if: cond',
        '      then:',
        '        - action: deep',
        '    - action: simple',
      ].join('\n');
      const result = StepPositionScanner.scan(yaml);
      expect(result).toEqual([
        { line: 0, endLine: 5, address: '0' },
        { line: 1, endLine: 4, address: '0.lane.0.0' },
        { line: 3, endLine: 4, address: '0.lane.0.0.then.0' },
        { line: 4, endLine: 5, address: '0.lane.1.0' },
      ]);
    });
  });

  describe('nested race', () => {
    it('scans race with two children', () => {
      const yaml = [
        '- race:',
        '    - action: fast',
        '    - action: slow',
      ].join('\n');
      const result = StepPositionScanner.scan(yaml);
      expect(result).toEqual([
        { line: 0, endLine: 3, address: '0' },
        { line: 1, endLine: 2, address: '0.race.0' },
        { line: 2, endLine: 3, address: '0.race.1' },
      ]);
    });

    it('scans single race child', () => {
      const yaml = [
        '- race:',
        '    - action: only',
      ].join('\n');
      const result = StepPositionScanner.scan(yaml);
      expect(result).toEqual([
        { line: 0, endLine: 2, address: '0' },
        { line: 1, endLine: 2, address: '0.race.0' },
      ]);
    });

    it('scans race with nested control flow', () => {
      const yaml = [
        '- race:',
        '    - if: timeout',
        '      then:',
        '        - action: abort',
        '    - action: complete',
      ].join('\n');
      const result = StepPositionScanner.scan(yaml);
      expect(result).toEqual([
        { line: 0, endLine: 5, address: '0' },
        { line: 1, endLine: 4, address: '0.race.0' },
        { line: 3, endLine: 4, address: '0.race.0.then.0' },
        { line: 4, endLine: 5, address: '0.race.1' },
      ]);
    });
  });

  describe('nested select', () => {
    it('scans select with subscribe and wait branches', () => {
      const yaml = [
        '- select:',
        '    - subscribe: events',
        '      action: handle',
        '    - wait: timeout',
        '      action: expire',
      ].join('\n');
      const result = StepPositionScanner.scan(yaml);
      expect(result).toEqual([
        { line: 0, endLine: 5, address: '0' },
        { line: 1, endLine: 3, address: '0.select.events.0' },
        { line: 3, endLine: 5, address: '0.select.timeout.0' },
      ]);
    });

    it('scans single select branch', () => {
      const yaml = [
        '- select:',
        '    - wait: signal',
        '      action: respond',
      ].join('\n');
      const result = StepPositionScanner.scan(yaml);
      expect(result).toEqual([
        { line: 0, endLine: 3, address: '0' },
        { line: 1, endLine: 3, address: '0.select.signal.0' },
      ]);
    });

    it('scans select with nested control flow', () => {
      const yaml = [
        '- select:',
        '    - wait: timeout',
        '      if: expired',
        '      then:',
        '        - action: abort',
        '    - subscribe: events',
        '      action: handle',
      ].join('\n');
      const result = StepPositionScanner.scan(yaml);
      expect(result).toEqual([
        { line: 0, endLine: 7, address: '0' },
        { line: 1, endLine: 5, address: '0.select.timeout.0' },
        { line: 4, endLine: 5, address: '0.select.timeout.0.then.0' },
        { line: 5, endLine: 7, address: '0.select.events.0' },
      ]);
    });

    it('scans select with empty branch', () => {
      const yaml = [
        '- select:',
        '    - wait: sig-a',
        '    - wait: sig-b',
        '      action: handle',
      ].join('\n');
      const result = StepPositionScanner.scan(yaml);
      expect(result).toEqual([
        { line: 0, endLine: 4, address: '0' },
        { line: 1, endLine: 2, address: '0.select.sig-a.0' },
        { line: 2, endLine: 4, address: '0.select.sig-b.0' },
      ]);
    });
  });

  describe('select with object-form subscribe', () => {
    it('extracts channel name from child key', () => {
      const yaml = [
        '- select:',
        '    - subscribe:',
        '        channel: events',
        '      action: handle',
        '    - wait: timeout',
        '      action: expire',
      ].join('\n');
      const result = StepPositionScanner.scan(yaml);
      expect(result).toEqual([
        { line: 0, endLine: 6, address: '0' },
        { line: 1, endLine: 4, address: '0.select.events.0' },
        { line: 4, endLine: 6, address: '0.select.timeout.0' },
      ]);
    });
  });

  describe('deeply nested', () => {
    it('scans if inside try', () => {
      const yaml = [
        '- try:',
        '    - if: cond',
        '      then:',
        '        - action: deep',
        '  catch:',
        '    - action: handler',
      ].join('\n');
      const result = StepPositionScanner.scan(yaml);
      expect(result).toEqual([
        { line: 0, endLine: 6, address: '0' },
        { line: 1, endLine: 4, address: '0.body.0' },
        { line: 3, endLine: 4, address: '0.body.0.then.0' },
        { line: 5, endLine: 6, address: '0.catch.0' },
      ]);
    });
  });

  describe('findByLine', () => {
    it('returns deepest matching step', () => {
      const infos: StepLineInfo[] = [
        { line: 0, endLine: 1, address: '0' },
        { line: 1, endLine: 7, address: '1' },
        { line: 3, endLine: 5, address: '1.then.0' },
      ];
      expect(StepPositionScanner.findByLine(infos, 0)).toEqual(infos[0]);
      expect(StepPositionScanner.findByLine(infos, 3)).toEqual(infos[2]);
      expect(StepPositionScanner.findByLine(infos, 4)).toEqual(infos[2]);
      expect(StepPositionScanner.findByLine(infos, 1)).toEqual(infos[1]);
      expect(StepPositionScanner.findByLine(infos, 6)).toEqual(infos[1]);
      expect(StepPositionScanner.findByLine(infos, 10)).toBeUndefined();
    });
  });

  describe('findByAddress', () => {
    it('returns matching step', () => {
      const infos: StepLineInfo[] = [
        { line: 0, endLine: 1, address: '0' },
        { line: 3, endLine: 5, address: '1.then.0' },
      ];
      expect(StepPositionScanner.findByAddress(infos, '1.then.0')).toEqual(infos[1]);
      expect(StepPositionScanner.findByAddress(infos, '0')).toEqual(infos[0]);
      expect(StepPositionScanner.findByAddress(infos, 'missing')).toBeUndefined();
    });
  });
});
