import type { StepParameter, StepDefinition, StepDefinitionFile, InvokeBinding } from './step-types.js';
import { parseStepParameterType } from '../types.js';
import type { StepParameterType } from '../types.js';
import { RUNTIME_PYTHON, RUNTIME_NODE } from './step-types.js';

export class StepDefinitionParser {
  static parse(raw: Record<string, unknown>): StepDefinitionFile {
    const namespace = raw['namespace'] as string | undefined;
    const actionsRaw = raw['actions'] as Record<string, Record<string, unknown>> | undefined;
    if (!actionsRaw) throw new Error('Step definition file must have an actions map');

    const actions: Record<string, StepDefinition> = {};
    for (const [name, actionRaw] of Object.entries(actionsRaw)) {
      actions[name] = StepDefinitionParser.parseAction(name, actionRaw);
    }
    return { namespace, actions };
  }

  static parseAction(name: string, raw: Record<string, unknown>): StepDefinition {
    const description = raw['description'] as string | undefined;
    const inputs = StepDefinitionParser.parseParams(raw['inputs'] as Record<string, unknown> | undefined);
    const outputs = StepDefinitionParser.parseParams(raw['outputs'] as Record<string, unknown> | undefined);
    const invokeRaw = raw['invoke'] as Record<string, unknown> | undefined;
    const invoke = invokeRaw ? StepDefinitionParser.parseInvoke(invokeRaw) : undefined;
    return { name, description, inputs, outputs, invoke };
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
        result[name] = {
          type,
          required: p['required'] === true,
          defaultValue: p['defaultValue'] as string | undefined ?? p['default'] as string | undefined,
          allowedValues: p['allowedValues'] as string[] | undefined,
          format: p['format'] as string | undefined,
          description: p['description'] as string | undefined,
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
      return {
        kind: 'script', runtime: RUNTIME_PYTHON, script: raw['python'] as string,
        timeout: (raw['timeout'] as string) ?? '30s', env: (raw['env'] as Record<string, string>) ?? {},
        workingDir: raw['workingDir'] as string | undefined,
      };
    }
    if (raw['node']) {
      return {
        kind: 'script', runtime: RUNTIME_NODE, script: raw['node'] as string,
        timeout: (raw['timeout'] as string) ?? '30s', env: (raw['env'] as Record<string, string>) ?? {},
        workingDir: raw['workingDir'] as string | undefined,
      };
    }
    if (raw['script']) {
      const spec = raw['script'] as Record<string, unknown>;
      return {
        kind: 'script',
        runtime: spec['runtime'] as string,
        script: spec['script'] as string,
        timeout: (spec['timeout'] as string) ?? '30s',
        workingDir: spec['workingDir'] as string | undefined,
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
      return {
        kind: 'agent',
        descriptor: spec['descriptor'] as string,
        model: spec['model'] as string | undefined,
        timeout: spec['timeout'] as string | undefined,
        structuredOutput: spec['structuredOutput'] === true,
      };
    }
    if (raw['process']) {
      const spec = raw['process'] as Record<string, unknown>;
      return {
        kind: 'process',
        command: spec['command'] as string,
        args: (spec['args'] as string[]) ?? [],
        output: (spec['output'] as string) ?? 'json',
        timeout: spec['timeout'] as string | undefined,
        env: (spec['env'] as Record<string, string>) ?? {},
        workingDir: spec['workingDir'] as string | undefined,
        onError: (spec['onError'] as string) ?? 'stderr',
      };
    }
    throw new Error(`Unknown invoke binding type. Expected one of: mcp, python, node, script, graphql, rest, agent, process`);
  }
}
