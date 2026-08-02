import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseDocument } from 'yaml';
import jsYaml from 'js-yaml';

const THIS_DIR = join(fileURLToPath(import.meta.url), '..');
const FIXTURES_DIR = join(THIS_DIR, 'fixtures');
const OUTPUT_DIR = join(THIS_DIR, 'output');

const fixtures = readdirSync(FIXTURES_DIR)
  .filter(f => f.endsWith('.yaml'));

describe('yaml npm round-trip fidelity', () => {
  for (const fixture of fixtures) {
    describe(fixture, () => {
      const originalYaml = readFileSync(join(FIXTURES_DIR, fixture), 'utf-8');
      const doc = parseDocument(originalYaml);
      const roundTripped = doc.toString();

      it('round-trips to semantically equivalent YAML', () => {
        const originalJson = JSON.parse(JSON.stringify(doc.toJSON()));
        const reDoc = parseDocument(roundTripped);
        const roundTrippedJson = JSON.parse(JSON.stringify(reDoc.toJSON()));
        expect(roundTrippedJson).toEqual(originalJson);
      });

      it('is parseable by js-yaml (SnakeYAML-compatible)', () => {
        const fromYamlNpm = doc.toJSON() as Record<string, unknown>;
        const fromJsYaml = jsYaml.load(roundTripped) as Record<string, unknown>;
        expect(fromJsYaml).toEqual(fromYamlNpm);
      });

      it('writes round-tripped output for Java validation', () => {
        mkdirSync(OUTPUT_DIR, { recursive: true });
        writeFileSync(join(OUTPUT_DIR, fixture), roundTripped, 'utf-8');
      });
    });
  }
});

describe('expression string preservation', () => {
  const yaml = readFileSync(join(FIXTURES_DIR, 'expression-strings.yaml'), 'utf-8');
  const doc = parseDocument(yaml);
  const roundTripped = doc.toString();
  const parsed = parseDocument(roundTripped).toJSON() as {
    expressions: Record<string, string>;
  };

  const expressions = [
    ['simple', '${ .document.contentType }'],
    ['nested', '${ .items[0].name }'],
    ['comparison', '${ .score >= 0.8 }'],
    ['null_check', '${ .result != null }'],
  ] as const;

  for (const [key, expected] of expressions) {
    it(`preserves expression: ${key}`, () => {
      expect(parsed.expressions[key]).toBe(expected);
    });
  }
});
