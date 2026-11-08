import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { YamlTestDiscovery } from './yaml-test-discovery.js';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('YamlTestDiscovery', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `yaml-test-discovery-${Date.now()}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('discovers .test.yaml files', () => {
    writeFileSync(join(tmpDir, 'example.test.yaml'), 'name: test');
    writeFileSync(join(tmpDir, 'other.yaml'), 'name: other');
    const results = YamlTestDiscovery.scan(tmpDir);
    expect(results).toHaveLength(1);
    expect(results[0]).toContain('example.test.yaml');
  });

  it('discovers files in nested directories', () => {
    const subDir = join(tmpDir, 'sub');
    mkdirSync(subDir);
    writeFileSync(join(tmpDir, 'top.test.yaml'), 'name: top');
    writeFileSync(join(subDir, 'nested.test.yaml'), 'name: nested');
    const results = YamlTestDiscovery.scan(tmpDir);
    expect(results).toHaveLength(2);
  });

  it('discovers .test.yml files', () => {
    writeFileSync(join(tmpDir, 'example.test.yml'), 'name: test');
    const results = YamlTestDiscovery.scan(tmpDir);
    expect(results).toHaveLength(1);
  });

  it('returns empty array for empty directory', () => {
    const results = YamlTestDiscovery.scan(tmpDir);
    expect(results).toHaveLength(0);
  });

  it('returns sorted results', () => {
    writeFileSync(join(tmpDir, 'z.test.yaml'), 'name: z');
    writeFileSync(join(tmpDir, 'a.test.yaml'), 'name: a');
    const results = YamlTestDiscovery.scan(tmpDir);
    expect(results[0]).toContain('a.test.yaml');
    expect(results[1]).toContain('z.test.yaml');
  });
});
