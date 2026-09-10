import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { handleCompletion } from './completion.js';
import { createSchemaRegistry } from './schema-registry.js';
import type { FormatRegistration } from './types.js';

const pageSchema = z.object({
  pages: z.array(
    z.object({
      name: z.string(),
      components: z.array(
        z.discriminatedUnion('type', [
          z.object({ type: z.literal('bar-chart'), width: z.number().optional() }),
          z.object({ type: z.literal('data-table'), columns: z.array(z.string()).optional() }),
        ]),
      ),
    }),
  ),
  datasets: z.array(z.object({ uuid: z.string() })).optional(),
});

const pageFormat: FormatRegistration = {
  formatId: 'page',
  extensions: ['.page.yaml'],
  documentSchema: pageSchema,
};

function setup() {
  const registry = createSchemaRegistry();
  registry.register(pageFormat);
  return registry;
}

describe('handleCompletion', () => {
  it('returns top-level property completions at root', () => {
    const registry = setup();
    const doc = '';
    const items = handleCompletion(
      'file:///app/test.page.yaml', doc, { line: 0, character: 0 }, registry,
    );
    const labels = items.map(i => i.label);
    expect(labels).toContain('pages');
    expect(labels).toContain('datasets');
  });

  it('returns component type enum values after type:', () => {
    const registry = setup();
    const doc = 'pages:\n  - name: Home\n    components:\n      - type: ';
    const lines = doc.split('\n');
    const lastLine = lines[lines.length - 1]!;
    const items = handleCompletion(
      'file:///app/test.page.yaml', doc,
      { line: lines.length - 1, character: lastLine.length },
      registry,
    );
    const labels = items.map(i => i.label);
    expect(labels).toContain('bar-chart');
    expect(labels).toContain('data-table');
  });

  it('returns narrowed properties for selected type', () => {
    const registry = setup();
    const doc = 'pages:\n  - name: Home\n    components:\n      - type: bar-chart\n        ';
    const lines = doc.split('\n');
    const lastLine = lines[lines.length - 1]!;
    const items = handleCompletion(
      'file:///app/test.page.yaml', doc,
      { line: lines.length - 1, character: lastLine.length },
      registry,
    );
    const labels = items.map(i => i.label);
    expect(labels).toContain('- width');
    expect(labels).not.toContain('- columns');
    expect(labels).not.toContain('columns');
  });
});
