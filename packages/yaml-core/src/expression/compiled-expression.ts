export interface CompiledExpression<R = unknown> {
  readonly type: string;
  eval(context: Record<string, unknown>): R;
}

export interface ExpressionDescription {
  engine: string;
  expression: string;
  context: Record<string, unknown>;
  status: 'not-available';
}

export class DescriptiveExpression implements CompiledExpression<ExpressionDescription> {
  readonly type = 'descriptive';

  constructor(
    private readonly requestedType: string,
    private readonly expression: string,
  ) {}

  eval(context: Record<string, unknown>): ExpressionDescription {
    return {
      engine: this.requestedType,
      expression: this.expression,
      context,
      status: 'not-available' as const,
    };
  }
}
