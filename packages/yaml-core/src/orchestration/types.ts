import type { StateHandler, TransitionHandler } from './callbacks.js';
import type { StepError } from './directives.js';

export interface OrcSignal {
  signal(payload?: unknown): void;
  await(): Promise<void>;
  await(timeoutMs: number): Promise<boolean>;
  payload(): unknown;
  isSignalled(): boolean;
}

export interface OrcSemaphore {
  acquire(): Promise<void>;
  tryAcquire(timeoutMs: number): Promise<boolean>;
  release(): void;
  availablePermits(): number;
}

export interface OrcLatch {
  countDown(): void;
  await(): Promise<void>;
  await(timeoutMs: number): Promise<boolean>;
  getCount(): number;
}

export interface OrcChannel<T> {
  send(value: T): Promise<void>;
  send(value: T, timeoutMs: number): Promise<boolean>;
  receive(): Promise<T>;
  receive(timeoutMs: number): Promise<T | undefined>;
  isEmpty(): boolean;
  close(): void;
  close(cause: Error): void;
  isErrorClosed(): boolean;
  closeError(): Error | undefined;
}

export interface OrcStateMachine<S extends string> {
  currentState(): S;
  transition(from: S, to: S, payload?: unknown): boolean;
  onTransition(from: S, to: S, handler: TransitionHandler): void;
  onEnter(state: S, handler: StateHandler): void;
  onExit(state: S, handler: StateHandler): void;
}

export interface StepResultStore {
  recordSuccess(stepName: string, result: Record<string, unknown>): void;
  recordFailure(stepName: string, error: StepError): void;
  result(stepName: string): Record<string, unknown> | undefined;
  error(stepName: string): StepError | undefined;
  hasCompleted(stepName: string): boolean;
}

export interface ScenarioScope {
  semaphore(name: string, permits: number): OrcSemaphore;
  latch(name: string, count: number): OrcLatch;
  signal(name: string): OrcSignal;
  channel<T>(name: string, capacity?: number): OrcChannel<T>;
  stateMachine<S extends string>(name: string, states: readonly S[], initial: S): OrcStateMachine<S>;
  primitive<T>(name: string, type: new (...args: unknown[]) => T): T;
  resultStore(): StepResultStore;
  close(): void;
}
