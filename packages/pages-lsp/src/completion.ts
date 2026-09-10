import { buildYamlContext, navigateSchema, schemaToCompletions, isArrayField } from './schema-navigation.js';
import type { SchemaRegistry } from './types.js';

export interface CompletionItem {
  label: string;
  kind: number;
  insertText?: string;
  detail?: string;
}

const PROPERTY_KIND = 10;
const ENUM_MEMBER_KIND = 20;

export function handleCompletion(
  uri: string,
  content: string,
  position: { line: number; character: number },
  registry: SchemaRegistry,
): CompletionItem[] {
  const format = registry.detect(uri, content);
  if (!format) return [];

  const lines = content.split('\n');
  let offset = 0;
  for (let i = 0; i < position.line; i++) {
    offset += (lines[i]?.length ?? 0) + 1;
  }
  offset += position.character;

  const yamlCtx = buildYamlContext(content, offset);
  const line = lines[position.line] ?? '';
  const textBefore = line.substring(0, position.character);

  const afterValueColon = textBefore.match(/(?:^|\s)-?\s*(\w[\w-]*):\s*(\S*)$/);
  if (afterValueColon) {
    const key = afterValueColon[1] ?? '';
    const resolved = navigateSchema(
      format.documentSchema,
      [...yamlCtx.path, key],
      yamlCtx.siblings,
    );
    if (resolved) {
      const completions = schemaToCompletions(resolved);
      if (completions.length > 0 && completions[0]?.type === 'enum') {
        return completions.map(c => ({
          label: c.label,
          kind: ENUM_MEMBER_KIND,
          ...(c.detail ? { detail: c.detail } : {}),
        }));
      }
    }
    return [];
  }

  const resolved = navigateSchema(format.documentSchema, yamlCtx.path, yamlCtx.siblings);
  if (!resolved) return [];

  const completions = schemaToCompletions(resolved);
  const needsDash = isArrayField(format.documentSchema, yamlCtx.path, yamlCtx.siblings)
    && !textBefore.trimStart().startsWith('-');

  return completions.map(c => ({
    label: needsDash ? '- ' + c.label : c.label,
    kind: c.type === 'property' ? PROPERTY_KIND : ENUM_MEMBER_KIND,
    insertText: needsDash ? '- ' + (c.apply || c.label) : c.apply || c.label,
    ...(c.detail ? { detail: c.detail } : {}),
  }));
}
