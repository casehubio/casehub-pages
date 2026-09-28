import type {
  ResolvedStep, StepResult, PluginStep, BlockStep, ParallelStep,
  IfElseStep, MatchStep, TryCatchFinallyStep, SelectStep,
  BarrierStep, QuorumStep, InvokeStep,
} from './step-walker.js';
import { stepSuccess, stepFailure } from './step-walker.js';
import type { StepContext } from './decorator-chain.js';
import { DecoratorChain } from './decorator-chain.js';
import { isTruthy } from '../truthiness.js';
import { matches } from '../match.js';

export class StructuralStepEvaluator {
  async evaluate(step: ResolvedStep, context: StepContext): Promise<StepResult> {
    const result = await this.dispatch(step, context);
    if (step.name && result.kind === 'success') {
      context.scope.resultStore().recordSuccess(step.name, result.output);
    } else if (step.name && result.kind === 'failure') {
      context.scope.resultStore().recordFailure(step.name, {
        message: result.message,
        exceptionClass: 'StepFailure',
        stackTrace: '',
      });
    }
    return result;
  }

  private async dispatch(step: ResolvedStep, context: StepContext): Promise<StepResult> {
    switch (step.kind) {
      case 'plugin': return this.evaluatePlugin(step, context);
      case 'invoke': return this.evaluateInvoke(step, context);
      case 'block': return this.evaluateBlock(step, context);
      case 'parallel': return this.evaluateParallel(step, context);
      case 'if-else': return this.evaluateIfElse(step, context);
      case 'match': return this.evaluateMatch(step, context);
      case 'try-catch-finally': return this.evaluateTryCatchFinally(step, context);
      case 'select': return this.evaluateSelect(step, context);
      case 'barrier': return this.evaluateBarrier(step, context);
      case 'quorum': return this.evaluateQuorum(step, context);
    }
  }

  private async evaluatePlugin(step: PluginStep, context: StepContext): Promise<StepResult> {
    const chain = DecoratorChain.build(step.decorators, step.entry.action);
    return chain.execute({ ...context, params: step.params, stepName: step.name ?? 'anonymous' });
  }

  private async evaluateInvoke(step: InvokeStep, context: StepContext): Promise<StepResult> {
    return stepFailure(`Invoke step '${step.name ?? 'anonymous'}' requires a runtime invoke handler`);
  }

  private async evaluateBlock(step: BlockStep, context: StepContext): Promise<StepResult> {
    let lastResult: StepResult = stepSuccess({});
    for (const child of step.steps) {
      lastResult = await this.evaluate(child, context);
      if (lastResult.kind === 'failure') return lastResult;
    }
    return lastResult;
  }

  private async evaluateParallel(step: ParallelStep, context: StepContext): Promise<StepResult> {
    const results = await Promise.allSettled(
      step.steps.map((child) => this.evaluate(child, context)),
    );

    const outputs: Record<string, unknown> = {};
    for (const result of results) {
      if (result.status === 'rejected') {
        return stepFailure(result.reason instanceof Error ? result.reason.message : String(result.reason));
      }
      if (result.value.kind === 'failure') {
        return result.value;
      }
      Object.assign(outputs, result.value.output);
    }
    return stepSuccess(outputs);
  }

  private async evaluateIfElse(step: IfElseStep, context: StepContext): Promise<StepResult> {
    const branch = isTruthy(step.condition) ? step.thenSteps : step.elseSteps;
    let lastResult: StepResult = stepSuccess({});
    for (const child of branch) {
      lastResult = await this.evaluate(child, context);
      if (lastResult.kind === 'failure') return lastResult;
    }
    return lastResult;
  }

  private async evaluateMatch(step: MatchStep, context: StepContext): Promise<StepResult> {
    for (const matchCase of step.cases) {
      if (matches(matchCase.pattern, step.scrutinee)) {
        if (matchCase.guard !== null && !isTruthy(matchCase.guard)) continue;
        let lastResult: StepResult = stepSuccess({});
        for (const child of matchCase.steps) {
          lastResult = await this.evaluate(child, context);
          if (lastResult.kind === 'failure') return lastResult;
        }
        return lastResult;
      }
    }
    return stepSuccess({});
  }

  private async evaluateTryCatchFinally(step: TryCatchFinallyStep, context: StepContext): Promise<StepResult> {
    let tryResult: StepResult = stepSuccess({});

    for (const child of step.trySteps) {
      tryResult = await this.evaluate(child, context);
      if (tryResult.kind === 'failure') break;
    }

    if (tryResult.kind === 'failure' && step.catchSteps.length > 0) {
      let catchResult: StepResult = stepSuccess({});
      for (const child of step.catchSteps) {
        catchResult = await this.evaluate(child, context);
        if (catchResult.kind === 'failure') break;
      }
      tryResult = catchResult;
    }

    for (const child of step.finallySteps) {
      await this.evaluate(child, context);
    }

    return tryResult;
  }

  private async evaluateSelect(step: SelectStep, context: StepContext): Promise<StepResult> {
    const promises = step.branches.map(async (branch) => {
      if (branch.type === 'wait') {
        const sig = context.scope.signal(branch.name);
        await sig.await();
      }
      let lastResult: StepResult = stepSuccess({});
      for (const child of branch.steps) {
        lastResult = await this.evaluate(child, context);
        if (lastResult.kind === 'failure') return lastResult;
      }
      return lastResult;
    });

    return Promise.race(promises);
  }

  private async evaluateBarrier(step: BarrierStep, _context: StepContext): Promise<StepResult> {
    const store = _context.scope.resultStore();
    const allCompleted = step.awaitSteps.every((name) => store.hasCompleted(name));
    if (allCompleted) return stepSuccess({});
    const missing = step.awaitSteps.filter((name) => !store.hasCompleted(name));
    return stepFailure(`Barrier: waiting on steps [${missing.join(', ')}]`);
  }

  private async evaluateQuorum(step: QuorumStep, context: StepContext): Promise<StepResult> {
    const store = context.scope.resultStore();
    const completed = step.ofSteps.filter((name) => store.hasCompleted(name));
    if (completed.length >= step.required) return stepSuccess({});
    return stepFailure(`Quorum: ${completed.length}/${step.required} of [${step.ofSteps.join(', ')}] completed`);
  }
}
