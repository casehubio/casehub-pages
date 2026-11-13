// eslint-disable-next-line @typescript-eslint/triple-slash-reference -- Include the jqjs shim for consumers of source exports.
/// <reference path="./jqjs.d.ts" />
import jq from '@sscots/jqjs';
import type { ExpressionEngine } from './expression-engine.js';
import type { CompiledExpression } from './compiled-expression.js';

export class JqExpressionEngine implements ExpressionEngine {
  readonly type = 'jq';

  compile(expression: string): CompiledExpression {
    const compiled = jq.compile(expression);
    return {
      type: 'jq',
      eval(context: Record<string, unknown>) {
        const gen = compiled(context);
        return gen.next().value ?? null;
      },
    };
  }

  validate(expression: string): void {
    jq.compile(expression);
  }
}
