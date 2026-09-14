export type ParameterType = 'STRING' | 'LIST' | 'INTEGER' | 'NUMBER' | 'BOOLEAN';

export interface YamlModuleParameter {
  type: ParameterType;
  required: boolean;
  defaultValue?: string;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minimum?: number;
  maximum?: number;
  allowedValues?: string[];
  constraintDescription?: string;
}

export interface YamlModuleOutput {
  type: ParameterType;
  value: string;
}

export interface YamlModule {
  name: string;
  parameters: Record<string, YamlModuleParameter>;
  outputs: Record<string, YamlModuleOutput>;
  sections: Record<string, Record<string, unknown>>;
}

export interface YamlImport {
  module: string;
  as: string;
  when?: string | undefined;
  parameters: Record<string, string>;
}

export interface IterationGroup {
  as?: string | undefined;
  in: unknown[];
}

export type ForEachDirective =
  | { type: 'inline'; as: string; in: unknown[] }
  | { type: 'group-ref'; groupName: string; as?: string | undefined };

export type VariableSource = (key: string) => string | undefined;

export type DeferredPrefixHandler = (prefix: string, key: string, elementContext: string) => void;

export interface ExpansionDiagnostic {
  severity: 'error' | 'warning';
  message: string;
  path: string[];
  category: 'unresolved-variable' | 'invalid-parameter' | 'circular-module'
    | 'unknown-prefix' | 'expansion-error';
}

export interface ExpandResult {
  map: Record<string, unknown>;
  diagnostics: ExpansionDiagnostic[];
}

export class UnresolvedVariableError extends Error {
  constructor(
    public readonly variableName: string,
    public readonly elementContext: string,
    detail: string,
  ) {
    super(`Unresolved variable '${variableName}' in element '${elementContext}'. ${detail}`);
    this.name = 'UnresolvedVariableError';
  }
}

export function chainSources(...sources: VariableSource[]): VariableSource {
  return (name: string) => {
    for (const source of sources) {
      const value = source(name);
      if (value !== undefined) return value;
    }
    return undefined;
  };
}

function drillFields(map: Record<string, unknown>, dotPath: string): unknown {
  let current: unknown = map;
  for (const part of dotPath.split('.')) {
    if (current !== null && typeof current === 'object' && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

export function nestedSource(data: Record<string, Record<string, unknown>>): VariableSource {
  return (name: string) => {
    const dot = name.indexOf('.');
    const key = dot >= 0 ? name.substring(0, dot) : name;
    const entry = data[key];
    if (entry === undefined) return undefined;
    if (dot < 0) return String(entry);
    const value = drillFields(entry, name.substring(dot + 1));
    return value !== undefined ? String(value) : undefined;
  };
}

export function forEachContextSource(
  simple: Record<string, string> | null,
  rows: Record<string, Record<string, unknown>> | null,
): VariableSource {
  return (name: string) => {
    const dot = name.indexOf('.');
    if (dot >= 0 && rows) {
      const rowName = name.substring(0, dot);
      const row = rows[rowName];
      if (row) {
        const fieldPath = name.substring(dot + 1);
        const value = drillFields(row, fieldPath);
        if (value !== undefined) return String(value);
        throw new Error(
          `Field '${fieldPath}' not found in '${rowName}'. Available: ${Object.keys(row).join(', ')}`,
        );
      }
    }
    if (simple) {
      const value = simple[name];
      if (value !== undefined) return value;
    }
    if (rows && rows[name] !== undefined) {
      throw new Error(
        `'${name}' is a row — use field access like \${each.${name}.fieldName}. Available: ${Object.keys(rows[name]!).join(', ')}`,
      );
    }
    return undefined;
  };
}

export function parseForEachDirective(raw: unknown): ForEachDirective | null {
  if (raw == null) return null;
  if (typeof raw === 'string') return { type: 'group-ref', groupName: raw };
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const m = raw as Record<string, unknown>;
    const as = m['as'] as string | undefined;
    const inVal = m['in'];
    if (Array.isArray(inVal)) {
      if (!as) throw new Error("Inline forEach 'as' variable name is required");
      return { type: 'inline', as, in: inVal };
    }
    if (typeof inVal === 'string') return { type: 'group-ref', groupName: inVal, as };
    if (as) return { type: 'group-ref', groupName: as };
  }
  throw new Error(
    `Invalid forEach value: expected string, {as, in} map, or ForEachDirective — got ${typeof raw}`,
  );
}
