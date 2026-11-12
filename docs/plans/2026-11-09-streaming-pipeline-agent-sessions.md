# Phase 4 — Streaming Pipeline & Agent Session Handlers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use
> subagent-driven-development (recommended) or executing-plans to
> implement this plan task-by-task. Each task follows TDD
> (test-driven-development) and uses ide-tooling for structural
> editing. Steps use checkbox (`- [ ]`) syntax for tracking.

**Focal issue:** #642 — feat: Phase 4 — streaming pipeline and agent session handlers
**Issue group:** #608 (TS/Java YAML runtime parity audit)

**Goal:** Add agent session runtime execution (H5b) and streaming pipeline fusion optimization (M5) to the TS yaml-core package.

**Architecture:** Two independent subsystems: (1) four `InvokeHandler` implementations for session lifecycle operations backed by a pluggable `SessionPipeline` interface, and (2) a post-walk `FusionPass` that fuses consecutive type-compatible `PluginStep`s into `FusedPipelineStep`s evaluated via async iterables.

**Tech Stack:** TypeScript, Vitest, yaml-core package

## Global Constraints

- All code in `packages/yaml-core/src/step/`
- Follow existing `InvokeHandler` pattern (constructor injection, `supports()`/`create()` interface)
- YAML key names must match Java parser (`session`, `agent-query`, `agent-session-open`, etc.)
- Chain-breaking decorator set must be identical to Java's `FusionPass`
- `ResolvedStep` union must remain exhaustive — all `switch` statements need `'fused-pipeline'` case

---

## Batch 1: Session Handlers — Types, Parser, and SessionPipeline Interface

### Task 1: Binding type alignment + parser + SessionPipeline interface

**Files:**
- Modify: `packages/yaml-core/src/step/types.ts:69-90` (align session binding fields)
- Modify: `packages/yaml-core/src/step/definition-parser.ts:153` (add session binding parsing before the throw)
- Create: `packages/yaml-core/src/step/invoke/session-pipeline.ts`
- Modify: `packages/yaml-core/src/step/definition-parser.test.ts` (add session binding parse tests)
- Modify: `packages/yaml-core/src/step/index.ts:1-7` (export new binding fields + session types)

**Interfaces:**
- Consumes: existing `InvokeBinding` union from `types.ts`, existing `DefinitionParser` from `definition-parser.ts`
- Produces: `AgentSessionOpenBinding` (with `system?`, `modelQuery?`, `modelChain?`, `pool?`, `checkoutTimeout?`), `AgentSessionQueryBinding` (with `user`, `responseFormat?`, `output?`, `priority?`), `SessionPipeline`, `AgentSession`, `AgentEvent`, `AgentSessionInit`, `ClearingPolicy`

- [ ] **Step 1: Write failing tests for session binding parsing**

Add to `packages/yaml-core/src/step/definition-parser.test.ts` inside a new describe block:

```ts
describe('parseInvoke — session bindings', () => {
  it('parses agent-session-open binding', () => {
    const binding = DefinitionParser.parseInvoke({
      'agent-session-open': {
        session: 'chat-1', system: 'You are a helper.', model: 'gpt-4',
        'model-query': 'fast', pool: 'default', timeout: '30s',
        'checkout-timeout': '5s',
      },
    });
    expect(binding).toEqual({
      kind: 'agent-session-open',
      descriptor: 'chat-1',
      system: 'You are a helper.',
      model: 'gpt-4',
      modelQuery: 'fast',
      pool: 'default',
      timeout: '30s',
      checkoutTimeout: '5s',
    });
  });

  it('parses agent-session-open with camelCase keys', () => {
    const binding = DefinitionParser.parseInvoke({
      'agent-session-open': { session: 's1', modelQuery: 'cheap', modelChain: ['a', 'b'], checkoutTimeout: '10s' },
    });
    expect(binding.kind).toBe('agent-session-open');
    if (binding.kind === 'agent-session-open') {
      expect(binding.modelQuery).toBe('cheap');
      expect(binding.modelChain).toEqual(['a', 'b']);
      expect(binding.checkoutTimeout).toBe('10s');
    }
  });

  it('parses agent-query binding', () => {
    const binding = DefinitionParser.parseInvoke({
      'agent-query': { session: 'chat-1', user: 'Hello', 'response-format': 'json', output: 'answer', priority: true },
    });
    expect(binding).toEqual({
      kind: 'agent-session-query',
      sessionRef: 'chat-1',
      user: 'Hello',
      responseFormat: 'json',
      output: 'answer',
      priority: true,
      timeout: undefined,
    });
  });

  it('parses agent-session-clear with map', () => {
    const binding = DefinitionParser.parseInvoke({ 'agent-session-clear': { session: 'chat-1' } });
    expect(binding).toEqual({ kind: 'agent-session-clear', sessionRef: 'chat-1' });
  });

  it('parses agent-session-clear with string shorthand', () => {
    const binding = DefinitionParser.parseInvoke({ 'agent-session-clear': 'chat-1' });
    expect(binding).toEqual({ kind: 'agent-session-clear', sessionRef: 'chat-1' });
  });

  it('parses agent-session-close with map', () => {
    const binding = DefinitionParser.parseInvoke({ 'agent-session-close': { session: 'chat-1' } });
    expect(binding).toEqual({ kind: 'agent-session-close', sessionRef: 'chat-1' });
  });

  it('parses agent-session-close with string shorthand', () => {
    const binding = DefinitionParser.parseInvoke({ 'agent-session-close': 'chat-1' });
    expect(binding).toEqual({ kind: 'agent-session-close', sessionRef: 'chat-1' });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/yaml-core/src/step/definition-parser.test.ts --reporter=verbose`
Expected: 7 failures — "Unknown invoke binding type"

- [ ] **Step 3: Update binding types in types.ts**

In `packages/yaml-core/src/step/types.ts`, replace the four session binding interfaces:

```ts
export interface AgentSessionOpenBinding {
  kind: 'agent-session-open';
  descriptor: string;
  system?: string;
  model?: string;
  modelQuery?: string;
  modelChain?: string[];
  pool?: string;
  timeout?: string;
  checkoutTimeout?: string;
}

export interface AgentSessionQueryBinding {
  kind: 'agent-session-query';
  sessionRef: string;
  user: string;
  responseFormat?: string;
  output?: string;
  priority?: boolean;
  timeout?: string;
}

export interface AgentSessionClearBinding {
  kind: 'agent-session-clear';
  sessionRef: string;
}

export interface AgentSessionCloseBinding {
  kind: 'agent-session-close';
  sessionRef: string;
}
```

- [ ] **Step 4: Add session binding parsing to DefinitionParser**

In `packages/yaml-core/src/step/definition-parser.ts`, add four new branches before the `throw` at line 154. Also add `'agent-session-open', 'agent-query', 'agent-session-clear', 'agent-session-close'` to the error message.

```ts
if (raw['agent-session-open']) {
  const spec = raw['agent-session-open'] as Record<string, unknown>;
  return {
    kind: 'agent-session-open' as const,
    descriptor: spec['session'] as string,
    system: spec['system'] as string | undefined,
    model: spec['model'] as string | undefined,
    modelQuery: (spec['model-query'] ?? spec['modelQuery']) as string | undefined,
    modelChain: (spec['model-chain'] ?? spec['modelChain']) as string[] | undefined,
    pool: spec['pool'] as string | undefined,
    timeout: spec['timeout'] as string | undefined,
    checkoutTimeout: (spec['checkout-timeout'] ?? spec['checkoutTimeout']) as string | undefined,
  };
}
if (raw['agent-query']) {
  const spec = raw['agent-query'] as Record<string, unknown>;
  return {
    kind: 'agent-session-query' as const,
    sessionRef: spec['session'] as string,
    user: spec['user'] as string,
    responseFormat: (spec['response-format'] ?? spec['responseFormat']) as string | undefined,
    output: spec['output'] as string | undefined,
    priority: spec['priority'] === true,
    timeout: spec['timeout'] as string | undefined,
  };
}
if (raw['agent-session-clear']) {
  const val = raw['agent-session-clear'];
  if (typeof val === 'string') return { kind: 'agent-session-clear' as const, sessionRef: val };
  const spec = val as Record<string, unknown>;
  return { kind: 'agent-session-clear' as const, sessionRef: spec['session'] as string };
}
if (raw['agent-session-close']) {
  const val = raw['agent-session-close'];
  if (typeof val === 'string') return { kind: 'agent-session-close' as const, sessionRef: val };
  const spec = val as Record<string, unknown>;
  return { kind: 'agent-session-close' as const, sessionRef: spec['session'] as string };
}
```

- [ ] **Step 5: Create SessionPipeline interface**

Create `packages/yaml-core/src/step/invoke/session-pipeline.ts`:

```ts
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
```

- [ ] **Step 6: Update barrel exports in index.ts**

In `packages/yaml-core/src/step/index.ts`, add to the type exports from `types.ts`:

```ts
export type {
  Parameter, Definition, DefinitionFile,
  InvokeBinding, McpBinding, RestBinding, GraphqlBinding,
  ScriptBinding, AgentBinding, ProcessBinding,
  AgentSessionOpenBinding, AgentSessionQueryBinding,
  AgentSessionClearBinding, AgentSessionCloseBinding,
  AriaBinding, GraphqlDomainBinding, SimulatedBinding, VerifySimulationBinding, ElementMethodBinding,
  CloudEventSpec,
} from './types.js';
```

Add session pipeline exports:

```ts
export type { SessionPipeline, AgentSession, AgentEvent, AgentSessionInit, ClearingPolicy } from './invoke/session-pipeline.js';
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run packages/yaml-core/src/step/definition-parser.test.ts --reporter=verbose`
Expected: All pass

- [ ] **Step 8: Commit**

```bash
git add packages/yaml-core/src/step/types.ts packages/yaml-core/src/step/definition-parser.ts packages/yaml-core/src/step/definition-parser.test.ts packages/yaml-core/src/step/invoke/session-pipeline.ts packages/yaml-core/src/step/index.ts
git commit -m "feat(#642): session binding type alignment + parser + SessionPipeline interface"
```

---

### Task 2: Four session handler implementations + tests

**Files:**
- Create: `packages/yaml-core/src/step/invoke/agent-session-open-handler.ts`
- Create: `packages/yaml-core/src/step/invoke/agent-session-open-handler.test.ts`
- Create: `packages/yaml-core/src/step/invoke/agent-session-query-handler.ts`
- Create: `packages/yaml-core/src/step/invoke/agent-session-query-handler.test.ts`
- Create: `packages/yaml-core/src/step/invoke/agent-session-clear-handler.ts`
- Create: `packages/yaml-core/src/step/invoke/agent-session-clear-handler.test.ts`
- Create: `packages/yaml-core/src/step/invoke/agent-session-close-handler.ts`
- Create: `packages/yaml-core/src/step/invoke/agent-session-close-handler.test.ts`
- Modify: `packages/yaml-core/src/step/invoke/test-helpers.ts` (add mock session pipeline + handlers)
- Modify: `packages/yaml-core/src/step/index.ts` (export handler classes)

**Interfaces:**
- Consumes: `InvokeHandler` from `invoke-handler.ts`, `SessionPipeline`/`AgentSession`/`AgentEvent` from `session-pipeline.ts`, `stepSuccess`/`stepFailure` from `walker.ts`, `AgentSessionOpenBinding`/`AgentSessionQueryBinding`/`AgentSessionClearBinding`/`AgentSessionCloseBinding` from `types.ts`
- Produces: `AgentSessionOpenHandler`, `AgentSessionQueryHandler`, `AgentSessionClearHandler`, `AgentSessionCloseHandler` (all implementing `InvokeHandler`), `MockSessionPipeline`

- [ ] **Step 1: Write failing test for AgentSessionOpenHandler**

Create `packages/yaml-core/src/step/invoke/agent-session-open-handler.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { AgentSessionOpenHandler } from './agent-session-open-handler.js';
import type { AgentSessionOpenBinding } from '../types.js';
import type { SessionPipeline } from './session-pipeline.js';

function mockPipeline(): SessionPipeline {
  return {
    openSession: vi.fn().mockResolvedValue(undefined),
    sessionFor: vi.fn().mockReturnValue(undefined),
    releaseSession: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AgentSessionOpenHandler', () => {
  it('supports agent-session-open binding', () => {
    const handler = new AgentSessionOpenHandler(mockPipeline());
    expect(handler.supports({ kind: 'agent-session-open', descriptor: 's1' } as AgentSessionOpenBinding)).toBe(true);
    expect(handler.supports({ kind: 'agent' } as any)).toBe(false);
  });

  it('opens session with default system prompt', async () => {
    const pipeline = mockPipeline();
    const handler = new AgentSessionOpenHandler(pipeline);
    const binding: AgentSessionOpenBinding = { kind: 'agent-session-open', descriptor: 'chat-1' };
    const action = handler.create({ name: 'open', inputs: {}, outputs: {} }, binding);
    const result = await action.execute({});
    expect(result.kind).toBe('success');
    if (result.kind === 'success') expect(result.output).toEqual({ session: 'chat-1' });
    expect(pipeline.openSession).toHaveBeenCalledWith('chat-1', { system: 'You are a helpful assistant.' }, 'manual');
  });

  it('opens session with custom system prompt and model', async () => {
    const pipeline = mockPipeline();
    const handler = new AgentSessionOpenHandler(pipeline);
    const binding: AgentSessionOpenBinding = { kind: 'agent-session-open', descriptor: 'chat-2', system: 'Expert mode.', model: 'gpt-4' };
    const action = handler.create({ name: 'open', inputs: {}, outputs: {} }, binding);
    await action.execute({});
    expect(pipeline.openSession).toHaveBeenCalledWith('chat-2', { system: 'Expert mode.', model: 'gpt-4' }, 'manual');
  });

  it('returns failure on pipeline error', async () => {
    const pipeline = mockPipeline();
    (pipeline.openSession as any).mockRejectedValue(new Error('pool exhausted'));
    const handler = new AgentSessionOpenHandler(pipeline);
    const binding: AgentSessionOpenBinding = { kind: 'agent-session-open', descriptor: 'chat-3' };
    const action = handler.create({ name: 'open', inputs: {}, outputs: {} }, binding);
    const result = await action.execute({});
    expect(result.kind).toBe('failure');
    if (result.kind === 'failure') expect(result.message).toContain('pool exhausted');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/yaml-core/src/step/invoke/agent-session-open-handler.test.ts --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 3: Implement AgentSessionOpenHandler**

Create `packages/yaml-core/src/step/invoke/agent-session-open-handler.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run packages/yaml-core/src/step/invoke/agent-session-open-handler.test.ts --reporter=verbose`
Expected: All 3 tests pass

- [ ] **Step 5: Write failing test for AgentSessionQueryHandler**

Create `packages/yaml-core/src/step/invoke/agent-session-query-handler.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { AgentSessionQueryHandler } from './agent-session-query-handler.js';
import type { AgentSessionQueryBinding } from '../types.js';
import type { SessionPipeline, AgentEvent, AgentSession } from './session-pipeline.js';

function mockSession(events: AgentEvent[]): AgentSession {
  return {
    async *query(_prompt: string) { for (const e of events) yield e; },
    clear: vi.fn().mockResolvedValue(undefined),
  };
}

function mockPipeline(sessions: Record<string, AgentSession> = {}): SessionPipeline {
  return {
    openSession: vi.fn().mockResolvedValue(undefined),
    sessionFor: vi.fn((name: string) => sessions[name]),
    releaseSession: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AgentSessionQueryHandler', () => {
  it('supports agent-session-query binding', () => {
    const handler = new AgentSessionQueryHandler(mockPipeline());
    expect(handler.supports({ kind: 'agent-session-query', sessionRef: 's1', user: 'hi' } as AgentSessionQueryBinding)).toBe(true);
    expect(handler.supports({ kind: 'agent' } as any)).toBe(false);
  });

  it('collects text deltas into response', async () => {
    const session = mockSession([
      { kind: 'text-delta', text: 'Hello' },
      { kind: 'text-delta', text: ' world' },
      { kind: 'invocation-complete', inputTokens: 10, outputTokens: 5, durationMs: 100 },
    ]);
    const pipeline = mockPipeline({ 'chat-1': session });
    const handler = new AgentSessionQueryHandler(pipeline);
    const binding: AgentSessionQueryBinding = { kind: 'agent-session-query', sessionRef: 'chat-1', user: 'Hi' };
    const action = handler.create({ name: 'query', inputs: {}, outputs: {} }, binding);
    const result = await action.execute({});
    expect(result.kind).toBe('success');
    if (result.kind === 'success') {
      expect(result.output.response).toBe('Hello world');
      expect(result.output.inputTokens).toBe(10);
      expect(result.output.outputTokens).toBe(5);
      expect(result.output.durationMs).toBe(100);
    }
  });

  it('returns failure when session not found', async () => {
    const pipeline = mockPipeline({});
    const handler = new AgentSessionQueryHandler(pipeline);
    const binding: AgentSessionQueryBinding = { kind: 'agent-session-query', sessionRef: 'missing', user: 'Hi' };
    const action = handler.create({ name: 'query', inputs: {}, outputs: {} }, binding);
    const result = await action.execute({});
    expect(result.kind).toBe('failure');
    if (result.kind === 'failure') expect(result.message).toContain('Session not found');
  });

  it('handles query with no invocation-complete event', async () => {
    const session = mockSession([
      { kind: 'text-delta', text: 'Just text' },
    ]);
    const pipeline = mockPipeline({ 's1': session });
    const handler = new AgentSessionQueryHandler(pipeline);
    const binding: AgentSessionQueryBinding = { kind: 'agent-session-query', sessionRef: 's1', user: 'Q' };
    const action = handler.create({ name: 'query', inputs: {}, outputs: {} }, binding);
    const result = await action.execute({});
    expect(result.kind).toBe('success');
    if (result.kind === 'success') expect(result.output.response).toBe('Just text');
  });
});
```

- [ ] **Step 6: Implement AgentSessionQueryHandler**

Create `packages/yaml-core/src/step/invoke/agent-session-query-handler.ts`:

```ts
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
```

- [ ] **Step 7: Run query handler tests**

Run: `npx vitest run packages/yaml-core/src/step/invoke/agent-session-query-handler.test.ts --reporter=verbose`
Expected: All 4 tests pass

- [ ] **Step 8: Write tests + implement AgentSessionClearHandler**

Create `packages/yaml-core/src/step/invoke/agent-session-clear-handler.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { AgentSessionClearHandler } from './agent-session-clear-handler.js';
import type { AgentSessionClearBinding } from '../types.js';
import type { SessionPipeline, AgentSession } from './session-pipeline.js';

function mockSession(): AgentSession {
  return { async *query() {}, clear: vi.fn().mockResolvedValue(undefined) };
}

function mockPipeline(sessions: Record<string, AgentSession> = {}): SessionPipeline {
  return {
    openSession: vi.fn(), sessionFor: vi.fn((n: string) => sessions[n]), releaseSession: vi.fn(),
  };
}

describe('AgentSessionClearHandler', () => {
  it('supports agent-session-clear binding', () => {
    const handler = new AgentSessionClearHandler(mockPipeline());
    expect(handler.supports({ kind: 'agent-session-clear', sessionRef: 's1' } as AgentSessionClearBinding)).toBe(true);
  });

  it('clears session successfully', async () => {
    const session = mockSession();
    const pipeline = mockPipeline({ 's1': session });
    const handler = new AgentSessionClearHandler(pipeline);
    const binding: AgentSessionClearBinding = { kind: 'agent-session-clear', sessionRef: 's1' };
    const action = handler.create({ name: 'clear', inputs: {}, outputs: {} }, binding);
    const result = await action.execute({});
    expect(result.kind).toBe('success');
    if (result.kind === 'success') expect(result.output).toEqual({ session: 's1', cleared: true });
    expect(session.clear).toHaveBeenCalled();
  });

  it('returns failure when session not found', async () => {
    const handler = new AgentSessionClearHandler(mockPipeline({}));
    const binding: AgentSessionClearBinding = { kind: 'agent-session-clear', sessionRef: 'missing' };
    const action = handler.create({ name: 'clear', inputs: {}, outputs: {} }, binding);
    const result = await action.execute({});
    expect(result.kind).toBe('failure');
  });
});
```

Create `packages/yaml-core/src/step/invoke/agent-session-clear-handler.ts`:

```ts
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
```

- [ ] **Step 9: Write tests + implement AgentSessionCloseHandler**

Create `packages/yaml-core/src/step/invoke/agent-session-close-handler.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest';
import { AgentSessionCloseHandler } from './agent-session-close-handler.js';
import type { AgentSessionCloseBinding } from '../types.js';
import type { SessionPipeline } from './session-pipeline.js';

function mockPipeline(): SessionPipeline {
  return {
    openSession: vi.fn(), sessionFor: vi.fn(), releaseSession: vi.fn().mockResolvedValue(undefined),
  };
}

describe('AgentSessionCloseHandler', () => {
  it('supports agent-session-close binding', () => {
    const handler = new AgentSessionCloseHandler(mockPipeline());
    expect(handler.supports({ kind: 'agent-session-close', sessionRef: 's1' } as AgentSessionCloseBinding)).toBe(true);
  });

  it('releases session successfully', async () => {
    const pipeline = mockPipeline();
    const handler = new AgentSessionCloseHandler(pipeline);
    const binding: AgentSessionCloseBinding = { kind: 'agent-session-close', sessionRef: 'chat-1' };
    const action = handler.create({ name: 'close', inputs: {}, outputs: {} }, binding);
    const result = await action.execute({});
    expect(result.kind).toBe('success');
    if (result.kind === 'success') expect(result.output).toEqual({ session: 'chat-1', closed: true });
    expect(pipeline.releaseSession).toHaveBeenCalledWith('chat-1');
  });

  it('returns failure on release error', async () => {
    const pipeline = mockPipeline();
    (pipeline.releaseSession as any).mockRejectedValue(new Error('already closed'));
    const handler = new AgentSessionCloseHandler(pipeline);
    const binding: AgentSessionCloseBinding = { kind: 'agent-session-close', sessionRef: 'chat-1' };
    const action = handler.create({ name: 'close', inputs: {}, outputs: {} }, binding);
    const result = await action.execute({});
    expect(result.kind).toBe('failure');
  });
});
```

Create `packages/yaml-core/src/step/invoke/agent-session-close-handler.ts`:

```ts
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
```

- [ ] **Step 10: Add mock session pipeline to test-helpers.ts**

In `packages/yaml-core/src/step/invoke/test-helpers.ts`, add imports and a `MockSessionPipeline` class, then add session handlers to `createMockInvokeHandlers()`:

Add at the top of the file:

```ts
import type { SessionPipeline, AgentSession, AgentEvent, AgentSessionInit, ClearingPolicy } from './session-pipeline.js';
import { AgentSessionOpenHandler } from './agent-session-open-handler.js';
import { AgentSessionQueryHandler } from './agent-session-query-handler.js';
import { AgentSessionClearHandler } from './agent-session-clear-handler.js';
import { AgentSessionCloseHandler } from './agent-session-close-handler.js';
```

Add a mock session pipeline class before `createMockInvokeHandlers`:

```ts
class MockSessionPipeline implements SessionPipeline {
  private sessions = new Map<string, AgentSession>();
  async openSession(name: string, _init: AgentSessionInit, _policy: ClearingPolicy): Promise<void> {
    const session: AgentSession = {
      async *query(_prompt: string): AsyncIterable<AgentEvent> {
        yield { kind: 'text-delta', text: 'mock response' };
        yield { kind: 'invocation-complete', inputTokens: 5, outputTokens: 3, durationMs: 50 };
      },
      async clear() {},
    };
    this.sessions.set(name, session);
  }
  sessionFor(name: string): AgentSession | undefined { return this.sessions.get(name); }
  async releaseSession(name: string): Promise<void> { this.sessions.delete(name); }
}
```

Update `createMockInvokeHandlers` to include session handlers:

```ts
export function createMockInvokeHandlers(): InvokeHandler[] {
  const pipeline = new MockSessionPipeline();
  return [
    createMockRestHandler(),
    createMockMcpHandler(),
    createMockGraphqlHandler(),
    createMockScriptHandler(),
    createMockAgentHandler(),
    createMockProcessHandler(),
    new AgentSessionOpenHandler(pipeline),
    new AgentSessionQueryHandler(pipeline),
    new AgentSessionClearHandler(pipeline),
    new AgentSessionCloseHandler(pipeline),
  ];
}
```

- [ ] **Step 11: Update barrel exports in index.ts**

Add to `packages/yaml-core/src/step/index.ts`:

```ts
export { AgentSessionOpenHandler } from './invoke/agent-session-open-handler.js';
export { AgentSessionQueryHandler } from './invoke/agent-session-query-handler.js';
export { AgentSessionClearHandler } from './invoke/agent-session-clear-handler.js';
export { AgentSessionCloseHandler } from './invoke/agent-session-close-handler.js';
```

- [ ] **Step 12: Run all session handler tests**

Run: `npx vitest run packages/yaml-core/src/step/invoke/agent-session --reporter=verbose`
Expected: All tests pass (open: 3, query: 4, clear: 3, close: 3)

- [ ] **Step 13: Run full yaml-core test suite**

Run: `npx vitest run packages/yaml-core --reporter=verbose`
Expected: All existing tests continue to pass. No regressions.

- [ ] **Step 14: Commit**

```bash
git add packages/yaml-core/src/step/invoke/agent-session-*.ts packages/yaml-core/src/step/invoke/test-helpers.ts packages/yaml-core/src/step/index.ts
git commit -m "feat(#642): agent session handlers — open, query, clear, close + SessionPipeline"
```

---

## Batch 2: Streaming Pipeline — FusionPass and FusedPipelineStep

### Task 3: StreamingTypeInfo types + FusedPipelineStep + FusionPass

**Files:**
- Create: `packages/yaml-core/src/step/streaming-types.ts`
- Modify: `packages/yaml-core/src/step/types.ts:112-120` (add `streamingType` to Definition)
- Modify: `packages/yaml-core/src/step/walker.ts:73-87` (add FusedPipelineStep to ResolvedStep union)
- Create: `packages/yaml-core/src/step/fusion-pass.ts`
- Create: `packages/yaml-core/src/step/fusion-pass.test.ts`
- Modify: `packages/yaml-core/src/step/walker.ts:280-283` (call FusionPass.fuse() in resolve())
- Modify: `packages/yaml-core/src/step/index.ts` (export new types)

**Interfaces:**
- Consumes: `ResolvedStep`, `PluginStep` from `walker.ts`, `Definition` from `types.ts`, `ServiceRegistry` from `walker.ts`
- Produces: `StreamingTypeInfo`, `StreamingStepFactory`, `FusedStageDescriptor`, `FusedPipelineStep` (kind: `'fused-pipeline'`), `FusionPass.fuse(steps: ResolvedStep[]): ResolvedStep[]`

- [ ] **Step 1: Create StreamingTypeInfo types**

Create `packages/yaml-core/src/step/streaming-types.ts`:

```ts
import type { ServiceRegistry } from './walker.js';

export interface StreamingTypeInfo {
  inputType: string;
  outputType: string;
  inputKey: string;
  factory: StreamingStepFactory;
}

export type StreamingStepFactory = (
  params: Record<string, unknown>,
  input: AsyncIterable<unknown>,
  services: ServiceRegistry,
) => AsyncIterable<unknown>;

export interface FusedStageDescriptor {
  stepName: string | null;
  actionName: string;
  params: Record<string, unknown>;
  decorators: Record<string, unknown>;
  inputKey: string;
  factory: StreamingStepFactory;
}
```

- [ ] **Step 2: Add streamingType to Definition in types.ts**

In `packages/yaml-core/src/step/types.ts`, add an import and the field:

Add import at top:
```ts
import type { StreamingTypeInfo } from './streaming-types.js';
```

Add to `Definition` interface:
```ts
export interface Definition {
  name: string;
  description?: string;
  inputs: Record<string, Parameter>;
  outputs: Record<string, Parameter>;
  invoke?: InvokeBinding;
  portability?: Portability;
  absorbSiblings?: boolean;
  streamingType?: StreamingTypeInfo;
}
```

- [ ] **Step 3: Add FusedPipelineStep to ResolvedStep union in walker.ts**

In `packages/yaml-core/src/step/walker.ts`, add import and type:

Add import:
```ts
import type { StreamingStepFactory, FusedStageDescriptor } from './streaming-types.js';
```

Add the interface after `ControlStep`:
```ts
export interface FusedPipelineStep {
  kind: 'fused-pipeline';
  name: string | null;
  stages: FusedStageDescriptor[];
  decorators: Record<string, unknown>;
  annotations: unknown[];
}
```

Add `FusedPipelineStep` to the `ResolvedStep` union:
```ts
export type ResolvedStep =
  | PluginStep
  | InvokeStep
  | BlockStep
  | IfElseStep
  | MatchStep
  | ParallelStep
  | TryCatchFinallyStep
  | SelectStep
  | BarrierStep
  | QuorumStep
  | DelayStep
  | RaceStep
  | EmitEventStep
  | ControlStep
  | FusedPipelineStep;
```

- [ ] **Step 4: Write failing tests for FusionPass**

Create `packages/yaml-core/src/step/fusion-pass.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { FusionPass } from './fusion-pass.js';
import type { PluginStep, InvokeStep, ResolvedStep } from './walker.js';
import type { CatalogEntry } from './walker.js';
import type { Definition } from './types.js';
import type { StreamingStepFactory } from './streaming-types.js';

const textFactory: StreamingStepFactory = async function* (_p, input) { for await (const v of input) yield v; };

function streamingDef(inputType: string, outputType: string, inputKey = 'input'): Definition {
  return {
    name: 'action',
    inputs: {},
    outputs: {},
    streamingType: { inputType, outputType, inputKey, factory: textFactory },
  };
}

function plainDef(): Definition {
  return { name: 'action', inputs: {}, outputs: {} };
}

function pluginStep(name: string | null, def: Definition, decorators: Record<string, unknown> = {}): PluginStep {
  return {
    kind: 'plugin', name,
    entry: { qualifiedName: def.name, definition: def, action: { execute: async () => ({ kind: 'success' as const, output: {}, executionMetadata: {} }) } },
    params: {}, decorators, annotations: [],
  };
}

function invokeStep(name: string): InvokeStep {
  return { kind: 'invoke', name, invokeSpec: {}, decorators: {}, annotations: [] };
}

describe('FusionPass', () => {
  it('returns steps unchanged when fewer than 2', () => {
    const steps = [pluginStep('a', streamingDef('text', 'text'))];
    expect(FusionPass.fuse(steps)).toEqual(steps);
  });

  it('returns steps unchanged when no streaming types', () => {
    const steps = [pluginStep('a', plainDef()), pluginStep('b', plainDef())];
    expect(FusionPass.fuse(steps)).toEqual(steps);
  });

  it('fuses two type-compatible consecutive streaming steps', () => {
    const steps = [
      pluginStep('a', streamingDef('text', 'json')),
      pluginStep('b', streamingDef('json', 'text')),
    ];
    const result = FusionPass.fuse(steps);
    expect(result).toHaveLength(1);
    expect(result[0].kind).toBe('fused-pipeline');
    if (result[0].kind === 'fused-pipeline') {
      expect(result[0].stages).toHaveLength(2);
      expect(result[0].name).toBe('b');
      expect(result[0].stages[0].stepName).toBe('a');
      expect(result[0].stages[1].stepName).toBe('b');
    }
  });

  it('fuses three-step chain', () => {
    const steps = [
      pluginStep('a', streamingDef('text', 'json')),
      pluginStep('b', streamingDef('json', 'binary')),
      pluginStep('c', streamingDef('binary', 'text')),
    ];
    const result = FusionPass.fuse(steps);
    expect(result).toHaveLength(1);
    if (result[0].kind === 'fused-pipeline') {
      expect(result[0].stages).toHaveLength(3);
      expect(result[0].name).toBe('c');
    }
  });

  it('breaks chain on type incompatibility', () => {
    const steps = [
      pluginStep('a', streamingDef('text', 'json')),
      pluginStep('b', streamingDef('binary', 'text')),
    ];
    const result = FusionPass.fuse(steps);
    expect(result).toHaveLength(2);
    expect(result[0].kind).toBe('plugin');
    expect(result[1].kind).toBe('plugin');
  });

  it('breaks chain on chain-breaking decorator', () => {
    const steps = [
      pluginStep('a', streamingDef('text', 'json')),
      pluginStep('b', streamingDef('json', 'text'), { forEach: 'items' }),
    ];
    const result = FusionPass.fuse(steps);
    expect(result).toHaveLength(2);
  });

  it('breaks chain on non-PluginStep', () => {
    const steps: ResolvedStep[] = [
      pluginStep('a', streamingDef('text', 'json')),
      invokeStep('inv'),
      pluginStep('b', streamingDef('json', 'text')),
    ];
    const result = FusionPass.fuse(steps);
    expect(result).toHaveLength(3);
  });

  it('does not fuse when mid-chain step is referenced by name', () => {
    const a = pluginStep('a', streamingDef('text', 'json'));
    const b = pluginStep('b', streamingDef('json', 'text'));
    const c = pluginStep('c', plainDef());
    c.params = { ref: '${result.a}' };
    const result = FusionPass.fuse([a, b, c]);
    expect(result).toHaveLength(3);
    expect(result[0].kind).toBe('plugin');
    expect(result[1].kind).toBe('plugin');
  });

  it('handles mixed fusible and non-fusible steps', () => {
    const steps: ResolvedStep[] = [
      pluginStep('a', streamingDef('text', 'json')),
      pluginStep('b', streamingDef('json', 'text')),
      pluginStep('c', plainDef()),
      pluginStep('d', streamingDef('text', 'text')),
    ];
    const result = FusionPass.fuse(steps);
    expect(result).toHaveLength(3);
    expect(result[0].kind).toBe('fused-pipeline');
    expect(result[1].kind).toBe('plugin');
    expect(result[2].kind).toBe('plugin');
  });
});
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `npx vitest run packages/yaml-core/src/step/fusion-pass.test.ts --reporter=verbose`
Expected: FAIL — module not found

- [ ] **Step 6: Implement FusionPass**

Create `packages/yaml-core/src/step/fusion-pass.ts`:

```ts
import type { ResolvedStep, PluginStep, FusedPipelineStep } from './walker.js';
import type { FusedStageDescriptor } from './streaming-types.js';

const CHAIN_BREAKING_DECORATORS = new Set([
  'from', 'background', 'when', 'on-error', 'wait', 'at',
  'forEach', 'cancel', 'loop', 'transition', 'signal',
  'publish', 'semaphore', 'mutex', 'transform',
]);

function hasChainBreaker(decorators: Record<string, unknown>): boolean {
  for (const key of Object.keys(decorators)) {
    if (CHAIN_BREAKING_DECORATORS.has(key)) return true;
  }
  return false;
}

function collectReferencedNames(steps: ResolvedStep[]): Set<string> {
  const refs = new Set<string>();
  const pattern = /\$\{result\.([^.}]+)/g;
  for (const step of steps) {
    if ('params' in step) {
      const json = JSON.stringify(step.params);
      let m;
      while ((m = pattern.exec(json)) !== null) refs.add(m[1]);
    }
  }
  return refs;
}

export class FusionPass {
  static fuse(steps: ResolvedStep[]): ResolvedStep[] {
    if (steps.length < 2) return steps;

    const referencedNames = collectReferencedNames(steps);
    const result: ResolvedStep[] = [];
    let chain: PluginStep[] = [];

    const flush = () => {
      if (chain.length === 0) return;
      if (chain.length === 1) {
        result.push(chain[0]);
      } else {
        const stages: FusedStageDescriptor[] = chain.map(s => ({
          stepName: s.name,
          actionName: s.entry.qualifiedName,
          params: s.params,
          decorators: s.decorators,
          inputKey: s.entry.definition.streamingType!.inputKey,
          factory: s.entry.definition.streamingType!.factory,
        }));
        const fused: FusedPipelineStep = {
          kind: 'fused-pipeline',
          name: chain[chain.length - 1].name,
          stages,
          decorators: chain[0].decorators,
          annotations: chain[0].annotations,
        };
        result.push(fused);
      }
      chain = [];
    };

    for (const step of steps) {
      if (step.kind !== 'plugin') {
        flush();
        result.push(step);
        continue;
      }

      const streaming = step.entry.definition?.streamingType;
      if (!streaming || hasChainBreaker(step.decorators)) {
        flush();
        result.push(step);
        continue;
      }

      if (chain.length === 0) {
        chain.push(step);
        continue;
      }

      const prevStreaming = chain[chain.length - 1].entry.definition.streamingType!;
      if (prevStreaming.outputType !== streaming.inputType) {
        flush();
        chain.push(step);
        continue;
      }

      const hasReferencedMember = chain.some(
        s => s.name !== null && referencedNames.has(s.name),
      );
      if (hasReferencedMember) {
        flush();
        chain.push(step);
        continue;
      }

      chain.push(step);
    }

    flush();
    return result;
  }
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run packages/yaml-core/src/step/fusion-pass.test.ts --reporter=verbose`
Expected: All 8 tests pass

- [ ] **Step 8: Integrate FusionPass into Walker.resolve()**

In `packages/yaml-core/src/step/walker.ts`, add import:
```ts
import { FusionPass } from './fusion-pass.js';
```

Modify `Walker.resolve()` (around line 280-282) to call FusionPass after resolution:
```ts
  static resolve(steps: Record<string, unknown>[], catalog: Catalog, rawYaml?: string): ResolvedStep[] {
    const seenNames = new Set<string>();
    let annotationMap = AnnotationMap.empty();
    if (rawYaml) {
      const parsedAnnotations = AnnotationParser.parse(rawYaml);
      const stepPositions = StepPositionScanner.scan(rawYaml);
      annotationMap = AnnotationExtractor.extract(parsedAnnotations, stepPositions);
    }
    const resolved = Walker.resolveAtDepth(steps, catalog, 0, 'root', seenNames, annotationMap);
    Walker.validateRefs(resolved, seenNames);
    return FusionPass.fuse(resolved);
  }
```

- [ ] **Step 9: Update barrel exports in index.ts**

Add to `packages/yaml-core/src/step/index.ts`:

```ts
export type { StreamingTypeInfo, StreamingStepFactory, FusedStageDescriptor } from './streaming-types.js';
export type { FusedPipelineStep } from './walker.js';
export { FusionPass } from './fusion-pass.js';
```

Also update the existing ResolvedStep type export line to include FusedPipelineStep:
```ts
export type {
  ResolvedStep, PluginStep, InvokeStep, BlockStep, IfElseStep,
  MatchStep, ParallelStep, TryCatchFinallyStep, SelectStep,
  BarrierStep, QuorumStep, DelayStep, RaceStep, SelectBranch, ResolvedMatchCase,
  EmitEventStep, ControlStep, FusedPipelineStep,
  Action, Result, ServiceRegistry, Catalog, CatalogEntry,
} from './walker.js';
```

- [ ] **Step 10: Run full yaml-core test suite**

Run: `npx vitest run packages/yaml-core --reporter=verbose`
Expected: All tests pass. Existing walker tests continue to work (no streaming types on existing test definitions = no fusion = no behavior change).

- [ ] **Step 11: Commit**

```bash
git add packages/yaml-core/src/step/streaming-types.ts packages/yaml-core/src/step/fusion-pass.ts packages/yaml-core/src/step/fusion-pass.test.ts packages/yaml-core/src/step/types.ts packages/yaml-core/src/step/walker.ts packages/yaml-core/src/step/index.ts
git commit -m "feat(#642): FusionPass + FusedPipelineStep + StreamingTypeInfo — streaming pipeline optimization"
```

---

### Task 4: StructuralEvaluator fused pipeline evaluation

**Files:**
- Modify: `packages/yaml-core/src/step/structural-evaluator.ts:1-6,51-67` (add import + dispatch case + evaluateFusedPipeline method)
- Modify: `packages/yaml-core/src/step/structural-evaluator.test.ts` (add fused pipeline evaluation tests)

**Interfaces:**
- Consumes: `FusedPipelineStep`, `FusedStageDescriptor` from `walker.ts`/`streaming-types.ts`, `stepSuccess`/`stepFailure` from `walker.ts`, `Context` from `decorator-chain.ts`
- Produces: `evaluateFusedPipeline()` method on `StructuralEvaluator`

- [ ] **Step 1: Write failing tests for fused pipeline evaluation**

Add a new describe block to the existing `packages/yaml-core/src/step/structural-evaluator.test.ts` (or create a focused test file if the existing one is large):

Find the test file first, then add:

```ts
describe('evaluateFusedPipeline', () => {
  const textToJsonFactory: StreamingStepFactory = async function* (params, input) {
    const parts: string[] = [];
    for await (const chunk of input) parts.push(chunk as string);
    yield { text: parts.join(''), processed: true };
  };

  const jsonToTextFactory: StreamingStepFactory = async function* (params, input) {
    for await (const item of input) yield `result: ${JSON.stringify(item)}`;
  };

  function fusedStep(stages: Array<{ name: string; factory: StreamingStepFactory }>): FusedPipelineStep {
    return {
      kind: 'fused-pipeline',
      name: stages[stages.length - 1].name,
      stages: stages.map(s => ({
        stepName: s.name,
        actionName: s.name,
        params: {},
        decorators: {},
        inputKey: 'input',
        factory: s.factory,
      })),
      decorators: {},
      annotations: [],
    };
  }

  it('evaluates two-stage pipeline', async () => {
    const evaluator = new StructuralEvaluator([]);
    const step = fusedStep([
      { name: 'toJson', factory: textToJsonFactory },
      { name: 'toText', factory: jsonToTextFactory },
    ]);
    const result = await evaluator.evaluate(step, context);
    expect(result.kind).toBe('success');
  });

  it('returns failure when a stage throws', async () => {
    const failingFactory: StreamingStepFactory = async function* () {
      throw new Error('stage failed');
    };
    const evaluator = new StructuralEvaluator([]);
    const step = fusedStep([
      { name: 'fail', factory: failingFactory },
      { name: 'never', factory: jsonToTextFactory },
    ]);
    const result = await evaluator.evaluate(step, context);
    expect(result.kind).toBe('failure');
    if (result.kind === 'failure') expect(result.message).toContain('stage failed');
  });
});
```

Note: The test will need proper `context` setup matching the existing test patterns in the file. Examine the existing test setup and replicate it.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/yaml-core/src/step/structural-evaluator.test.ts --reporter=verbose`
Expected: FAIL — missing `'fused-pipeline'` case or type errors

- [ ] **Step 3: Add fused-pipeline dispatch and evaluateFusedPipeline()**

In `packages/yaml-core/src/step/structural-evaluator.ts`:

Add import:
```ts
import type { FusedPipelineStep } from './walker.js';
```

Add case to `dispatch()` switch statement (after the `'control'` case):
```ts
case 'fused-pipeline': return this.evaluateFusedPipeline(step, context);
```

Add the evaluation method:
```ts
  private async evaluateFusedPipeline(step: FusedPipelineStep, context: Context): Promise<Result> {
    const emptyIterable: AsyncIterable<unknown> = { async *[Symbol.asyncIterator]() {} };
    let currentIterable: AsyncIterable<unknown> = emptyIterable;

    try {
      for (const stage of step.stages) {
        const resolvedParams = context.resolver.resolveMap(stage.params, stage.stepName ?? 'anonymous');
        currentIterable = stage.factory(resolvedParams, currentIterable, context.services);
      }

      const outputs: unknown[] = [];
      for await (const value of currentIterable) {
        outputs.push(value);
      }

      const output = outputs.length === 1 && typeof outputs[0] === 'object' && outputs[0] !== null
        ? outputs[0] as Record<string, unknown>
        : { values: outputs };

      return stepSuccess(output);
    } catch (err) {
      return stepFailure(
        `Fused pipeline '${step.name ?? 'anonymous'}' failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/yaml-core/src/step/structural-evaluator.test.ts --reporter=verbose`
Expected: All tests pass including new fused-pipeline tests

- [ ] **Step 5: Run full yaml-core test suite**

Run: `npx vitest run packages/yaml-core --reporter=verbose`
Expected: All tests pass. No regressions.

- [ ] **Step 6: Commit**

```bash
git add packages/yaml-core/src/step/structural-evaluator.ts packages/yaml-core/src/step/structural-evaluator.test.ts
git commit -m "feat(#642): StructuralEvaluator fused pipeline evaluation via async iterables"
```

---

## Batch 3: Integration Verification

### Task 5: Cross-cutting integration tests + code review fixes

**Files:**
- Modify: `packages/yaml-core/src/step/invoke/test-helpers.test.ts` (verify mock handlers work)
- Run: full test suite across all yaml-core tests

**Interfaces:**
- Consumes: all types and implementations from Tasks 1-4
- Produces: verified green test suite

- [ ] **Step 1: Verify mock invoke handlers include session handlers**

Run: `npx vitest run packages/yaml-core/src/step/invoke/test-helpers.test.ts --reporter=verbose`
Expected: `createMockInvokeHandlers` tests pass, including coverage of session handler count (10 handlers total: 6 existing + 4 session).

- [ ] **Step 2: Run full yaml-core test suite**

Run: `npx vitest run packages/yaml-core --reporter=verbose`
Expected: All tests pass. Zero failures.

- [ ] **Step 3: Review all new exports compile cleanly**

Run: `npx tsc --noEmit -p packages/yaml-core/tsconfig.json`
Expected: No type errors.

- [ ] **Step 4: Fix any issues found**

Address any compilation or test failures. Re-run verification after each fix.

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "fix(#642): code review fixes — integration verification"
```

---

## References

- [2026-11-09-streaming-pipeline-agent-sessions-design.md] — design spec this plan implements
- `packages/yaml-core/src/step/types.ts:69-90` — existing session binding types
- `packages/yaml-core/src/step/definition-parser.ts:70-156` — existing parseInvoke() method
- `packages/yaml-core/src/step/invoke/agent-handler.ts` — reference handler pattern
- `packages/yaml-core/src/step/invoke/invoke-handler.ts` — InvokeHandler interface
- `packages/yaml-core/src/step/walker.ts:73-87,272-283` — ResolvedStep union + Walker.resolve()
- `packages/yaml-core/src/step/structural-evaluator.ts:23-68` — evaluator constructor + dispatch
- `packages/yaml-core/src/step/invoke/test-helpers.ts:173-182` — createMockInvokeHandlers
- `packages/yaml-core/src/step/index.ts` — barrel exports
- Java `DeclarationParser.java:114-249` — session binding parsing reference
- Java `FusionPass.java` — fusion algorithm reference
- GitHub #642 — focal issue
- GitHub #608 — parent issue (TS/Java YAML runtime parity)
