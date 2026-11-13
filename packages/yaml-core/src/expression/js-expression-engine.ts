import type { ExpressionEngine } from './expression-engine.js';
import type { CompiledExpression } from './compiled-expression.js';

export class JsExpressionEngine implements ExpressionEngine {
  readonly type = 'js';

  compile(expression: string): CompiledExpression {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- This engine intentionally evaluates JavaScript expressions.
    const fn = new Function('ctx', `with(ctx) { return (${expression}); }`) as (ctx: Record<string, unknown>) => unknown;
    return {
      type: 'js',
      eval(context: Record<string, unknown>) {
        const safeCtx = Object.create(null) as Record<string, unknown>;
        Object.assign(safeCtx, context);
        return fn(safeCtx);
      },
    };
  }

  validate(expression: string): void {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval -- Validate the same syntax used by compile().
    new Function('ctx', `with(ctx) { return (${expression}); }`);
  }
}
