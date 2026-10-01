import type { Action, Result, ServiceRegistry } from './walker.js';
import { stepSuccess, stepFailure } from './walker.js';
import type { ScenarioScope } from '../orchestration/types.js';
import { parseLoopDirective, parseRetryDirective } from '../orchestration/directives.js';
import { parseDuration } from '../orchestration/duration-parser.js';
import { isTruthy } from '../truthiness.js';

export interface Context {
  readonly params: Record<string, unknown>;
  readonly services: ServiceRegistry;
  readonly scope: ScenarioScope;
  readonly stepName: string;
}

export interface DecoratedExecution {
  execute(context: Context): Promise<Result>;
}

class CoreExecution implements DecoratedExecution {
  constructor(private readonly action: Action) {}
  async execute(context: Context): Promise<Result> {
    return this.action.execute(context.params, context.services);
  }
}

class WhenDecorator implements DecoratedExecution {
  constructor(
    private readonly next: DecoratedExecution,
    private readonly condition: string,
  ) {}
  async execute(context: Context): Promise<Result> {
    if (!isTruthy(this.condition)) {
      return stepSuccess({});
    }
    return this.next.execute(context);
  }
}

class LoopDecorator implements DecoratedExecution {
  constructor(
    private readonly next: DecoratedExecution,
    private readonly raw: unknown,
  ) {}
  async execute(context: Context): Promise<Result> {
    const directive = parseLoopDirective(this.raw);
    const count = 'count' in directive ? directive.count : 0;
    let lastResult: Result = stepSuccess({});
    for (let i = 0; i < count; i++) {
      lastResult = await this.next.execute(context);
      if (lastResult.kind === 'failure') return lastResult;
    }
    return lastResult;
  }
}

class RetryDecorator implements DecoratedExecution {
  constructor(
    private readonly next: DecoratedExecution,
    private readonly raw: unknown,
  ) {}
  async execute(context: Context): Promise<Result> {
    const directive = parseRetryDirective(this.raw);
    let lastResult: Result = stepFailure('no attempts');
    for (let attempt = 0; attempt < directive.max; attempt++) {
      if (attempt > 0 && directive.type === 'full' && directive.delayMs > 0) {
        await delay(directive.delayMs);
      }
      lastResult = await this.next.execute(context);
      if (lastResult.kind === 'success') return lastResult;
    }
    return lastResult;
  }
}

class TimeoutDecorator implements DecoratedExecution {
  constructor(
    private readonly next: DecoratedExecution,
    private readonly raw: unknown,
  ) {}
  async execute(context: Context): Promise<Result> {
    const ms = typeof this.raw === 'number' ? this.raw : parseDuration(String(this.raw));
    const timeoutPromise = new Promise<Result>((resolve) =>
      setTimeout(() => resolve(stepFailure(`Step '${context.stepName}' exceeded timeout of ${ms}ms`)), ms),
    );
    return Promise.race([this.next.execute(context), timeoutPromise]);
  }
}

class DelayDecorator implements DecoratedExecution {
  constructor(
    private readonly next: DecoratedExecution,
    private readonly raw: unknown,
  ) {}
  async execute(context: Context): Promise<Result> {
    const result = await this.next.execute(context);
    const ms = typeof this.raw === 'number' ? this.raw : parseDuration(String(this.raw));
    await delay(ms);
    return result;
  }
}

class SemaphoreDecorator implements DecoratedExecution {
  constructor(
    private readonly next: DecoratedExecution,
    private readonly name: string,
  ) {}
  async execute(context: Context): Promise<Result> {
    const sem = context.scope.semaphore(this.name, 1);
    await sem.acquire();
    try {
      return await this.next.execute(context);
    } catch (e) {
      return stepFailure(e instanceof Error ? e.message : String(e));
    } finally {
      sem.release();
    }
  }
}

class SignalDecorator implements DecoratedExecution {
  constructor(
    private readonly next: DecoratedExecution,
    private readonly name: string,
  ) {}
  async execute(context: Context): Promise<Result> {
    const result = await this.next.execute(context);
    if (result.kind === 'success') {
      context.scope.signal(this.name).signal();
    }
    return result;
  }
}

class TransitionDecorator implements DecoratedExecution {
  constructor(
    private readonly next: DecoratedExecution,
    private readonly raw: unknown,
  ) {}
  async execute(context: Context): Promise<Result> {
    const result = await this.next.execute(context);
    if (result.kind === 'success' && typeof this.raw === 'object' && this.raw !== null) {
      const spec = this.raw as Record<string, unknown>;
      const machine = spec['machine'] as string | undefined;
      const from = spec['from'] as string | undefined;
      const to = spec['to'] as string | undefined;
      if (machine && from && to) {
        const sm = context.scope.stateMachine(machine, [from, to], from);
        sm.transition(from, to);
      }
    }
    return result;
  }
}

class TransformDecorator implements DecoratedExecution {
  constructor(
    private readonly next: DecoratedExecution,
    private readonly raw: unknown,
  ) {}
  async execute(context: Context): Promise<Result> {
    const result = await this.next.execute(context);
    if (result.kind === 'success' && typeof this.raw === 'object' && this.raw !== null) {
      const additions = this.raw as Record<string, unknown>;
      return stepSuccess({ ...result.output, ...additions });
    }
    return result;
  }
}

class OnErrorDecorator implements DecoratedExecution {
  constructor(
    private readonly next: DecoratedExecution,
    private readonly _policy: unknown,
  ) {}
  async execute(context: Context): Promise<Result> {
    try {
      return await this.next.execute(context);
    } catch (e) {
      return stepFailure(e instanceof Error ? e.message : String(e));
    }
  }
}

class OnSuccessDecorator implements DecoratedExecution {
  constructor(
    private readonly next: DecoratedExecution,
    private readonly handler: string,
  ) {}
  async execute(context: Context): Promise<Result> {
    const result = await this.next.execute(context);
    if (result.kind === 'success') {
      return {
        ...result,
        executionMetadata: { ...result.executionMetadata, 'on-success': this.handler },
      };
    }
    return result;
  }
}

class OnFailureDecorator implements DecoratedExecution {
  constructor(
    private readonly next: DecoratedExecution,
    private readonly handler: string,
  ) {}
  async execute(context: Context): Promise<Result> {
    const result = await this.next.execute(context);
    if (result.kind === 'failure') {
      return stepSuccess({
        '__failure': result.message,
        '__on-failure': this.handler,
      });
    }
    return result;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class DecoratorChain {
  static build(
    decorators: Record<string, unknown>,
    action: Action,
  ): DecoratedExecution {
    let execution: DecoratedExecution = new CoreExecution(action);

    if (decorators['on-success'] != null) {
      execution = new OnSuccessDecorator(execution, String(decorators['on-success']));
    }
    if (decorators['on-failure'] != null) {
      execution = new OnFailureDecorator(execution, String(decorators['on-failure']));
    }
    if (decorators['transform'] != null) {
      execution = new TransformDecorator(execution, decorators['transform']);
    }
    if (decorators['transition'] != null) {
      execution = new TransitionDecorator(execution, decorators['transition']);
    }
    if (decorators['signal'] != null) {
      execution = new SignalDecorator(execution, String(decorators['signal']));
    }
    if (decorators['delay'] != null) {
      execution = new DelayDecorator(execution, decorators['delay']);
    }
    if (decorators['semaphore'] != null) {
      execution = new SemaphoreDecorator(execution, String(decorators['semaphore']));
    }
    if (decorators['retry'] != null) {
      execution = new RetryDecorator(execution, decorators['retry']);
    }
    if (decorators['timeout'] != null) {
      execution = new TimeoutDecorator(execution, decorators['timeout']);
    }
    if (decorators['on-error'] != null) {
      execution = new OnErrorDecorator(execution, decorators['on-error']);
    }
    if (decorators['loop'] != null) {
      execution = new LoopDecorator(execution, decorators['loop']);
    }
    if (decorators['if'] != null) {
      execution = new WhenDecorator(execution, String(decorators['if']));
    }

    return execution;
  }
}
