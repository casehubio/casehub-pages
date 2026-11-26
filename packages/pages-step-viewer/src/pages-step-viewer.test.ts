import { describe, it, expect } from 'vitest';
import { StepPositionScanner, type StepLineInfo } from '@casehubio/yaml-core';

const MOCK_INFOS: StepLineInfo[] = [
  { line: 1, endLine: 3, address: '0' },
  { line: 4, endLine: 6, address: '1' },
];

describe('PagesStepViewer syncLine', () => {
  it('syncLine finds correct address for line within a step', () => {
    const info = StepPositionScanner.findByLine(MOCK_INFOS, 2);
    expect(info?.address).toBe('0');
  });

  it('syncLine finds correct address for first line of second step', () => {
    const info = StepPositionScanner.findByLine(MOCK_INFOS, 4);
    expect(info?.address).toBe('1');
  });

  it('syncLine with line outside any step returns undefined', () => {
    const info = StepPositionScanner.findByLine(MOCK_INFOS, 10);
    expect(info).toBeUndefined();
  });

  it('syncLine with empty positionInfos returns undefined', () => {
    const info = StepPositionScanner.findByLine([], 1);
    expect(info).toBeUndefined();
  });
});

describe('PagesStepViewer viewer-select dispatch', () => {
  it('findByAddress maps address to line info', () => {
    const info = StepPositionScanner.findByAddress(MOCK_INFOS, '1');
    expect(info).toEqual({ line: 4, endLine: 6, address: '1' });
  });

  it('findByAddress returns undefined for unknown address', () => {
    const info = StepPositionScanner.findByAddress(MOCK_INFOS, '99');
    expect(info).toBeUndefined();
  });
});
