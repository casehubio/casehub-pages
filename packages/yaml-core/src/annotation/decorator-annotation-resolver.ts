import type { Annotation } from './annotation-map.js';

const DECORATOR_ANNOTATION_MAP: Record<string, (args: Record<string, string>) => [string, unknown]> = {
  Timeout: (args) => ['timeout', args['0'] ?? args['value']],
  Retry: (args) => {
    const spec: Record<string, unknown> = {};
    if (args['max']) spec['max'] = Number(args['max']);
    if (args['backoff']) spec['backoff'] = args['backoff'];
    if (args['delay']) spec['delay'] = args['delay'];
    if (args['0'] && !args['max']) spec['max'] = Number(args['0']);
    return ['retry', Object.keys(spec).length === 1 && spec['max'] !== undefined ? spec['max'] : spec];
  },
  Delay: (args) => ['delay', args['0'] ?? args['value']],
  Priority: (args) => ['priority', args['0'] ?? args['value']],
  Resource: (args) => ['resource', args['0'] ?? args['value']],
  Background: () => ['background', true],
  OnError: (args) => ['on-error', args['0'] ?? args['value']],
  Trigger: (args) => ['trigger', args['0'] ?? args['value']],
  Semaphore: (args) => ['semaphore', args['0'] ?? args['value']],
  At: (args) => ['at', args['0'] ?? args['value']],
  Cancel: (args) => ['cancel', args['0'] ?? args['value']],
  Mutex: (args) => ['mutex', args['0'] ?? args['value']],
};

export class DecoratorAnnotationResolver {
  static mergeDecorators(
    annotations: Annotation[],
    decorators: Record<string, unknown>,
  ): Record<string, unknown> {
    const merged = { ...decorators };
    for (const ann of annotations) {
      const mapper = DECORATOR_ANNOTATION_MAP[ann.name];
      if (!mapper) continue;
      const [key, value] = mapper(ann.args);
      if (!(key in merged)) {
        merged[key] = value;
      }
    }
    return merged;
  }
}
