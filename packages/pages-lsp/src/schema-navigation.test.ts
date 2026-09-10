import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  buildYamlContext,
  navigateSchema,
  schemaToCompletions,
  isArrayField,
} from './schema-navigation.js';

const componentBase = z.object({
  type: z.string(),
  id: z.string().optional(),
});

const barChartProps = componentBase.extend({
  type: z.literal('bar-chart'),
  width: z.number().optional(),
  height: z.number().optional(),
});

const tableProps = componentBase.extend({
  type: z.literal('data-table'),
  columns: z.array(z.string()).optional(),
});

const componentSchema = z.discriminatedUnion('type', [barChartProps, tableProps]);

const pageSchema = z.object({
  pages: z.array(
    z.object({
      name: z.string(),
      components: z.array(componentSchema),
    }),
  ),
  datasets: z
    .array(z.object({ uuid: z.string() }))
    .optional(),
});

describe('buildYamlContext', () => {
  it('returns empty path at root', () => {
    const ctx = buildYamlContext('', 0);
    expect(ctx.path).toEqual([]);
    expect(ctx.siblings).toEqual({});
  });

  it('tracks path through nesting', () => {
    const doc = 'pages:\n  - name: Home\n    components:\n      - type: bar-chart\n        ';
    const ctx = buildYamlContext(doc, doc.length);
    expect(ctx.path).toEqual(['pages', 'components']);
    expect(ctx.siblings.type).toBe('bar-chart');
  });

  it('descends into empty key block', () => {
    const doc = 'pages:\n  ';
    const ctx = buildYamlContext(doc, doc.length);
    expect(ctx.path).toEqual(['pages']);
  });
});

describe('navigateSchema', () => {
  it('navigates to a top-level key', () => {
    const result = navigateSchema(pageSchema, ['pages']);
    expect(result).toBeTruthy();
  });

  it('navigates through array into object', () => {
    const result = navigateSchema(pageSchema, ['pages', 'name']);
    expect(result).toBeTruthy();
  });

  it('resolves discriminated union with sibling', () => {
    const result = navigateSchema(
      pageSchema,
      ['pages', 'components', 'width'],
      { type: 'bar-chart' },
    );
    expect(result).toBeTruthy();
  });

  it('returns null for unknown key in wrong branch', () => {
    const result = navigateSchema(
      pageSchema,
      ['pages', 'components', 'columns'],
      { type: 'bar-chart' },
    );
    expect(result).toBeNull();
  });

  it('returns enum values for discriminator field', () => {
    const result = navigateSchema(
      pageSchema,
      ['pages', 'components', 'type'],
      {},
    );
    expect(result).toBeTruthy();
    const completions = schemaToCompletions(result!);
    const labels = completions.map((c) => c.label);
    expect(labels).toContain('bar-chart');
    expect(labels).toContain('data-table');
  });

  it('handles ZodRecord by returning value schema', () => {
    const recordSchema = z.object({
      properties: z.record(z.string()),
    });
    const result = navigateSchema(recordSchema, ['properties', 'anyKey']);
    expect(result).toBeTruthy();
  });
});

describe('schemaToCompletions', () => {
  it('returns property completions for object schema', () => {
    const completions = schemaToCompletions(pageSchema);
    const labels = completions.map((c) => c.label);
    expect(labels).toContain('pages');
    expect(labels).toContain('datasets');
  });

  it('returns enum completions for enum schema', () => {
    const enumSchema = z.enum(['red', 'green', 'blue']);
    const completions = schemaToCompletions(enumSchema);
    expect(completions).toEqual([
      { label: 'red', type: 'enum' },
      { label: 'green', type: 'enum' },
      { label: 'blue', type: 'enum' },
    ]);
  });

  it('returns boolean completions', () => {
    const completions = schemaToCompletions(z.boolean());
    expect(completions).toHaveLength(2);
    expect(completions.map((c) => c.label)).toEqual(['true', 'false']);
  });
});

describe('isArrayField', () => {
  it('identifies array fields', () => {
    expect(isArrayField(pageSchema, ['pages'])).toBe(true);
  });

  it('rejects non-array fields', () => {
    expect(isArrayField(pageSchema, ['pages', 'name'])).toBe(false);
  });
});
