import { z } from 'zod';

export interface CompletionEntry {
  label: string;
  detail?: string;
  type: 'property' | 'enum';
  apply?: string;
}

export interface YamlContext {
  path: string[];
  siblings: Record<string, string>;
}

function getIndentLevel(line: string): number {
  const match = line.match(/^(\s*)/);
  return match?.[1]?.length ?? 0;
}

function extractKeyValue(line: string): { key: string; value: string } | null {
  const trimmed = line.trim().replace(/^-\s*/, '');
  const match = trimmed.match(/^(\w[\w-]*):\s*(.*)/);
  if (!match) return null;
  return { key: match[1]!, value: (match[2] ?? '').trim() };
}

function effectiveIndent(line: string): number {
  const base = getIndentLevel(line);
  if (line.substring(base).startsWith('- ')) {
    return base + 2;
  }
  return base;
}

export function buildYamlContext(doc: string, pos: number): YamlContext {
  const lines = doc.substring(0, pos).split('\n');
  const currentLine = lines[lines.length - 1] ?? '';
  const currentEI = effectiveIndent(currentLine);
  const path: string[] = [];
  const siblings: Record<string, string> = {};
  let targetEI = currentEI;

  let descendedIntoEmptyKey = false;
  if (currentLine.trim() === '' || currentLine.trim() === '-') {
    for (let j = lines.length - 2; j >= 0; j--) {
      const prev = lines[j] ?? '';
      if (prev.trim() === '') continue;
      const prevEI = effectiveIndent(prev);
      if (prevEI <= currentEI) {
        const kv = extractKeyValue(prev);
        if (kv && kv.value === '') {
          path.unshift(kv.key);
          targetEI = prevEI;
          descendedIntoEmptyKey = true;
        }
      }
      break;
    }
  }

  for (let i = lines.length - 2; i >= 0; i--) {
    const rawLine = lines[i] ?? '';
    if (rawLine.trim() === '') continue;
    const lineEI = effectiveIndent(rawLine);

    if (descendedIntoEmptyKey && lineEI >= targetEI && i === lines.length - 2) {
      descendedIntoEmptyKey = false;
      continue;
    }

    if (lineEI === currentEI || lineEI === targetEI) {
      const kv = extractKeyValue(rawLine);
      if (kv && !(kv.key in siblings)) {
        siblings[kv.key] = kv.value;
      }
    }

    if (lineEI < targetEI) {
      const kv = extractKeyValue(rawLine);
      if (kv) {
        path.unshift(kv.key);
        targetEI = lineEI;
      }
      if (lineEI === 0) break;
    }
  }
  return { path, siblings };
}

function typeName(schema: z.ZodType): string {
  return (schema._def as Record<string, unknown>).typeName as string ?? '';
}

function getShape(schema: z.ZodType): Record<string, z.ZodType> | null {
  const def = schema._def as Record<string, unknown>;
  if (typeof def.shape === 'function') return (def.shape as () => Record<string, z.ZodType>)();
  if (typeof def.shape === 'object' && def.shape) return def.shape as Record<string, z.ZodType>;
  return null;
}

export function unwrap(schema: z.ZodType): z.ZodType {
  const tn = typeName(schema);
  if (tn === 'ZodOptional' || tn === 'ZodDefault' || tn === 'ZodNullable') {
    return unwrap((schema._def as { innerType: z.ZodType }).innerType);
  }
  if (tn === 'ZodLazy') {
    return unwrap((schema._def as { getter: () => z.ZodType }).getter());
  }
  return schema;
}

function navigateObjectKey(shape: Record<string, z.ZodType>, key: string): z.ZodType | null {
  if (!(key in shape)) return null;
  let field = unwrap(shape[key] as z.ZodType);
  if (typeName(field) === 'ZodArray') {
    field = unwrap((field._def as { type: z.ZodType }).type);
  }
  return field;
}

export function isArrayField(
  schema: z.ZodType,
  path: string[],
  siblings?: Record<string, string>,
): boolean {
  if (path.length === 0) return false;
  const parentPath = path.slice(0, -1);
  const lastKey = path[path.length - 1]!;
  const parent = navigateSchema(schema, parentPath, siblings);
  if (!parent) return false;
  const parentUnwrapped = unwrap(parent);
  const shape = getShape(parentUnwrapped);
  if (!shape || !(lastKey in shape)) return false;
  const field = unwrap(shape[lastKey] as z.ZodType);
  return typeName(field) === 'ZodArray';
}

export function navigateSchema(
  schema: z.ZodType,
  path: string[],
  siblings?: Record<string, string>,
): z.ZodType | null {
  let current = unwrap(schema);

  for (let pi = 0; pi < path.length; pi++) {
    const key = path[pi]!;
    current = unwrap(current);

    const tn = typeName(current);
    if (tn === 'ZodObject') {
      const shape = getShape(current);
      if (!shape) return null;
      const result = navigateObjectKey(shape, key);
      if (!result) return null;
      current = result;
    } else if (tn === 'ZodArray') {
      current = unwrap((current._def as { type: z.ZodType }).type);
      const innerShape = getShape(current);
      if (!innerShape) return null;
      const result = navigateObjectKey(innerShape, key);
      if (!result) return null;
      current = result;
    } else if (tn === 'ZodRecord') {
      const valueType = (current._def as { valueType: z.ZodType }).valueType;
      current = unwrap(valueType);
    } else if (tn === 'ZodDiscriminatedUnion') {
      const def = current._def as {
        discriminator: string;
        optionsMap: Map<string, z.ZodType>;
      };
      if (key === def.discriminator) {
        const literals = [...def.optionsMap.keys()];
        return z.enum(literals as [string, ...string[]]);
      }
      const typeValue = siblings?.[def.discriminator];
      if (!typeValue) return null;
      const branch = def.optionsMap.get(typeValue);
      if (!branch) return null;
      const branchObj = unwrap(branch);
      const branchShape = getShape(branchObj);
      if (!branchShape) return null;
      const result = navigateObjectKey(branchShape, key);
      if (!result) return null;
      current = result;
    } else if (tn === 'ZodUnion') {
      let found: z.ZodType | null = null;
      for (const option of (current._def as { options: z.ZodType[] }).options) {
        const result = navigateSchema(option, [key], siblings);
        if (result) { found = result; break; }
      }
      if (!found) return null;
      current = found;
    } else if (tn === 'ZodIntersection') {
      const def = current._def as { left: z.ZodType; right: z.ZodType };
      const left = navigateSchema(def.left, [key], siblings);
      if (left) { current = left; continue; }
      const right = navigateSchema(def.right, [key], siblings);
      if (right) { current = right; continue; }
      return null;
    } else {
      return null;
    }
  }
  return current;
}

function describeType(schema: z.ZodType): string | undefined {
  const tn = typeName(schema);
  if (tn === 'ZodString') return 'string';
  if (tn === 'ZodNumber') return 'number';
  if (tn === 'ZodBoolean') return 'boolean';
  if (tn === 'ZodEnum') return ((schema._def as { values: string[] }).values).join(' | ');
  if (tn === 'ZodArray') return 'array';
  if (tn === 'ZodObject') return 'object';
  if (tn === 'ZodRecord') return 'record';
  return undefined;
}

export function schemaToCompletions(schema: z.ZodType): CompletionEntry[] {
  const unwrapped = unwrap(schema);
  const tn = typeName(unwrapped);

  if (tn === 'ZodObject') {
    const shape = getShape(unwrapped);
    if (!shape) return [];
    return Object.entries(shape).map(([key, fieldSchema]) => {
      const detail = fieldSchema.description ?? describeType(unwrap(fieldSchema));
      return {
        label: key,
        ...(detail ? { detail } : {}),
        type: 'property' as const,
        apply: key + ': ',
      };
    });
  }

  if (tn === 'ZodEnum') {
    return ((unwrapped._def as { values: string[] }).values).map((v) => ({
      label: v,
      type: 'enum' as const,
    }));
  }

  if (tn === 'ZodNativeEnum') {
    const values = Object.values(
      (unwrapped._def as { values: Record<string, string | number> }).values,
    ).filter((v): v is string => typeof v === 'string');
    return values.map((v) => ({ label: v, type: 'enum' as const }));
  }

  if (tn === 'ZodLiteral') {
    return [{
      label: String((unwrapped._def as { value: unknown }).value),
      type: 'enum' as const,
    }];
  }

  if (tn === 'ZodBoolean') {
    return [
      { label: 'true', type: 'enum' as const },
      { label: 'false', type: 'enum' as const },
    ];
  }

  if (tn === 'ZodDiscriminatedUnion') {
    const def = unwrapped._def as {
      discriminator: string;
      optionsMap: Map<string, z.ZodType>;
    };
    const typeValues = [...def.optionsMap.keys()];
    const firstBranch = def.optionsMap.values().next().value;
    const branchCompletions = firstBranch ? schemaToCompletions(firstBranch) : [];
    const commonKeys = branchCompletions.filter((c) => c.label !== def.discriminator);
    return [
      {
        label: def.discriminator,
        detail: typeValues.join(' | '),
        type: 'property' as const,
        apply: def.discriminator + ': ',
      },
      ...commonKeys,
    ];
  }

  if (tn === 'ZodUnion') {
    const allCompletions: CompletionEntry[] = [];
    for (const option of (unwrapped._def as { options: z.ZodType[] }).options) {
      allCompletions.push(...schemaToCompletions(option));
    }
    const seen = new Set<string>();
    return allCompletions.filter((c) => {
      if (seen.has(c.label)) return false;
      seen.add(c.label);
      return true;
    });
  }

  if (tn === 'ZodIntersection') {
    const def = unwrapped._def as { left: z.ZodType; right: z.ZodType };
    const left = schemaToCompletions(def.left);
    const right = schemaToCompletions(def.right);
    const seen = new Set(left.map((c) => c.label));
    return [...left, ...right.filter((c) => !seen.has(c.label))];
  }

  return [];
}
