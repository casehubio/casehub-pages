import type { InvokeHandler } from './invoke-handler.js';
import type { Action, Result } from '../walker.js';
import { stepSuccess, stepFailure } from '../walker.js';
import type { Definition, InvokeBinding, AgentSessionClearBinding } from '../types.js';
import type { SessionPipeline } from './session-pipeline.js';

export class AgentSessionClearHandler implements InvokeHandler {
  constructor(private readonly pipeline: SessionPipeline) {}

  supports(binding: InvokeBinding): boolean { return binding.kind === 'agent-session-clear'; }

  create(_definition: Definition, binding: InvokeBinding): Action {
    const clear = binding as AgentSessionClearBinding;
    const pipeline = this.pipeline;
    return {
      async execute(): Promise<Result> {
        const session = pipeline.sessionFor(clear.sessionRef);
        if (!session) {
          return stepFailure(`Session not found: '${clear.sessionRef}'`);
        }
        try {
          await session.clear();
          return stepSuccess({ session: clear.sessionRef, cleared: true });
        } catch (err) {
          return stepFailure(`Session clear '${clear.sessionRef}' failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      },
    };
  }
}
