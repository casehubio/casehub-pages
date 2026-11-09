import type { ExpressionEngine } from './expression-engine.js';
import type { CompiledExpression } from './compiled-expression.js';

export class JsExpressionEngine implements ExpressionEngine {
  readonly type = 'js';

  compile(expression: string): CompiledExpression {
    const fn = new Function('ctx', `with(ctx) { return (${expression}); }`);
    return {
      type: 'js',
      eval(context: Record<string, unknown>) {
        const safeCtx = Object.create(null);
        Object.assign(safeCtx, context);
        return fn(safeCtx);
      },
    };
  }

  validate(expression: string): void {
    new Function('ctx', `with(ctx) { return (${expression}); }`);
  }
}
