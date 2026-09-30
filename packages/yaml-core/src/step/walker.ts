import type { MatchPattern } from '../match.js';

export interface CatalogEntry {
  qualifiedName: string;
  definition: import('./types').Definition;
  action: Action;
}

export interface Action {
  execute(params: Record<string, unknown>, services: ServiceRegistry): Promise<Result>;
}

export type Result =
  | { kind: 'success'; output: Record<string, unknown>; executionMetadata: Record<string, unknown> }
  | { kind: 'failure'; message: string };

export function stepSuccess(output: Record<string, unknown>, metadata?: Record<string, unknown>): Result {
  return { kind: 'success', output, executionMetadata: metadata ?? {} };
}

export function stepFailure(message: string): Result {
  return { kind: 'failure', message };
}

export interface ServiceRegistry {
  lookup<T>(type: { new(...args: unknown[]): T } | { readonly name: string }): T;
}

export class MapServiceRegistry implements ServiceRegistry {
  private readonly services = new Map<string, unknown>();

  register<T>(type: { readonly name: string }, instance: T): MapServiceRegistry {
    this.services.set(type.name, instance);
    return this;
  }

  lookup<T>(type: { readonly name: string }): T {
    const svc = this.services.get(type.name);
    if (svc === undefined) throw new Error(`Service '${type.name}' not found in registry`);
    return svc as T;
  }
}

export interface Catalog {
  resolve(actionName: string): CatalogEntry | undefined;
  availableActions(): Set<string>;
}

export interface SelectBranch {
  type: 'subscribe' | 'wait';
  name: string;
  steps: ResolvedStep[];
}

export interface ResolvedMatchCase {
  pattern: MatchPattern;
  guard: string | null;
  steps: ResolvedStep[];
}

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
  | QuorumStep;

export interface PluginStep {
  kind: 'plugin';
  name: string | null;
  entry: CatalogEntry;
  params: Record<string, unknown>;
  decorators: Record<string, unknown>;
}

export interface InvokeStep {
  kind: 'invoke';
  name: string | null;
  invokeSpec: Record<string, unknown>;
  decorators: Record<string, unknown>;
}

export interface BlockStep {
  kind: 'block';
  name: string | null;
  steps: ResolvedStep[];
  decorators: Record<string, unknown>;
}

export interface IfElseStep {
  kind: 'if-else';
  name: string | null;
  condition: string;
  thenSteps: ResolvedStep[];
  elseSteps: ResolvedStep[];
  decorators: Record<string, unknown>;
}

export interface MatchStep {
  kind: 'match';
  name: string | null;
  scrutinee: string;
  cases: ResolvedMatchCase[];
  decorators: Record<string, unknown>;
}

export interface ParallelStep {
  kind: 'parallel';
  name: string | null;
  steps: ResolvedStep[];
  decorators: Record<string, unknown>;
}

export interface TryCatchFinallyStep {
  kind: 'try-catch-finally';
  name: string | null;
  trySteps: ResolvedStep[];
  catchSteps: ResolvedStep[];
  finallySteps: ResolvedStep[];
  decorators: Record<string, unknown>;
}

export interface SelectStep {
  kind: 'select';
  name: string | null;
  branches: SelectBranch[];
  decorators: Record<string, unknown>;
}

export interface BarrierStep {
  kind: 'barrier';
  name: string | null;
  awaitSteps: string[];
  timeout?: number;
  decorators: Record<string, unknown>;
}

export interface QuorumStep {
  kind: 'quorum';
  name: string | null;
  required: number;
  ofSteps: string[];
  timeout?: number;
  decorators: Record<string, unknown>;
}

const RESERVED_KEYS = new Set([
  'step', 'invoke', 'if', 'then', 'else', 'match', 'cases', 'block',
  'try', 'catch', 'finally', 'select',
  'on-success', 'on-failure', 'forEach', 'loop',
  'retry', 'timeout', 'delay', 'on-error', 'trigger',
  'transform', 'signal', 'publish', 'transition',
  'parallel', 'semaphore', 'barrier', 'quorum', 'race',
]);

const DECORATOR_KEYS = new Set([
  'if', 'on-success', 'on-failure', 'forEach', 'loop',
  'retry', 'timeout', 'delay', 'on-error', 'trigger',
  'transform', 'signal', 'publish', 'transition',
  'semaphore', 'barrier', 'quorum', 'race',
]);

const STRUCTURAL_COMPANIONS = new Set(['then', 'else', 'cases', 'catch', 'finally']);

const REMOVED_KEYS = new Set(['steps']);

const MAX_DEPTH = 32;

export class Walker {
  static resolve(steps: Record<string, unknown>[], catalog: Catalog): ResolvedStep[] {
    const seenNames = new Set<string>();
    const resolved = Walker.resolveAtDepth(steps, catalog, 0, seenNames);
    Walker.validateRefs(resolved, seenNames);
    return resolved;
  }

  private static resolveAtDepth(
    steps: Record<string, unknown>[], catalog: Catalog, depth: number,
    seenNames: Set<string> = new Set(),
  ): ResolvedStep[] {
    if (depth > MAX_DEPTH) throw new Error(`Step nesting exceeds maximum depth of ${MAX_DEPTH}`);
    return steps.map(step => Walker.resolveOne(step, catalog, depth, seenNames));
  }

  private static resolveOne(
    step: Record<string, unknown>, catalog: Catalog, depth: number,
    seenNames: Set<string> = new Set(),
  ): ResolvedStep {
    let stepName: string | null = null;
    let structuralType: string | null = null;
    let structuralValue: unknown = undefined;
    let actionKey: string | null = null;
    let actionValue: unknown = undefined;
    let invokeSpec: Record<string, unknown> | null = null;
    const decorators: Record<string, unknown> = {};
    const companions: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(step)) {
      if (REMOVED_KEYS.has(key)) {
        throw new Error(`'${key}' is no longer valid — use 'do' for nested action lists`);
      }
      if (key === 'step') {
        stepName = value as string;
        if (stepName !== null && seenNames.has(stepName)) {
          throw new Error(`Duplicate step name '${stepName}'`);
        }
        if (stepName !== null) seenNames.add(stepName);
      } else if (key === 'invoke') {
        invokeSpec = value as Record<string, unknown>;
      } else if (key === 'block' || key === 'parallel' || key === 'try' || key === 'select') {
        structuralType = key;
        structuralValue = value;
      } else if (key === 'if' && step['then'] !== undefined) {
        structuralType = 'if';
        structuralValue = value;
      } else if (key === 'match' && step['cases'] !== undefined) {
        structuralType = 'match';
        structuralValue = value;
      } else if (STRUCTURAL_COMPANIONS.has(key)) {
        companions[key] = value;
      } else if (key === 'barrier' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        structuralType = 'barrier';
        structuralValue = value;
      } else if (key === 'quorum' && typeof value === 'object' && value !== null && !Array.isArray(value)) {
        structuralType = 'quorum';
        structuralValue = value;
      } else if (DECORATOR_KEYS.has(key) && !(key === 'if' && step['then'] !== undefined)) {
        decorators[key] = value;
      } else if (!RESERVED_KEYS.has(key)) {
        const entry = catalog.resolve(key);
        if (entry) {
          actionKey = key;
          actionValue = value;
        } else {
          throw new Error(`Unknown step key '${key}' — not a reserved keyword and not found in catalog`);
        }
      }
    }

    if (structuralType && actionKey) {
      throw new Error(`Step has both structural type '${structuralType}' and action key '${actionKey}'`);
    }
    if (structuralType && invokeSpec) {
      throw new Error(`Step has both structural type '${structuralType}' and invoke`);
    }

    if (structuralType === 'block') {
      const substeps = Walker.resolveAtDepth(structuralValue as Record<string, unknown>[], catalog, depth + 1, seenNames);
      return { kind: 'block', name: stepName, steps: substeps, decorators };
    }

    if (structuralType === 'parallel') {
      const substeps = Walker.resolveAtDepth(structuralValue as Record<string, unknown>[], catalog, depth + 1, seenNames);
      return { kind: 'parallel', name: stepName, steps: substeps, decorators };
    }

    if (structuralType === 'if') {
      const thenRaw = (companions['then'] as Record<string, unknown>[] | undefined) ?? [];
      const elseRaw = (companions['else'] as Record<string, unknown>[] | undefined) ?? [];
      const thenSteps = Walker.resolveAtDepth(thenRaw, catalog, depth + 1, seenNames);
      const elseSteps = Walker.resolveAtDepth(elseRaw, catalog, depth + 1, seenNames);
      return { kind: 'if-else', name: stepName, condition: structuralValue as string, thenSteps, elseSteps, decorators };
    }

    if (structuralType === 'match') {
      const casesRaw = companions['cases'] as Record<string, unknown>[];
      if (!casesRaw) throw new Error('match requires cases');
      const cases: ResolvedMatchCase[] = casesRaw.map((c, i) => {
        let pattern: MatchPattern;
        let caseSteps: ResolvedStep[];
        if ('default' in c) {
          pattern = { type: 'default' };
          caseSteps = Walker.resolveAtDepth(
            (c['default'] as Record<string, unknown>[] | undefined) ?? [], catalog, depth + 1, seenNames);
        } else {
          pattern = Walker.parsePattern(c['pattern'] ?? c['when']);
          caseSteps = Walker.resolveAtDepth(
            (c['do'] as Record<string, unknown>[] | undefined) ?? [], catalog, depth + 1, seenNames);
        }
        const guard = (c['guard'] as string) ?? null;
        if (pattern.type === 'default' && i !== casesRaw.length - 1) {
          throw new Error('Default case must be last in match');
        }
        return { pattern, guard, steps: caseSteps };
      });
      return { kind: 'match', name: stepName, scrutinee: structuralValue as string, cases, decorators };
    }

    if (structuralType === 'try') {
      const trySteps = Walker.resolveAtDepth(structuralValue as Record<string, unknown>[], catalog, depth + 1, seenNames);
      const catchRaw = (companions['catch'] as Record<string, unknown>[] | undefined) ?? [];
      const finallyRaw = (companions['finally'] as Record<string, unknown>[] | undefined) ?? [];
      const catchSteps = Walker.resolveAtDepth(catchRaw, catalog, depth + 1, seenNames);
      const finallySteps = Walker.resolveAtDepth(finallyRaw, catalog, depth + 1, seenNames);
      return { kind: 'try-catch-finally', name: stepName, trySteps, catchSteps, finallySteps, decorators };
    }

    if (structuralType === 'select') {
      const branchesRaw = structuralValue as Record<string, unknown>[];
      const branches: SelectBranch[] = branchesRaw.map(b => {
        if (b['subscribe']) {
          const sub = b['subscribe'] as Record<string, unknown> | string;
          const channelName = typeof sub === 'string' ? sub : (sub['channel'] as string);
          const subSteps = Walker.resolveAtDepth(
            (b['do'] as Record<string, unknown>[] | undefined) ?? [], catalog, depth + 1, seenNames);
          return { type: 'subscribe' as const, name: channelName, steps: subSteps };
        }
        if (b['wait']) {
          const waitSteps = Walker.resolveAtDepth(
            (b['do'] as Record<string, unknown>[] | undefined) ?? [], catalog, depth + 1, seenNames);
          return { type: 'wait' as const, name: b['wait'] as string, steps: waitSteps };
        }
        throw new Error('Select branch must have subscribe or wait');
      });
      return { kind: 'select', name: stepName, branches, decorators };
    }

    if (structuralType === 'barrier') {
      const barrierVal = structuralValue as Record<string, unknown>;
      const awaitSteps = barrierVal['await'] as string[];
      const timeoutRaw = barrierVal['timeout'] as string | undefined;
      const timeout = timeoutRaw ? parseDurationMs(timeoutRaw) : undefined;
      return { kind: 'barrier', name: stepName, awaitSteps, ...(timeout !== undefined ? { timeout } : {}), decorators };
    }

    if (structuralType === 'quorum') {
      const quorumVal = structuralValue as Record<string, unknown>;
      const required = quorumVal['required'] as number;
      const ofSteps = quorumVal['of'] as string[];
      const timeoutRaw = quorumVal['timeout'] as string | undefined;
      const timeout = timeoutRaw ? parseDurationMs(timeoutRaw) : undefined;
      return { kind: 'quorum', name: stepName, required, ofSteps, ...(timeout !== undefined ? { timeout } : {}), decorators };
    }

    if (invokeSpec) {
      return { kind: 'invoke', name: stepName, invokeSpec, decorators };
    }

    if (actionKey) {
      const entry = catalog.resolve(actionKey)!;
      const params = (typeof actionValue === 'object' && actionValue !== null && !Array.isArray(actionValue))
        ? actionValue as Record<string, unknown>
        : {};
      return { kind: 'plugin', name: stepName, entry, params, decorators };
    }

    throw new Error(`Step could not be resolved: no structural type, invoke, or catalog action found. Keys: ${Object.keys(step).join(', ')}`);
  }

  private static validateRefs(steps: ResolvedStep[], knownNames: Set<string>): void {
    for (const step of steps) {
      if (step.kind === 'barrier') {
        for (const ref of step.awaitSteps) {
          if (!knownNames.has(ref)) {
            throw new Error(`Barrier references unknown step '${ref}'`);
          }
        }
      } else if (step.kind === 'quorum') {
        for (const ref of step.ofSteps) {
          if (!knownNames.has(ref)) {
            throw new Error(`Quorum references unknown step '${ref}'`);
          }
        }
      }
      if ('steps' in step && Array.isArray(step.steps)) {
        Walker.validateRefs(step.steps, knownNames);
      }
      if (step.kind === 'if-else') {
        Walker.validateRefs(step.thenSteps, knownNames);
        Walker.validateRefs(step.elseSteps, knownNames);
      }
      if (step.kind === 'try-catch-finally') {
        Walker.validateRefs(step.trySteps, knownNames);
        Walker.validateRefs(step.catchSteps, knownNames);
        Walker.validateRefs(step.finallySteps, knownNames);
      }
      if (step.kind === 'match') {
        for (const c of step.cases) Walker.validateRefs(c.steps, knownNames);
      }
      if (step.kind === 'select') {
        for (const b of step.branches) Walker.validateRefs(b.steps, knownNames);
      }
    }
  }

  private static parsePattern(raw: unknown): MatchPattern {
    if (raw === undefined || raw === null || raw === 'default' || raw === '_') {
      return { type: 'default' };
    }
    if (Array.isArray(raw)) {
      return { type: 'any-of', values: [...raw] };
    }
    if (typeof raw === 'object') {
      return { type: 'structural', fields: { ...raw as Record<string, unknown> } };
    }
    return { type: 'value', value: raw };
  }
}

function parseDurationMs(duration: string): number {
  const match = duration.match(/^(\d+)(ms|s|m|h)$/);
  if (!match) return parseInt(duration, 10);
  const [, numStr, unit] = match;
  const num = parseInt(numStr!, 10);
  switch (unit) {
    case 'ms': return num;
    case 's': return num * 1000;
    case 'm': return num * 60_000;
    case 'h': return num * 3_600_000;
    default: return num;
  }
}
