import { parse } from 'yaml';
import type { Scenario } from './types.js';

export function parseScenario(yamlString: string): Scenario {
  const parsed = parse(yamlString) as Scenario;
  if (!parsed.scenario || !Array.isArray(parsed.steps)) {
    throw new Error('Invalid scenario: must have "scenario" name and "steps" array');
  }
  return parsed;
}
