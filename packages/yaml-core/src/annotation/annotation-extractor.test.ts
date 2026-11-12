import { describe, it, expect } from 'vitest';
import { AnnotationExtractor } from './annotation-extractor.js';
import type { ParsedAnnotation } from './annotation-parser.js';
import type { StepLineInfo } from './step-position-scanner.js';

describe('AnnotationExtractor', () => {
  it('assigns annotation between steps to the next step', () => {
    const annotations: ParsedAnnotation[] = [
      { name: 'Timeout', args: { '0': '5s' }, line: 1 },
    ];
    const positions: StepLineInfo[] = [
      { line: 0, address: '0' },
      { line: 2, address: '1' },
    ];
    const map = AnnotationExtractor.extract(annotations, positions);
    expect(map.forStep('1')).toHaveLength(1);
    expect(map.forStep('1')[0]!.name).toBe('Timeout');
    expect(map.forStep('0')).toHaveLength(0);
  });

  it('assigns annotation before first step as document-level', () => {
    const annotations: ParsedAnnotation[] = [
      { name: 'Version', args: { '0': '1.0' }, line: 0 },
    ];
    const positions: StepLineInfo[] = [
      { line: 2, address: '0' },
    ];
    const map = AnnotationExtractor.extract(annotations, positions);
    expect(map.forDocument('Version')).toBeDefined();
    expect(map.forStep('0')).toHaveLength(0);
  });

  it('assigns multiple annotations to the same step', () => {
    const annotations: ParsedAnnotation[] = [
      { name: 'Timeout', args: { '0': '5s' }, line: 1 },
      { name: 'Retry', args: { max: '3' }, line: 2 },
    ];
    const positions: StepLineInfo[] = [
      { line: 0, address: '0' },
      { line: 3, address: '1' },
    ];
    const map = AnnotationExtractor.extract(annotations, positions);
    expect(map.forStep('1')).toHaveLength(2);
  });

  it('handles empty annotations list', () => {
    const positions: StepLineInfo[] = [{ line: 0, address: '0' }];
    const map = AnnotationExtractor.extract([], positions);
    expect(map.forStep('0')).toHaveLength(0);
    expect(map.allDocumentAnnotations()).toHaveLength(0);
  });

  it('handles empty positions list', () => {
    const annotations: ParsedAnnotation[] = [
      { name: 'Version', args: {}, line: 0 },
    ];
    const map = AnnotationExtractor.extract(annotations, []);
    expect(map.allDocumentAnnotations()).toHaveLength(1);
  });

  it('annotation right before step 0 attaches to step 0', () => {
    const annotations: ParsedAnnotation[] = [
      { name: 'Timeout', args: { '0': '5s' }, line: 0 },
    ];
    const positions: StepLineInfo[] = [
      { line: 1, address: '0' },
      { line: 3, address: '1' },
    ];
    const map = AnnotationExtractor.extract(annotations, positions);
    expect(map.forDocument('Timeout')).toBeDefined();
  });

  it('annotation after last step attaches to last step', () => {
    const annotations: ParsedAnnotation[] = [
      { name: 'AfterLast', args: {}, line: 5 },
    ];
    const positions: StepLineInfo[] = [
      { line: 0, address: '0' },
      { line: 2, address: '1' },
    ];
    const map = AnnotationExtractor.extract(annotations, positions);
    expect(map.forStep('1')).toHaveLength(1);
    expect(map.forStep('1')[0]!.name).toBe('AfterLast');
  });
});
