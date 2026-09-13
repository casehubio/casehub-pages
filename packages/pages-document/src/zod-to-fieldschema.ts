import { z } from 'zod';
import type { FieldSchema } from '@casehubio/pages-component';

const cache = new WeakMap<z.ZodType, FieldSchema>();
const visiting = new WeakSet<z.ZodType>();

function typeName(schema: z.ZodType): string {
  return (schema._def as Record<string, unknown>).typeName as string ?? '';
}

function unwrap(schema: z.ZodType, seen = new WeakSet<z.ZodType>()): z.ZodType {
  if (seen.has(schema)) return schema;
  seen.add(schema);
  const tn = typeName(schema);
  if (tn === 'ZodOptional' || tn === 'ZodDefault' || tn === 'ZodNullable') {
    return unwrap((schema._def as { innerType: z.ZodType }).innerType, seen);
  }
  if (tn === 'ZodLazy') {
    return unwrap((schema._def as { getter: () => z.ZodType }).getter(), seen);
  }
  return schema;
}

function getShape(schema: z.ZodType): Record<string, z.ZodType> | null {
  const def = schema._def as Record<string, unknown>;
  if (typeof def.shape === 'function') return (def.shape as () => Record<string, z.ZodType>)();
  if (typeof def.shape === 'object' && def.shape) return def.shape as Record<string, z.ZodType>;
  return null;
}

function isOptional(schema: z.ZodType): boolean {
  const tn = typeName(schema);
  return tn === 'ZodOptional' || tn === 'ZodDefault' || tn === 'ZodNullable';
}

function convertInner(schema: z.ZodType): FieldSchema {
  if (visiting.has(schema)) return { type: 'object' };
  visiting.add(schema);
  const unwrapped = unwrap(schema);
  if (unwrapped !== schema) {
    if (visiting.has(unwrapped)) { visiting.delete(schema); return { type: 'object' }; }
    visiting.add(unwrapped);
  }
  try {
  const tn = typeName(unwrapped);

  if (tn === 'ZodString') {
    return { type: 'string' };
  }

  if (tn === 'ZodNumber') {
    const checks = (unwrapped._def as { checks?: Array<{ kind: string; value: number }> }).checks ?? [];
    const result: FieldSchema = { type: 'number' };
    const mutable = result as Record<string, unknown>;
    for (const check of checks) {
      if (check.kind === 'min') mutable['minimum'] = check.value;
      if (check.kind === 'max') mutable['maximum'] = check.value;
    }
    return result;
  }

  if (tn === 'ZodBoolean') {
    return { type: 'boolean' };
  }

  if (tn === 'ZodEnum') {
    const values = (unwrapped._def as { values: string[] }).values;
    return { type: 'string', enum: values };
  }

  if (tn === 'ZodLiteral') {
    const value = (unwrapped._def as { value: unknown }).value;
    if (typeof value === 'string') return { type: 'string', enum: [value] };
    if (typeof value === 'number') return { type: 'number' };
    if (typeof value === 'boolean') return { type: 'boolean' };
    return { type: 'string' };
  }

  if (tn === 'ZodArray') {
    const itemType = (unwrapped._def as { type: z.ZodType }).type;
    return { type: 'array', items: convertInner(itemType) };
  }

  if (tn === 'ZodRecord') {
    return { type: 'object' };
  }

  if (tn === 'ZodObject') {
    return convertObject(unwrapped);
  }

  if (tn === 'ZodUnion') {
    const options = (unwrapped._def as { options: z.ZodType[] }).options;
    const converted = options.map(o => convertInner(o));
    return { oneOf: converted };
  }

  if (tn === 'ZodIntersection') {
    const def = unwrapped._def as { left: z.ZodType; right: z.ZodType };
    const left = convertInner(def.left);
    const right = convertInner(def.right);
    return mergeFieldSchemas(left, right);
  }

  if (tn === 'ZodNativeEnum') {
    const values = Object.values(
      (unwrapped._def as { values: Record<string, string | number> }).values,
    ).filter((v): v is string => typeof v === 'string');
    return { type: 'string', enum: values };
  }

  if (tn === 'ZodAny' || tn === 'ZodUnknown') return {};
  return {};
  } finally {
    visiting.delete(schema);
    if (unwrapped !== schema) visiting.delete(unwrapped);
  }
}

function convertObject(schema: z.ZodType): FieldSchema {
  const shape = getShape(schema);
  if (!shape) return { type: 'object' };

  const properties: Record<string, FieldSchema> = {};
  const required: string[] = [];

  for (const [key, fieldSchema] of Object.entries(shape)) {
    properties[key] = convertInner(fieldSchema);
    if (!isOptional(fieldSchema)) {
      required.push(key);
    }
  }

  const result: FieldSchema = {
    type: 'object',
    properties,
  };
  if (required.length > 0) {
    (result as Record<string, unknown>)['required'] = required;
  }
  return result;
}

function mergeFieldSchemas(a: FieldSchema, b: FieldSchema): FieldSchema {
  if (a.type !== 'object' && b.type !== 'object') return a;
  const merged: FieldSchema = {
    type: 'object',
    properties: {
      ...a.properties,
      ...b.properties,
    },
  };
  const req = [...(a.required ?? []), ...(b.required ?? [])];
  if (req.length > 0) {
    (merged as Record<string, unknown>)['required'] = req;
  }
  return merged;
}

export function zodToFieldSchema(schema: z.ZodType): FieldSchema {
  const cached = cache.get(schema);
  if (cached) return cached;
  const result = convertInner(schema);
  cache.set(schema, result);
  return result;
}
