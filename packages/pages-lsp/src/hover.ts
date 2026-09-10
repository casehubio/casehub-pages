import type { z } from 'zod';
import {
  buildYamlContext,
  navigateSchema,
  unwrap,
} from './schema-navigation.js';
import type { SchemaRegistry } from './types.js';

export interface HoverResult {
  contents: string;
  range?: {
    start: { line: number; character: number };
    end: { line: number; character: number };
  };
}

function typeName(schema: z.ZodType): string {
  return (schema._def as Record<string, unknown>).typeName as string ?? '';
}

function describeSchema(schema: z.ZodType): string {
  const unwrapped = unwrap(schema);
  const tn = typeName(unwrapped);
  const desc = schema.description;
  const parts: string[] = [];
  if (desc) parts.push(desc);
  if (tn === 'ZodString') parts.push('Type: `string`');
  else if (tn === 'ZodNumber') parts.push('Type: `number`');
  else if (tn === 'ZodBoolean') parts.push('Type: `boolean`');
  else if (tn === 'ZodEnum') {
    const values = (unwrapped._def as { values: string[] }).values;
    parts.push('Values: ' + values.map(v => '`' + v + '`').join(', '));
  }
  else if (tn === 'ZodArray') parts.push('Type: `array`');
  else if (tn === 'ZodObject') parts.push('Type: `object`');
  return parts.join('\n\n') || 'No description available';
}

export function handleHover(
  uri: string,
  content: string,
  position: { line: number; character: number },
  registry: SchemaRegistry,
): HoverResult | null {
  const format = registry.detect(uri, content);
  if (!format) return null;

  const lines = content.split('\n');
  const line = lines[position.line] ?? '';

  const keyMatch = line.match(/^\s*-?\s*(\w[\w-]*):/);
  if (!keyMatch) return null;

  const keyStart = line.indexOf(keyMatch[1]!);
  const keyEnd = keyStart + keyMatch[1]!.length;
  if (position.character < keyStart || position.character > keyEnd) return null;

  const key = keyMatch[1]!;

  let offset = 0;
  for (let i = 0; i < position.line; i++) {
    offset += (lines[i]?.length ?? 0) + 1;
  }
  offset += position.character;

  const yamlCtx = buildYamlContext(content, offset);

  const resolved = navigateSchema(
    format.documentSchema,
    [...yamlCtx.path, key],
    yamlCtx.siblings,
  );
  if (!resolved) return null;

  return {
    contents: describeSchema(resolved),
    range: {
      start: { line: position.line, character: keyStart },
      end: { line: position.line, character: keyEnd },
    },
  };
}
