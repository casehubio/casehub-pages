import { describe, it, expect } from 'vitest';
import { AnnotationParser } from './annotation-parser.js';

describe('AnnotationParser', () => {
  it('parses a single annotation with positional arg', () => {
    const yaml = '#@Timeout("5s")\nlog: hello';
    const result = AnnotationParser.parse(yaml);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Timeout');
    expect(result[0]!.args).toEqual({ '0': '5s' });
    expect(result[0]!.line).toBe(0);
  });

  it('parses annotation with named args', () => {
    const yaml = '#@Retry(max: "3", backoff: "exponential")';
    const result = AnnotationParser.parse(yaml);
    expect(result).toHaveLength(1);
    expect(result[0]!.args).toEqual({ max: '3', backoff: 'exponential' });
  });

  it('parses annotation with no args', () => {
    const yaml = '#@Background';
    const result = AnnotationParser.parse(yaml);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Background');
    expect(result[0]!.args).toEqual({});
  });

  it('parses multiple annotations with correct line numbers', () => {
    const yaml = '#@Timeout("5s")\n#@Retry(max: "3")\nlog: hello';
    const result = AnnotationParser.parse(yaml);
    expect(result).toHaveLength(2);
    expect(result[0]!.line).toBe(0);
    expect(result[0]!.name).toBe('Timeout');
    expect(result[1]!.line).toBe(1);
    expect(result[1]!.name).toBe('Retry');
  });

  it('ignores regular YAML comments', () => {
    const yaml = '# This is a comment\n#@Timeout("5s")\nlog: hello';
    const result = AnnotationParser.parse(yaml);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Timeout');
  });

  it('handles indented annotations', () => {
    const yaml = 'block:\n  #@Timeout("5s")\n  - log: hello';
    const result = AnnotationParser.parse(yaml);
    expect(result).toHaveLength(1);
    expect(result[0]!.name).toBe('Timeout');
    expect(result[0]!.line).toBe(1);
  });

  it('parses annotation with single-quoted args', () => {
    const yaml = "#@Timeout('5s')";
    const result = AnnotationParser.parse(yaml);
    expect(result[0]!.args).toEqual({ '0': '5s' });
  });

  it('parses annotation with mixed named and positional args', () => {
    const yaml = '#@Inject("TypeName", qualifier: "primary")';
    const result = AnnotationParser.parse(yaml);
    expect(result[0]!.args).toEqual({ '0': 'TypeName', qualifier: 'primary' });
  });

  it('returns empty array for YAML with no annotations', () => {
    const yaml = '# comment\nlog: hello\nrest-request: {}';
    const result = AnnotationParser.parse(yaml);
    expect(result).toHaveLength(0);
  });

  it('handles bare value positional args', () => {
    const yaml = '#@Priority(HIGH)';
    const result = AnnotationParser.parse(yaml);
    expect(result[0]!.args).toEqual({ '0': 'HIGH' });
  });
});
