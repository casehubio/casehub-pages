import type { AgentSession, AgentEvent } from '../../step/invoke/session-pipeline.js';
import type { SimulationCorpus } from '../corpus.js';
import type { CorpusSelector } from '../selectors/corpus-selector.js';
import type { StreamingCorpusDatum } from '../streaming.js';
import { chunkToStream } from '../streaming.js';

export class SimulatedAgentSession implements AgentSession {
  private counter = 0;

  constructor(
    private readonly corpus: SimulationCorpus<unknown, unknown>,
    private readonly qualifiedName: string,
    private readonly selector: CorpusSelector | undefined,
  ) {}

  async *query(_prompt: string): AsyncGenerator<AgentEvent> {
    const entries = this.corpus.list(this.qualifiedName);
    if (entries.length === 0) {
      yield { kind: 'text-delta', text: '' };
      yield { kind: 'invocation-complete', inputTokens: 0, outputTokens: 0, durationMs: 0 };
      return;
    }

    const idx = this.counter % entries.length;
    this.counter++;
    if (this.selector) this.selector.onResolved();

    const entry = entries[idx]!;
    const output = entry.output;

    if (typeof output === 'object' && output !== null && 'text' in output
        && 'chunkStrategy' in output) {
      yield* chunkToStream(output as StreamingCorpusDatum);
    } else {
      const text = typeof output === 'string' ? output : JSON.stringify(output);
      yield { kind: 'text-delta', text };
      yield { kind: 'invocation-complete', inputTokens: 0, outputTokens: 0, durationMs: 0 };
    }
  }

  async clear(): Promise<void> {
    this.counter = 0;
    if (this.selector) this.selector.reset();
  }
}
