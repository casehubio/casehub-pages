import type { SimulationConfig, CorpusDatum, CorpusEntry } from '../step/simulation-runtime.js';

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

export class SimulateBlockParser {
  static parse(raw: Record<string, unknown>): SimulationConfig {
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
}
