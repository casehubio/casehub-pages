import { describe, it, expect } from 'vitest';
import { DecoratorAnnotationResolver } from './decorator-annotation-resolver.js';
import type { Annotation } from './annotation-map.js';

describe('DecoratorAnnotationResolver', () => {
  it('merges @Timeout annotation', () => {
    const annotations: Annotation[] = [{ name: 'Timeout', args: { '0': '5s' } }];
    const merged = DecoratorAnnotationResolver.mergeDecorators(annotations, {});
    expect(merged['timeout']).toBe('5s');
  });

  it('inline decorator takes precedence over annotation', () => {
    const annotations: Annotation[] = [{ name: 'Timeout', args: { '0': '5s' } }];
    const merged = DecoratorAnnotationResolver.mergeDecorators(annotations, { timeout: '10s' });
    expect(merged['timeout']).toBe('10s');
  });

  it('merges @Retry with max only', () => {
    const annotations: Annotation[] = [{ name: 'Retry', args: { max: '3' } }];
    const merged = DecoratorAnnotationResolver.mergeDecorators(annotations, {});
    expect(merged['retry']).toBe(3);
  });

  it('merges @Retry with max and backoff', () => {
    const annotations: Annotation[] = [{ name: 'Retry', args: { max: '3', backoff: 'exponential' } }];
    const merged = DecoratorAnnotationResolver.mergeDecorators(annotations, {});
    expect(merged['retry']).toEqual({ max: 3, backoff: 'exponential' });
  });

  it('merges @Delay', () => {
    const annotations: Annotation[] = [{ name: 'Delay', args: { '0': '1s' } }];
    const merged = DecoratorAnnotationResolver.mergeDecorators(annotations, {});
    expect(merged['delay']).toBe('1s');
  });

  it('merges @Priority', () => {
    const annotations: Annotation[] = [{ name: 'Priority', args: { '0': 'HIGH' } }];
    const merged = DecoratorAnnotationResolver.mergeDecorators(annotations, {});
    expect(merged['priority']).toBe('HIGH');
  });

  it('merges @Resource', () => {
    const annotations: Annotation[] = [{ name: 'Resource', args: { '0': 'pool-name' } }];
    const merged = DecoratorAnnotationResolver.mergeDecorators(annotations, {});
    expect(merged['resource']).toBe('pool-name');
  });

  it('merges @Background (no args)', () => {
    const annotations: Annotation[] = [{ name: 'Background', args: {} }];
    const merged = DecoratorAnnotationResolver.mergeDecorators(annotations, {});
    expect(merged['background']).toBe(true);
  });

  it('merges @OnError', () => {
    const annotations: Annotation[] = [{ name: 'OnError', args: { '0': 'fallback' } }];
    const merged = DecoratorAnnotationResolver.mergeDecorators(annotations, {});
    expect(merged['on-error']).toBe('fallback');
  });

  it('merges @Semaphore', () => {
    const annotations: Annotation[] = [{ name: 'Semaphore', args: { '0': 'sem-1' } }];
    const merged = DecoratorAnnotationResolver.mergeDecorators(annotations, {});
    expect(merged['semaphore']).toBe('sem-1');
  });

  it('merges @At', () => {
    const annotations: Annotation[] = [{ name: 'At', args: { '0': 'metric >= 5' } }];
    const merged = DecoratorAnnotationResolver.mergeDecorators(annotations, {});
    expect(merged['at']).toBe('metric >= 5');
  });

  it('merges @Cancel', () => {
    const annotations: Annotation[] = [{ name: 'Cancel', args: { '0': 'sig' } }];
    const merged = DecoratorAnnotationResolver.mergeDecorators(annotations, {});
    expect(merged['cancel']).toBe('sig');
  });

  it('merges @Mutex', () => {
    const annotations: Annotation[] = [{ name: 'Mutex', args: { '0': 'lock' } }];
    const merged = DecoratorAnnotationResolver.mergeDecorators(annotations, {});
    expect(merged['mutex']).toBe('lock');
  });

  it('merges @Trigger', () => {
    const annotations: Annotation[] = [{ name: 'Trigger', args: { '0': 'sig-name' } }];
    const merged = DecoratorAnnotationResolver.mergeDecorators(annotations, {});
    expect(merged['trigger']).toBe('sig-name');
  });

  it('ignores unknown annotations', () => {
    const annotations: Annotation[] = [{ name: 'Custom', args: { '0': 'value' } }];
    const merged = DecoratorAnnotationResolver.mergeDecorators(annotations, {});
    expect(Object.keys(merged)).toHaveLength(0);
  });

  it('merges multiple annotations', () => {
    const annotations: Annotation[] = [
      { name: 'Timeout', args: { '0': '5s' } },
      { name: 'Retry', args: { max: '3' } },
    ];
    const merged = DecoratorAnnotationResolver.mergeDecorators(annotations, {});
    expect(merged['timeout']).toBe('5s');
    expect(merged['retry']).toBe(3);
  });

  it('preserves existing decorators not covered by annotations', () => {
    const annotations: Annotation[] = [{ name: 'Timeout', args: { '0': '5s' } }];
    const merged = DecoratorAnnotationResolver.mergeDecorators(annotations, { signal: 'done' });
    expect(merged['timeout']).toBe('5s');
    expect(merged['signal']).toBe('done');
  });
});
