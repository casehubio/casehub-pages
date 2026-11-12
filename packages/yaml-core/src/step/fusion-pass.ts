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
