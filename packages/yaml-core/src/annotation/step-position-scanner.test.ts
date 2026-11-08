import { describe, it, expect } from 'vitest';
import { StepPositionScanner } from './step-position-scanner.js';

describe('StepPositionScanner', () => {
  it('identifies step positions from YAML array items', () => {
    const yaml = '- log: hello\n- rest-request GET /api:\n    body: {}';
    const positions = StepPositionScanner.scan(yaml);
    expect(positions).toHaveLength(2);
    expect(positions[0]).toEqual({ line: 0, address: '0' });
    expect(positions[1]).toEqual({ line: 1, address: '1' });
  });

  it('handles indented array items', () => {
    const yaml = 'steps:\n  - log: hello\n  - log: world';
    const positions = StepPositionScanner.scan(yaml);
    expect(positions).toHaveLength(2);
    expect(positions[0]).toEqual({ line: 1, address: '0' });
    expect(positions[1]).toEqual({ line: 2, address: '1' });
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
    expect(positions[0]).toEqual({ line: 0, address: '0' });
  });

  it('skips annotation comment lines between steps', () => {
    const yaml = '- log: hello\n#@Timeout("5s")\n- log: world';
    const positions = StepPositionScanner.scan(yaml);
    expect(positions).toHaveLength(2);
    expect(positions[0]).toEqual({ line: 0, address: '0' });
    expect(positions[1]).toEqual({ line: 2, address: '1' });
  });
});
