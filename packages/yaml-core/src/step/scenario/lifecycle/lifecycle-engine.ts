import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import type { ScenarioDefinition, StateDefinition } from '../types.js';
import { ScenarioParser } from '../parser.js';

export class LifecycleEngine {
  private readonly definition: ScenarioDefinition;

  constructor(definition: ScenarioDefinition) {
    this.definition = definition;
  }

  get initialState(): string {
    return this.definition.initialState;
  }

  get states(): readonly string[] {
    return [...this.definition.states.keys()];
  }

  canTransition(currentState: string, targetState: string): boolean {
    const state = this.definition.states.get(currentState);
    if (!state) return false;
    return this.reachableTargets(state).includes(targetState);
  }

  validateTransition(currentState: string, targetState: string): void {
    if (!this.canTransition(currentState, targetState)) {
      throw new Error(
        `Cannot transition from '${currentState}' to '${targetState}'`
      );
    }
  }

  availableTransitions(currentState: string): readonly string[] {
    const state = this.definition.states.get(currentState);
    if (!state) {
      throw new Error(`Unknown state: '${currentState}'`);
    }
    return this.reachableTargets(state);
  }

  private reachableTargets(state: StateDefinition): string[] {
    const targets: string[] = [];
    if (state.next) {
      targets.push(state.next);
    }
    for (const transition of Object.values(state.events)) {
      if (transition.type === 'simple' || transition.type === 'guarded') {
        if (!targets.includes(transition.target)) {
          targets.push(transition.target);
        }
      } else if (transition.type === 'match-based') {
        for (const c of transition.cases) {
          if (!targets.includes(c.target)) {
            targets.push(c.target);
          }
        }
      }
    }
    return targets;
  }
}

export function defaultLifecycleEngine(): LifecycleEngine {
  const dir = dirname(fileURLToPath(import.meta.url));
  const yamlPath = resolve(dir, 'default-lifecycle.yaml');
  const raw = parseYaml(readFileSync(yamlPath, 'utf-8')) as Record<string, unknown>;
  const name = (raw['name'] as string) ?? 'script-lifecycle';
  const definition = ScenarioParser.parse(name, raw);
  return new LifecycleEngine(definition);
}
