import { describe, it, expect } from 'vitest';
import { AnnotationMap } from './annotation-map.js';

describe('AnnotationMap', () => {
  it('returns annotations for a step address', () => {
    const map = new AnnotationMap(
      new Map([['0', [{ name: 'Timeout', args: { '0': '5s' } }]]]),
      [],
    );
    expect(map.forStep('0')).toHaveLength(1);
    expect(map.forStep('0')[0]!.name).toBe('Timeout');
    expect(map.forStep('1')).toHaveLength(0);
  });

  it('returns document-level annotations', () => {
    const map = new AnnotationMap(new Map(), [{ name: 'Version', args: { '0': '1.0' } }]);
    expect(map.forDocument('Version')?.args['0']).toBe('1.0');
    expect(map.forDocument('Missing')).toBeUndefined();
  });

  it('checks step annotation existence', () => {
    const map = new AnnotationMap(
      new Map([['0', [{ name: 'Timeout', args: {} }]]]),
      [],
    );
    expect(map.hasStepAnnotation('0', 'Timeout')).toBe(true);
    expect(map.hasStepAnnotation('0', 'Retry')).toBe(false);
    expect(map.hasStepAnnotation('1', 'Timeout')).toBe(false);
  });

  it('returns all document annotations', () => {
    const map = new AnnotationMap(new Map(), [
      { name: 'Version', args: { '0': '1.0' } },
      { name: 'Author', args: { '0': 'test' } },
    ]);
    expect(map.allDocumentAnnotations()).toHaveLength(2);
  });

  it('empty map returns empty results', () => {
    const map = AnnotationMap.empty();
    expect(map.forStep('0')).toHaveLength(0);
    expect(map.forDocument('any')).toBeUndefined();
    expect(map.allDocumentAnnotations()).toHaveLength(0);
  });

  it('supports multiple annotations on same step', () => {
    const map = new AnnotationMap(
      new Map([['0', [
        { name: 'Timeout', args: { '0': '5s' } },
        { name: 'Retry', args: { max: '3' } },
      ]]]),
      [],
    );
    expect(map.forStep('0')).toHaveLength(2);
  });
});
