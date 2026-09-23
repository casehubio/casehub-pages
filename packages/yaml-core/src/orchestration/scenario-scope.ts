import type {
  ScenarioScope, OrcSemaphore, OrcLatch, OrcSignal, OrcChannel,
  OrcStateMachine, StepResultStore,
} from './types.js';
import { DefaultOrcSemaphore } from './semaphore.js';
import { DefaultOrcLatch } from './latch.js';
import { DefaultOrcSignal } from './signal.js';
import { DefaultOrcChannel } from './channel.js';
import { StateMachineBuilder } from './state-machine.js';
import { DefaultStepResultStore } from './step-result-store.js';

export class DefaultScenarioScope implements ScenarioScope {
  private readonly _primitives = new Map<string, unknown>();
  private _resultStore?: DefaultStepResultStore;

  semaphore(name: string, permits: number): OrcSemaphore {
    return this._getOrCreate(name, () => new DefaultOrcSemaphore(permits));
  }

  latch(name: string, count: number): OrcLatch {
    return this._getOrCreate(name, () => new DefaultOrcLatch(count));
  }

  signal(name: string): OrcSignal {
    return this._getOrCreate(name, () => new DefaultOrcSignal());
  }

  channel<T>(name: string, capacity?: number): OrcChannel<T> {
    return this._getOrCreate(name, () => new DefaultOrcChannel<T>(capacity));
  }

  stateMachine<S extends string>(
    name: string, states: readonly S[], initial: S,
  ): OrcStateMachine<S> {
    return this._getOrCreate(name, () => {
      const builder = new StateMachineBuilder<S>(name, initial);
      for (let i = 0; i < states.length - 1; i++) {
        for (let j = i + 1; j < states.length; j++) {
          builder.transition(states[i]!, states[j]!);
          builder.transition(states[j]!, states[i]!);
        }
      }
      return builder.build();
    });
  }

  primitive<T>(name: string, type: new (...args: unknown[]) => T): T {
    return this._getOrCreate(name, () => new type());
  }

  resultStore(): StepResultStore {
    if (!this._resultStore) this._resultStore = new DefaultStepResultStore();
    return this._resultStore;
  }

  close(): void {
    for (const [, prim] of this._primitives) {
      if (prim && typeof prim === 'object') {
        if ('close' in prim && typeof (prim as Record<string, unknown>).close === 'function') {
          (prim as { close(): void }).close();
        } else if ('signal' in prim && typeof (prim as Record<string, unknown>).signal === 'function') {
          (prim as OrcSignal).signal();
        }
      }
    }
    this._primitives.clear();
  }

  private _getOrCreate<T>(name: string, factory: () => T): T {
    let existing = this._primitives.get(name) as T | undefined;
    if (existing === undefined) {
      existing = factory();
      this._primitives.set(name, existing);
    }
    return existing;
  }
}
