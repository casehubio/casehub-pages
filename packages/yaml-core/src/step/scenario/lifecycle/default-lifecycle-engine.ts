import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';
import { ScenarioParser } from '../parser.js';
import { LifecycleEngine } from './lifecycle-engine.js';

export function defaultLifecycleEngine(): LifecycleEngine {
  const dir = dirname(fileURLToPath(import.meta.url));
  const yamlPath = resolve(dir, 'default-lifecycle.yaml');
  const raw = parseYaml(readFileSync(yamlPath, 'utf-8')) as Record<string, unknown>;
  const name = (raw['name'] as string) ?? 'script-lifecycle';
  const definition = ScenarioParser.parse(name, raw);
  return new LifecycleEngine(definition);
}
