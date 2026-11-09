import type { AgentEvent } from '../step/invoke/session-pipeline.js';

export interface StreamingCorpusDatum {
  readonly text: string;
  readonly chunkStrategy: 'word' | 'char';
  readonly delayMs: number;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
}

function delayMs(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

export async function* chunkToStream(datum: StreamingCorpusDatum): AsyncGenerator<AgentEvent> {
  const chunks = datum.chunkStrategy === 'word'
    ? datum.text.split(/(\s+)/).filter(c => c.length > 0)
    : [...datum.text];
  const startTime = Date.now();
  for (const chunk of chunks) {
    if (datum.delayMs > 0) await delayMs(datum.delayMs);
    yield { kind: 'text-delta', text: chunk };
  }
  yield {
    kind: 'invocation-complete',
    inputTokens: datum.inputTokens ?? 0,
    outputTokens: datum.outputTokens ?? 0,
    durationMs: Date.now() - startTime,
  };
}
