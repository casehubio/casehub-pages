export interface AgentSession {
  query(prompt: string): AsyncIterable<AgentEvent>;
  clear(): Promise<void>;
}

export type AgentEvent =
  | { kind: 'text-delta'; text: string }
  | { kind: 'invocation-complete'; inputTokens: number; outputTokens: number; durationMs: number };

export interface SessionPipeline {
  openSession(name: string, init: AgentSessionInit, clearingPolicy: ClearingPolicy): Promise<void>;
  sessionFor(name: string): AgentSession | undefined;
  releaseSession(name: string): Promise<void>;
}

export interface AgentSessionInit {
  system: string;
  model?: string;
}

export type ClearingPolicy = 'manual' | 'auto';
