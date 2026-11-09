import type { SessionPipeline, AgentSession, AgentSessionInit, ClearingPolicy }
  from '../../step/invoke/session-pipeline.js';
import type { SimulationCorpus } from '../corpus.js';
import type { SimulationConfig } from '../config.js';
import { SimulatedAgentSession } from './simulated-session.js';
import { LookupCountSelector } from '../selectors/lookup-count.js';
import { StateMachineSelector } from '../selectors/state-machine.js';
import { DurationSelector } from '../selectors/duration.js';
import { RandomSelector } from '../selectors/weighted.js';
import type { CorpusSelector } from '../selectors/corpus-selector.js';

export class SimulatedSessionPipeline implements SessionPipeline {
  private readonly sessions = new Map<string, SimulatedAgentSession>();

  constructor(
    private readonly corpus: SimulationCorpus<unknown, unknown>,
    private readonly config: SimulationConfig,
    private readonly speedSupplier: () => number = () => 1,
  ) {}

  async openSession(name: string, _init: AgentSessionInit, _clearingPolicy: ClearingPolicy): Promise<void> {
    const qn = `agent-session.${name}`;
    const selectorConfig = this.config.corpusSelection(qn);
    let selector: CorpusSelector | undefined;
    if (selectorConfig) {
      switch (selectorConfig.kind) {
        case 'state-machine':
          selector = new StateMachineSelector(selectorConfig.initial, selectorConfig.transitions);
          break;
        case 'lookup-count':
          selector = new LookupCountSelector(selectorConfig.orderedPhases);
          break;
        case 'duration':
          selector = new DurationSelector(selectorConfig.orderedPhases, this.speedSupplier);
          break;
        case 'weighted':
          selector = new RandomSelector(selectorConfig.weightedPhases);
          break;
      }
    }
    this.sessions.set(name, new SimulatedAgentSession(this.corpus, qn, selector));
  }

  sessionFor(name: string): AgentSession | undefined {
    return this.sessions.get(name);
  }

  async releaseSession(name: string): Promise<void> {
    this.sessions.delete(name);
  }
}
