import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { createSchemaRegistry } from './schema-registry.js';
import { pageFormat } from './formats/page.js';
import { handleCompletion } from './completion.js';
import { computeDiagnostics } from './diagnostics.js';

function loadExample(name: string): string {
  const base = resolve(import.meta.dirname, '../../../examples/samples');
  return readFileSync(resolve(base, name), 'utf-8');
}

describe('integration: Page YAML', () => {
  it('detects .page.yaml by extension', () => {
    const registry = createSchemaRegistry();
    registry.register(pageFormat);
    const detected = registry.detect('file:///app/test.page.yaml', '');
    expect(detected?.formatId).toBe('page');
  });

  it('detects .dash.yaml by transition extension', () => {
    const registry = createSchemaRegistry();
    registry.register(pageFormat);
    const detected = registry.detect('file:///app/old.dash.yaml', '');
    expect(detected?.formatId).toBe('page');
  });

  it('provides completion at root of empty Page file', () => {
    const registry = createSchemaRegistry();
    registry.register(pageFormat);
    const items = handleCompletion(
      'file:///test.page.yaml', '', { line: 0, character: 0 }, registry,
    );
    const labels = items.map(i => i.label);
    expect(labels).toContain('pages');
  });

  it('produces no syntax errors for a real example', () => {
    const registry = createSchemaRegistry();
    registry.register(pageFormat);
    const content = loadExample('Charts/Charts.dash.yaml');
    const diagnostics = computeDiagnostics(
      'file:///example.dash.yaml', content, registry,
    );
    const syntaxErrors = diagnostics.filter(d => d.source === 'casehub-yaml');
    expect(syntaxErrors).toHaveLength(0);
  });
});
