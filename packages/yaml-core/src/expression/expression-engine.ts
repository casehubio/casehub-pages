import type { CompiledExpression } from './compiled-expression.js';

export interface ExpressionEngine {
  readonly type: string;
  compile(expression: string): CompiledExpression;
  validate(expression: string): void;
}
