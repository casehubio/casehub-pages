import type { InvokeHandler } from './invoke-handler.js';
import type { Action, Result } from '../walker.js';
import { stepSuccess, stepFailure } from '../walker.js';
import type { Definition, InvokeBinding, AgentSessionQueryBinding } from '../types.js';
import type { SessionPipeline } from './session-pipeline.js';

export class AgentSessionQueryHandler implements InvokeHandler {
  constructor(private readonly pipeline: SessionPipeline) {}

  supports(binding: InvokeBinding): boolean { return binding.kind === 'agent-session-query'; }

  create(_definition: Definition, binding: InvokeBinding): Action {
    const query = binding as AgentSessionQueryBinding;
    const pipeline = this.pipeline;
    return {
      async execute(): Promise<Result> {
        const session = pipeline.sessionFor(query.sessionRef);
        if (!session) {
          return stepFailure(`Session not found: '${query.sessionRef}'`);
        }
        try {
          const parts: string[] = [];
          let inputTokens = 0, outputTokens = 0, durationMs = 0;
          for await (const event of session.query(query.user)) {
            if (event.kind === 'text-delta') {
              parts.push(event.text);
            } else if (event.kind === 'invocation-complete') {
              inputTokens = event.inputTokens;
              outputTokens = event.outputTokens;
              durationMs = event.durationMs;
            }
          }
          return stepSuccess({ response: parts.join(''), inputTokens, outputTokens, durationMs });
        } catch (err) {
          return stepFailure(`Session query '${query.sessionRef}' failed: ${err instanceof Error ? err.message : String(err)}`);
        }
      },
    };
  }
}
