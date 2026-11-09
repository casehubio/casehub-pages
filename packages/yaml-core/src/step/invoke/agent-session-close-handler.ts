import type { InvokeHandler } from './invoke-handler.js';
import type { Action, Result } from '../walker.js';
import { stepSuccess, stepFailure } from '../walker.js';
import type { Definition, InvokeBinding, AgentSessionCloseBinding } from '../types.js';
import type { SessionPipeline } from './session-pipeline.js';

export class AgentSessionCloseHandler implements InvokeHandler {
  constructor(private readonly pipeline: SessionPipeline) {}

  supports(binding: InvokeBinding): boolean { return binding.kind === 'agent-session-close'; }

  create(_definition: Definition, binding: InvokeBinding): Action {
    const close = binding as AgentSessionCloseBinding;
    const pipeline = this.pipeline;
    return {
      async execute(): Promise<Result> {
        try {
          await pipeline.releaseSession(close.sessionRef);
          return stepSuccess({ session: close.sessionRef, closed: true });
        } catch (err) {
          return stepFailure(`Session close '${close.sessionRef}' failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      },
    };
  }
}
