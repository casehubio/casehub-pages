import { DefaultExpressionEngineRegistry } from './expression-engine-registry.js';
import { JqExpressionEngine } from './jq-expression-engine.js';
import { JsExpressionEngine } from './js-expression-engine.js';
import type { ExpressionContext } from './expression-context.js';
import type { ExpressionEngineRegistry } from './expression-engine-registry.js';

export function createExpressionEngineRegistry(): ExpressionEngineRegistry {
  const registry = new DefaultExpressionEngineRegistry();
  registry.register(new JqExpressionEngine());
  registry.register(new JsExpressionEngine());

  registry.registerDefault('CONDITION', 'js');
  registry.registerDefault('TRANSFORM', 'jq');
  registry.registerDefault('FILTER', 'jq');
  registry.registerDefault('PARAMETER', 'js');

  const contexts: ExpressionContext[] = ['CONDITION', 'TRANSFORM', 'FILTER', 'PARAMETER'];
  for (const ctx of contexts) {
    if (!registry.resolveDefault(ctx)) {
      throw new Error(`No default expression engine registered for ${ctx}`);
    }
  }
  return registry;
}
