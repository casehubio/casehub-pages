import type { StepCatalog } from './step-walker.js';

const DECORATOR_KEYS = [
  'if', 'on-success', 'on-failure', 'forEach', 'loop',
  'retry', 'timeout', 'delay', 'on-error', 'trigger',
  'transform', 'signal', 'publish', 'transition',
  'semaphore', 'barrier', 'quorum', 'race',
];

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Preserve the published static facade.
export class StepSchemaComposer {
  static compose(catalog: StepCatalog): Record<string, unknown> {
    const oneOf: Record<string, unknown>[] = [];

    for (const actionName of catalog.availableActions()) {
      const entry = catalog.resolve(actionName);
      if (!entry) continue;
      const properties: Record<string, unknown> = {
        [actionName]: { type: 'object' },
        step: { type: 'string' },
      };
      for (const dk of DECORATOR_KEYS) properties[dk] = {};
      const inputProps: Record<string, unknown> = {};
      for (const [name, param] of Object.entries(entry.definition.inputs)) {
        inputProps[name] = { type: stepParamTypeToJsonSchema(param.type) };
      }
      if (Object.keys(inputProps).length > 0) {
        properties[actionName] = { type: 'object', properties: inputProps };
      }
      oneOf.push({ type: 'object', properties, required: [actionName] });
    }

    oneOf.push({ type: 'object', properties: { invoke: { type: 'object' }, step: { type: 'string' } }, required: ['invoke'] });
    oneOf.push({ type: 'object', properties: { block: { type: 'array' }, step: { type: 'string' } }, required: ['block'] });
    oneOf.push({
      type: 'object',
      properties: { if: { type: 'string' }, then: { type: 'array' }, else: { type: 'array' }, step: { type: 'string' } },
      required: ['if', 'then'],
    });
    oneOf.push({
      type: 'object',
      properties: { match: { type: 'string' }, cases: { type: 'array' }, step: { type: 'string' } },
      required: ['match', 'cases'],
    });
    oneOf.push({ type: 'object', properties: { parallel: { type: 'array' }, step: { type: 'string' } }, required: ['parallel'] });

    const sharedProps: Record<string, unknown> = { step: { type: 'string' } };
    for (const dk of DECORATOR_KEYS) sharedProps[dk] = {};

    return { type: 'object', oneOf, properties: sharedProps };
  }
}

function stepParamTypeToJsonSchema(type: string): string {
  switch (type) {
    case 'STRING': return 'string';
    case 'INTEGER': return 'integer';
    case 'NUMBER': return 'number';
    case 'BOOLEAN': return 'boolean';
    case 'ARRAY': return 'array';
    case 'OBJECT': return 'object';
    default: return 'string';
  }
}
