import type { ExpressionEngine } from './expression-engine.js';
import type { CompiledExpression } from './compiled-expression.js';
import { DescriptiveExpression } from './compiled-expression.js';
import type { ExpressionContext } from './expression-context.js';

export interface ExpressionEngineRegistry {
  register(engine: ExpressionEngine): void;
  resolve(type: string): ExpressionEngine | undefined;
  compile(type: string, expression: string): CompiledExpression;
  registerDefault(context: ExpressionContext, engineType: string): void;
  resolveDefault(context: ExpressionContext): string | undefined;
  clearCache(): void;
}

export class DefaultExpressionEngineRegistry implements ExpressionEngineRegistry {
  private readonly engines = new Map<string, ExpressionEngine>();
  private readonly defaults = new Map<ExpressionContext, string>();
  private readonly cache = new Map<string, CompiledExpression>();

  register(engine: ExpressionEngine): void {
    this.engines.set(engine.type, engine);
  }

  resolve(type: string): ExpressionEngine | undefined {
    return this.engines.get(type);
  }

  compile(type: string, expression: string): CompiledExpression {
    const key = `${type}:${expression}`;
    const cached = this.cache.get(key);
    if (cached) return cached;

    const engine = this.engines.get(type);
    if (!engine) return new DescriptiveExpression(type, expression);

    const compiled = engine.compile(expression);
    this.cache.set(key, compiled);
    return compiled;
  }

  registerDefault(context: ExpressionContext, engineType: string): void {
    this.defaults.set(context, engineType);
  }

  resolveDefault(context: ExpressionContext): string | undefined {
    return this.defaults.get(context);
  }

  clearCache(): void {
    this.cache.clear();
  }
}
