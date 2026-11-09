import { MapSimulationConfig } from '../simulation/config.js';
import type { MapSimulationConfigInit } from '../simulation/config.js';
import { InMemorySimulationCorpus } from '../simulation/in-memory-corpus.js';
import type { ExhaustionPolicy, CorpusSelectorConfig, InvocationRecord } from '../simulation/types.js';

export interface CorpusDatum {
  input: unknown;
  output: unknown;
  realism?: import('../simulation/types.js').DataRealism;
}

export type CorpusEntry =
  | { file: string }
  | { inline: Record<string, CorpusDatum[]> };

export interface LegacySimulationConfig {
  strategies: Record<string, string>;
  corpus: CorpusEntry[];
  capture: string[];
  fallthroughRealism?: Record<string, import('../simulation/types.js').DataRealism>;
}

interface AliasSpec {
  qualifiedName: string;
  mapFields?: (entry: Record<string, unknown>) => CorpusDatum;
}

const ALIAS_TABLE: Record<string, AliasSpec> = {
  agent: {
    qualifiedName: 'agent-provider.invoke',
    mapFields: (entry) => ({
      input: { key: entry['prompt'] },
      output: entry['response'] as unknown,
    }),
  },
  rest: { qualifiedName: 'rest-request' },
  graphql: { qualifiedName: 'graphql' },
  mcp: { qualifiedName: 'mcp-call' },
  process: { qualifiedName: 'process-exec' },
};

function parseDelayString(raw: unknown): number {
  if (typeof raw === 'number') return raw;
  if (typeof raw !== 'string') return 0;
  const s = raw.trim();
  if (s.endsWith('ms')) return parseInt(s.slice(0, -2), 10) || 0;
  if (s.endsWith('s')) return (parseFloat(s.slice(0, -1)) || 0) * 1000;
  return parseInt(s, 10) || 0;
}

const VALID_EXHAUSTION_POLICIES = new Set(['WRAP', 'THROW', 'CLAMP']);

function parseSelection(raw: Record<string, unknown>): CorpusSelectorConfig | undefined {
  const sel = raw['selection'] as Record<string, unknown> | undefined;
  if (!sel) return undefined;

  const kind = sel['kind'] as string;
  const rawPhases = sel['phases'] as Record<string, unknown> | undefined;
  const phases = new Map<string, InvocationRecord<unknown, unknown>[]>();
  if (rawPhases) {
    for (const [name, _value] of Object.entries(rawPhases)) {
      phases.set(name, []);
    }
  }

  switch (kind) {
    case 'state-machine': {
      const initial = (sel['initial'] as string) ?? '';
      const rawTransitions = sel['transitions'] as Record<string, Record<string, string>> | undefined;
      const transitions = new Map<string, Map<string, string>>();
      if (rawTransitions) {
        for (const [state, triggers] of Object.entries(rawTransitions)) {
          transitions.set(state, new Map(Object.entries(triggers)));
        }
      }
      return { kind: 'state-machine', initial, transitions, phases };
    }
    case 'lookup-count': {
      const orderedPhases = rawPhases
        ? Object.entries(rawPhases).map(([name, count]) => ({ name, count: Number(count) }))
        : [];
      return { kind: 'lookup-count', orderedPhases, phases };
    }
    case 'duration': {
      const orderedPhases = rawPhases
        ? Object.entries(rawPhases).map(([name, duration]) => ({ name, durationMs: parseDelayString(duration) }))
        : [];
      return { kind: 'duration', orderedPhases, phases };
    }
    case 'weighted': {
      const weightedPhases = rawPhases
        ? Object.entries(rawPhases).map(([name, weight]) => ({ name, weight: Number(weight) }))
        : [];
      return { kind: 'weighted', weightedPhases, phases };
    }
    default:
      return undefined;
  }
}

export interface SimulationParseResult {
  config: MapSimulationConfig;
  corpus: InMemorySimulationCorpus<unknown, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Preserve the published static facade.
export class SimulateBlockParser {
  static parse(raw: Record<string, unknown>): LegacySimulationConfig {
    const strategies: Record<string, string> = {};
    const corpusEntries: Record<string, CorpusDatum[]> = {};

    for (const [key, value] of Object.entries(raw)) {
      if (key === 'capture') continue;
      const alias = ALIAS_TABLE[key];
      const qualifiedName = alias ? alias.qualifiedName : key;
      const spec = value as Record<string, unknown>;

      strategies[qualifiedName] = (spec['strategy'] as string) ?? 'sequential';

      if (Array.isArray(spec['corpus'])) {
        const mapFn = alias?.mapFields;
        corpusEntries[qualifiedName] = (spec['corpus'] as Record<string, unknown>[]).map(entry => {
          if (mapFn) return mapFn(entry);
          return { input: entry['input'], output: entry['output'] } as CorpusDatum;
        });
      }
    }

    const corpus: CorpusEntry[] = Object.keys(corpusEntries).length > 0
      ? [{ inline: corpusEntries }]
      : [];

    return {
      strategies,
      corpus,
      capture: Array.isArray(raw['capture']) ? raw['capture'] as string[] : [],
    };
  }

  static parseToSimulation(raw: Record<string, unknown>): SimulationParseResult {
    const strategies: Record<string, string> = {};
    const exhaustionPolicies: Record<string, ExhaustionPolicy> = {};
    const corpusSelections: Record<string, CorpusSelectorConfig> = {};
    const corpus = new InMemorySimulationCorpus<unknown, unknown>();
    const capture: string[] = Array.isArray(raw['capture']) ? raw['capture'] as string[] : [];

    for (const [key, value] of Object.entries(raw)) {
      if (key === 'capture') continue;
      const alias = ALIAS_TABLE[key];
      const qualifiedName = alias ? alias.qualifiedName : key;
      const spec = value as Record<string, unknown>;

      strategies[qualifiedName] = (spec['strategy'] as string) ?? 'sequential';

      if (spec['exhaustion']) {
        const ep = String(spec['exhaustion']).toUpperCase();
        if (!VALID_EXHAUSTION_POLICIES.has(ep)) {
          throw new Error(`Unknown exhaustion policy: '${spec['exhaustion']}'`);
        }
        exhaustionPolicies[qualifiedName] = ep as ExhaustionPolicy;
      }

      const selection = parseSelection(spec);
      if (selection) {
        corpusSelections[qualifiedName] = selection;
      }

      if (Array.isArray(spec['corpus'])) {
        const mapFn = alias?.mapFields;
        for (const entry of spec['corpus'] as Record<string, unknown>[]) {
          let input: unknown;
          let output: unknown;

          if (mapFn) {
            const mapped = mapFn(entry);
            input = mapped.input;
            output = mapped.output;
          } else {
            input = entry['input'];
            output = entry['output'];
          }

          if (entry['streaming']) {
            const streamSpec = entry['streaming'] as Record<string, unknown>;
            output = {
              text: typeof output === 'string' ? output : String(output),
              chunkStrategy: (streamSpec['chunkStrategy'] as string) ?? 'word',
              delayMs: parseDelayString(streamSpec['delay']),
              inputTokens: streamSpec['inputTokens'] as number | undefined,
              outputTokens: streamSpec['outputTokens'] as number | undefined,
            };
          }

          corpus.record(qualifiedName, '', input, output);
        }
      }
    }

    const init: MapSimulationConfigInit = {
      strategies,
      capture,
      exhaustionPolicies: Object.keys(exhaustionPolicies).length > 0 ? exhaustionPolicies : undefined,
      corpusSelections: Object.keys(corpusSelections).length > 0 ? corpusSelections : undefined,
    };

    return { config: new MapSimulationConfig(init), corpus };
  }
}

export function legacyConfigToSimulation(legacy: LegacySimulationConfig): SimulationParseResult {
  const corpus = new InMemorySimulationCorpus<unknown, unknown>();

  for (const entry of legacy.corpus) {
    if ('inline' in entry) {
      for (const [qualifiedName, data] of Object.entries(entry.inline)) {
        for (const datum of data) {
          corpus.record(qualifiedName, '', datum.input, datum.output);
        }
      }
    }
  }

  const init: MapSimulationConfigInit = {
    strategies: legacy.strategies,
    capture: legacy.capture,
    fallthroughRealism: legacy.fallthroughRealism,
  };

  return { config: new MapSimulationConfig(init), corpus };
}
