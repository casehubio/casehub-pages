import { describe, it, expect } from 'vitest';
import {
  parsePlaybookFrontMatter,
  parseTutorialHeaders,
  validateTutorialHeaders,
  isBuiltInSchema,
  isDomainSchema,
  PLAYBOOK_SCHEMAS,
} from './playbook.js';

describe('PlaybookFrontMatter', () => {
  it('extracts version and schema', () => {
    const fm = parsePlaybookFrontMatter({
      playbook: '1.0',
      schema: 'server',
    });

    expect(fm).not.toBeNull();
    expect(fm!.version).toBe('1.0');
    expect(fm!.schema).toBe('server');
    expect(fm!.name).toBeUndefined();
    expect(fm!.metadata).toEqual({});
  });

  it('extracts name when present', () => {
    const fm = parsePlaybookFrontMatter({
      playbook: '1.0',
      schema: 'client',
      name: 'helpdesk-intake',
    });

    expect(fm!.name).toBe('helpdesk-intake');
  });

  it('collects extra fields into metadata', () => {
    const fm = parsePlaybookFrontMatter({
      playbook: '1.0',
      schema: 'clinical-server',
      author: 'test-user',
    });

    expect(fm!.metadata).toEqual({ author: 'test-user' });
  });

  it('returns null when no playbook key', () => {
    const fm = parsePlaybookFrontMatter({
      scenario: 'legacy',
      steps: [],
    });

    expect(fm).toBeNull();
  });

  it('coerces numeric version to string', () => {
    const fm = parsePlaybookFrontMatter({
      playbook: 1.0,
      schema: 'server',
    });

    expect(fm!.version).toBe('1');
  });

  it('throws when schema is missing', () => {
    expect(() =>
      parsePlaybookFrontMatter({ playbook: '1.0' }),
    ).toThrow("Playbook front matter requires a 'schema' field");
  });
});

describe('PlaybookSchemas', () => {
  it('has client, server, and assisted constants', () => {
    expect(PLAYBOOK_SCHEMAS.CLIENT).toBe('client');
    expect(PLAYBOOK_SCHEMAS.SERVER).toBe('server');
    expect(PLAYBOOK_SCHEMAS.ASSISTED).toBe('assisted');
  });

  it('identifies built-in schemas including assisted', () => {
    expect(isBuiltInSchema('client')).toBe(true);
    expect(isBuiltInSchema('server')).toBe(true);
    expect(isBuiltInSchema('assisted')).toBe(true);
    expect(isBuiltInSchema('clinical-client')).toBe(false);
  });

  it('identifies domain schemas', () => {
    expect(isDomainSchema('clinical-client')).toBe(true);
    expect(isDomainSchema('aml-server')).toBe(true);
    expect(isDomainSchema('client')).toBe(false);
    expect(isDomainSchema('server')).toBe(false);
    expect(isDomainSchema('assisted')).toBe(false);
    expect(isDomainSchema(null)).toBe(false);
  });
});

describe('TutorialHeaders', () => {
  it('extracts all 4 fields from metadata', () => {
    const meta = { level: 2, layer: 'flow-control', teaches: 'retry with limits', 'builds-on': 'sequential' };
    const headers = parseTutorialHeaders(meta);
    expect(headers).toEqual({
      level: 2,
      layer: 'flow-control',
      teaches: 'retry with limits',
      buildsOn: 'sequential',
    });
  });

  it('handles builds-on as array', () => {
    const meta = { level: 3, layer: 'composition', teaches: 'module composition', 'builds-on': ['sequential', 'retry'] };
    const headers = parseTutorialHeaders(meta);
    expect(headers.buildsOn).toEqual(['sequential', 'retry']);
  });

  it('returns null builds-on for level-1 fundamentals', () => {
    const meta = { level: 1, layer: 'flow-control', teaches: 'running steps in order' };
    const headers = parseTutorialHeaders(meta);
    expect(headers.buildsOn).toBeNull();
  });

  it('validates valid headers with no errors', () => {
    const errors = validateTutorialHeaders({ level: 2, layer: 'flow-control', teaches: 'retry' });
    expect(errors).toEqual([]);
  });

  it('reports missing required fields', () => {
    const errors = validateTutorialHeaders({ level: 2 });
    expect(errors).toContain("Missing required tutorial header: 'layer'");
    expect(errors).toContain("Missing required tutorial header: 'teaches'");
  });

  it('reports invalid level range', () => {
    const errors = validateTutorialHeaders({ level: 7, layer: 'x', teaches: 'y' });
    expect(errors).toContain("Tutorial header 'level' must be 1-5, got 7");
  });

  it('reports missing level', () => {
    const errors = validateTutorialHeaders({ layer: 'x', teaches: 'y' });
    expect(errors).toContain("Missing required tutorial header: 'level'");
  });
});
