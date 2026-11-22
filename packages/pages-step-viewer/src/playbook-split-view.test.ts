import { describe, it, expect, vi, beforeEach } from 'vitest';

// Since PlaybookSplitView is a Lit component that uses browser APIs,
// we test the core logic functions directly rather than the custom element.
import { parseAndResolve, type SplitViewState } from './playbook-split-view.js';

describe('playbook-split-view core logic', () => {
  it('parseAndResolve returns steps for valid flat YAML', () => {
    const yaml = '- action: step-a\n- action: step-b\n';
    const result = parseAndResolve(yaml);
    expect(result.error).toBeNull();
    expect(result.steps.length).toBe(2);
    expect(result.positionInfos.length).toBeGreaterThan(0);
  });

  it('parseAndResolve returns error for invalid YAML', () => {
    const yaml = '{{invalid yaml::';
    const result = parseAndResolve(yaml);
    expect(result.error).not.toBeNull();
    expect(result.steps).toEqual([]);
    expect(result.positionInfos).toEqual([]);
  });

  it('parseAndResolve returns empty for empty input', () => {
    const result = parseAndResolve('');
    expect(result.steps).toEqual([]);
    expect(result.positionInfos).toEqual([]);
    expect(result.error).toBeNull();
  });

  it('parseAndResolve builds position infos matching steps', () => {
    const yaml = [
      '- action: step-a',
      '  with:',
      '    key: val',
      '- action: step-b',
    ].join('\n');
    const result = parseAndResolve(yaml);
    expect(result.steps.length).toBe(2);
    expect(result.positionInfos.length).toBeGreaterThanOrEqual(2);
    expect(result.positionInfos[0]!.address).toBe('0');
    expect(result.positionInfos[1]!.address).toBe('1');
  });

  it('parseAndResolve handles nested if-else', () => {
    const yaml = [
      '- if: condition',
      '  then:',
      '    - action: then-step',
      '  else:',
      '    - action: else-step',
    ].join('\n');
    const result = parseAndResolve(yaml);
    expect(result.steps.length).toBe(1);
    expect(result.positionInfos.some(i => i.address.includes('then'))).toBe(true);
  });

  it('parseAndResolve rejects steps wrapper', () => {
    const yaml = 'steps:\n  - action: step-a\n  - action: step-b\n';
    const result = parseAndResolve(yaml);
    expect(result.error).toContain("'steps' wrapper is not valid");
    expect(result.steps).toEqual([]);
  });
});
