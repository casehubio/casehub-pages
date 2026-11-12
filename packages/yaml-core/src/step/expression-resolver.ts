import type { ExpressionEngineRegistry } from '../expression/expression-engine-registry.js';
import type { VariableResolver } from '../variable-resolver.js';
import type { Parameter } from './types.js';

export function hasExpressionParams(inputs: Record<string, Parameter> | undefined): boolean {
  if (!inputs) return false;
  return Object.values(inputs).some(p => p.type === 'EXPRESSION');
}

export function resolvePluginParams(
  rawParams: Record<string, unknown>,
  declaredInputs: Record<string, Parameter>,
  resolver: VariableResolver,
  registry: ExpressionEngineRegistry,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  const stringParams: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(rawParams)) {
    const declared = declaredInputs[key];
    if (declared?.type === 'EXPRESSION') {
      resolved[key] = resolveExpression(value, resolver, registry);
    } else {
      stringParams[key] = value;
    }
  }

  Object.assign(resolved, resolver.resolveMap(stringParams, 'step'));
  return resolved;
}

function resolveExpression(
  rawValue: unknown,
  resolver: VariableResolver,
  registry: ExpressionEngineRegistry,
): unknown {
  if (rawValue == null) return null;
  if (typeof rawValue !== 'string') return rawValue;

  let expr = rawValue;
  if (expr.startsWith('${') && expr.endsWith('}')
      && expr.indexOf('}') === expr.length - 1) {
    expr = expr.substring(2, expr.length - 1);
  }

  const engineType = registry.resolveDefault('PARAMETER');
  if (!engineType) {
    throw new Error('No default expression engine registered for PARAMETER');
  }

  const context = resolver.buildExpressionContext();
  const compiled = registry.compile(engineType, expr);
  return compiled.eval(context);
}
