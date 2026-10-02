import type { StepParameter, StepDefinition, StepDefinitionFile, InvokeBinding } from './step-types.js';
import { parseStepParameterType } from '../types.js';
import type { StepParameterType } from '../types.js';
import { RUNTIME_PYTHON, RUNTIME_NODE } from './step-types.js';

// eslint-disable-next-line @typescript-eslint/no-extraneous-class -- Preserve the published static facade.
export class StepDefinitionParser {
  static parse(raw: Record<string, unknown>): StepDefinitionFile {
    const namespace = raw['namespace'] as string | undefined;
    const actionsRaw = raw['actions'] as Record<string, Record<string, unknown>> | undefined;
    if (!actionsRaw) throw new Error('Step definition file must have an actions map');

    const actions: Record<string, StepDefinition> = {};
    for (const [name, actionRaw] of Object.entries(actionsRaw)) {
      actions[name] = StepDefinitionParser.parseAction(name, actionRaw);
    }
    return { ...(namespace !== undefined ? { namespace } : {}), actions };
  }

  static parseAction(name: string, raw: Record<string, unknown>): StepDefinition {
    const description = raw['description'] as string | undefined;
    const inputs = StepDefinitionParser.parseParams(raw['inputs'] as Record<string, unknown> | undefined);
    const outputs = StepDefinitionParser.parseParams(raw['outputs'] as Record<string, unknown> | undefined);
    const invokeRaw = raw['invoke'] as Record<string, unknown> | undefined;
    const invoke = invokeRaw ? StepDefinitionParser.parseInvoke(invokeRaw) : undefined;
    return { name, ...(description !== undefined ? { description } : {}), inputs, outputs, ...(invoke !== undefined ? { invoke } : {}) };
  }

  static parseParams(raw: Record<string, unknown> | undefined): Record<string, StepParameter> {
    if (!raw) return {};
    const result: Record<string, StepParameter> = {};
    for (const [name, paramRaw] of Object.entries(raw)) {
      if (typeof paramRaw === 'string') {
        result[name] = { type: parseStepParameterType(paramRaw), required: false };
      } else if (typeof paramRaw === 'object' && paramRaw !== null) {
        const p = paramRaw as Record<string, unknown>;
        const type: StepParameterType = p['type'] ? parseStepParameterType(p['type'] as string) : 'STRING';
        const defaultValue = (p['defaultValue'] as string | undefined) ?? (p['default'] as string | undefined);
        const allowedValues = (p['allowedValues'] ?? p['enum']) as string[] | undefined;
        const format = p['format'] as string | undefined;
        const desc = p['description'] as string | undefined;
        result[name] = {
          type,
          required: p['required'] === true,
          ...(defaultValue !== undefined ? { defaultValue } : {}),
          ...(allowedValues !== undefined ? { allowedValues } : {}),
          ...(format !== undefined ? { format } : {}),
          ...(desc !== undefined ? { description: desc } : {}),
        };
      }
    }
    return result;
  }

  static parseInvoke(raw: Record<string, unknown>): InvokeBinding {
    if (raw['mcp']) {
      return { kind: 'mcp', tool: raw['mcp'] as string };
    }
    if (raw['python']) {
      const wd = (raw['workingDir'] ?? raw['working-dir']) as string | undefined;
      return {
        kind: 'script', runtime: RUNTIME_PYTHON, script: raw['python'] as string,
        timeout: (raw['timeout'] as string) ?? '30s', env: (raw['env'] as Record<string, string>) ?? {},
        ...(wd !== undefined ? { workingDir: wd } : {}),
      };
    }
    if (raw['node']) {
      const wd = (raw['workingDir'] ?? raw['working-dir']) as string | undefined;
      return {
        kind: 'script', runtime: RUNTIME_NODE, script: raw['node'] as string,
        timeout: (raw['timeout'] as string) ?? '30s', env: (raw['env'] as Record<string, string>) ?? {},
        ...(wd !== undefined ? { workingDir: wd } : {}),
      };
    }
    if (raw['script']) {
      const spec = raw['script'] as Record<string, unknown>;
      const wd = spec['workingDir'] as string | undefined;
      return {
        kind: 'script',
        runtime: spec['runtime'] as string,
        script: spec['script'] as string,
        timeout: (spec['timeout'] as string) ?? '30s',
        ...(wd !== undefined ? { workingDir: wd } : {}),
        env: (spec['env'] as Record<string, string>) ?? {},
      };
    }
    if (raw['graphql']) {
      return { kind: 'graphql', query: raw['graphql'] as string };
    }
    if (raw['rest']) {
      const spec = raw['rest'] as Record<string, unknown>;
      return {
        kind: 'rest',
        method: (spec['method'] as string) ?? 'GET',
        url: spec['url'] as string,
        headers: (spec['headers'] as Record<string, string>) ?? {},
        body: (spec['body'] as Record<string, string>) ?? {},
      };
    }
    if (raw['agent']) {
      const spec = raw['agent'] as Record<string, unknown>;
      const model = spec['model'] as string | undefined;
      const agentTimeout = spec['timeout'] as string | undefined;
      return {
        kind: 'agent',
        descriptor: spec['descriptor'] as string,
        ...(model !== undefined ? { model } : {}),
        ...(agentTimeout !== undefined ? { timeout: agentTimeout } : {}),
        structuredOutput: (spec['structuredOutput'] ?? spec['structured-output']) === true,
      };
    }
    if (raw['process']) {
      const spec = raw['process'] as Record<string, unknown>;
      const processTimeout = spec['timeout'] as string | undefined;
      const processWd = (spec['workingDir'] ?? spec['working-dir']) as string | undefined;
      return {
        kind: 'process',
        command: spec['command'] as string,
        args: (spec['args'] as string[]) ?? [],
        output: (spec['output'] as string) ?? 'json',
        ...(processTimeout !== undefined ? { timeout: processTimeout } : {}),
        env: (spec['env'] as Record<string, string>) ?? {},
        ...(processWd !== undefined ? { workingDir: processWd } : {}),
        onError: ((spec['onError'] ?? spec['on-error']) as string) ?? 'stderr',
      };
    }
    throw new Error(`Unknown invoke binding type. Expected one of: mcp, python, node, script, graphql, rest, agent, process`);
  }
}
