import type { InvokeHandler } from './invoke-handler.js';
import type { Action, Result } from '../walker.js';
import { stepSuccess, stepFailure } from '../walker.js';
import type { Definition, InvokeBinding, AgentSessionOpenBinding } from '../types.js';
import type { SessionPipeline } from './session-pipeline.js';

export class AgentSessionOpenHandler implements InvokeHandler {
  constructor(private readonly pipeline: SessionPipeline) {}

  supports(binding: InvokeBinding): boolean { return binding.kind === 'agent-session-open'; }

  create(_definition: Definition, binding: InvokeBinding): Action {
    const open = binding as AgentSessionOpenBinding;
    const pipeline = this.pipeline;
    return {
      async execute(): Promise<Result> {
        try {
          const init = {
            system: open.system ?? 'You are a helpful assistant.',
            ...(open.model !== undefined ? { model: open.model } : {}),
          };
          await pipeline.openSession(open.descriptor, init, 'manual');
          return stepSuccess({ session: open.descriptor });
        } catch (err) {
          return stepFailure(`Session open '${open.descriptor}' failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      },
    };
  }
}
