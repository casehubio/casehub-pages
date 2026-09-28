import type { StepParameterType } from '../types.js';

export interface StepParameter {
  type: StepParameterType;
  required: boolean;
  defaultValue?: string;
  allowedValues?: string[];
  format?: string;
  description?: string;
}

export type InvokeBinding =
  | McpBinding
  | RestBinding
  | GraphqlBinding
  | ScriptBinding
  | AgentBinding
  | ProcessBinding;

export interface McpBinding {
  kind: 'mcp';
  tool: string;
}

export interface RestBinding {
  kind: 'rest';
  method: string;
  url: string;
  headers: Record<string, string>;
  body: Record<string, string>;
}

export interface GraphqlBinding {
  kind: 'graphql';
  query: string;
}

export interface ScriptBinding {
  kind: 'script';
  runtime: string;
  script: string;
  timeout: string;
  workingDir?: string;
  env: Record<string, string>;
}

export interface AgentBinding {
  kind: 'agent';
  descriptor: string;
  model?: string;
  timeout?: string;
  structuredOutput: boolean;
}

export interface ProcessBinding {
  kind: 'process';
  command: string;
  args: string[];
  output: string;
  timeout?: string;
  env: Record<string, string>;
  workingDir?: string;
  onError: string;
}

export interface StepDefinition {
  name: string;
  description?: string;
  inputs: Record<string, StepParameter>;
  outputs: Record<string, StepParameter>;
  invoke?: InvokeBinding;
}

export interface StepDefinitionFile {
  namespace?: string;
  actions: Record<string, StepDefinition>;
}

export const RUNTIME_PYTHON = 'python3';
export const RUNTIME_NODE = 'node';
