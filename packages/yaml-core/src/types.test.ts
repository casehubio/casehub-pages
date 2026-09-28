import { describe, it, expect } from 'vitest';
import {
  parseValue, rawValue, canAcceptType, isScalarStepParam,
  stepParamToParameterType, parameterTypeToStepParam,
  parseStepParameterType, validateStepParamValue, parseScalarStepParam,
  chainSources, drillFields, nestedSource, forEachContextSource,
  parseForEachDirective, drillOnlySource, UnresolvedVariableError,
} from './types.js';
import type { ObjectVariableSource } from './types.js';

describe('parseValue', () => {
  it('STRING returns string as-is', () => {
    expect(parseValue('STRING', 'hello')).toEqual({ type: 'string', value: 'hello' });
  });

  it('INTEGER parses valid int', () => {
    expect(parseValue('INTEGER', '42')).toEqual({ type: 'integer', value: 42 });
  });

  it('INTEGER throws on invalid', () => {
    expect(() => parseValue('INTEGER', 'abc')).toThrow("Cannot parse 'abc' as INTEGER");
  });

  it('NUMBER parses valid float', () => {
    expect(parseValue('NUMBER', '3.14')).toEqual({ type: 'number', value: 3.14 });
  });

  it('NUMBER throws on invalid', () => {
    expect(() => parseValue('NUMBER', 'xyz')).toThrow("Cannot parse 'xyz' as NUMBER");
  });

  it('BOOLEAN parses truthy values', () => {
    for (const v of ['true', 'yes', 'on', 'y', '1', 'TRUE', 'Yes']) {
      expect(parseValue('BOOLEAN', v)).toEqual({ type: 'boolean', value: true });
    }
  });

  it('BOOLEAN parses falsy values', () => {
    for (const v of ['false', 'no', 'off', 'n', '0', 'FALSE', 'No']) {
      expect(parseValue('BOOLEAN', v)).toEqual({ type: 'boolean', value: false });
    }
  });

  it('BOOLEAN throws on invalid', () => {
    expect(() => parseValue('BOOLEAN', 'maybe')).toThrow("Cannot parse 'maybe' as BOOLEAN");
  });

  it('LIST splits on comma and trims', () => {
    expect(parseValue('LIST', 'a, b , c')).toEqual({ type: 'list', value: ['a', 'b', 'c'] });
  });
});

describe('rawValue', () => {
  it('extracts value from ParsedValue', () => {
    expect(rawValue({ type: 'string', value: 'hi' })).toBe('hi');
    expect(rawValue({ type: 'integer', value: 5 })).toBe(5);
    expect(rawValue({ type: 'boolean', value: true })).toBe(true);
    expect(rawValue({ type: 'list', value: ['a', 'b'] })).toEqual(['a', 'b']);
  });
});

describe('canAcceptType', () => {
  it('same type returns true', () => {
    expect(canAcceptType('STRING', 'STRING')).toBe(true);
    expect(canAcceptType('INTEGER', 'INTEGER')).toBe(true);
    expect(canAcceptType('LIST', 'LIST')).toBe(true);
  });

  it('STRING accepts non-LIST types', () => {
    expect(canAcceptType('STRING', 'INTEGER')).toBe(true);
    expect(canAcceptType('STRING', 'NUMBER')).toBe(true);
    expect(canAcceptType('STRING', 'BOOLEAN')).toBe(true);
  });

  it('STRING rejects LIST', () => {
    expect(canAcceptType('STRING', 'LIST')).toBe(false);
  });

  it('NUMBER accepts INTEGER', () => {
    expect(canAcceptType('NUMBER', 'INTEGER')).toBe(true);
  });

  it('other combos return false', () => {
    expect(canAcceptType('INTEGER', 'NUMBER')).toBe(false);
    expect(canAcceptType('BOOLEAN', 'STRING')).toBe(false);
    expect(canAcceptType('LIST', 'STRING')).toBe(false);
  });
});

describe('isScalarStepParam', () => {
  it('true for scalar types', () => {
    expect(isScalarStepParam('STRING')).toBe(true);
    expect(isScalarStepParam('INTEGER')).toBe(true);
    expect(isScalarStepParam('NUMBER')).toBe(true);
    expect(isScalarStepParam('BOOLEAN')).toBe(true);
  });

  it('false for compound types', () => {
    expect(isScalarStepParam('ARRAY')).toBe(false);
    expect(isScalarStepParam('OBJECT')).toBe(false);
  });
});

describe('stepParamToParameterType', () => {
  it('maps scalar types', () => {
    expect(stepParamToParameterType('STRING')).toBe('STRING');
    expect(stepParamToParameterType('INTEGER')).toBe('INTEGER');
    expect(stepParamToParameterType('NUMBER')).toBe('NUMBER');
    expect(stepParamToParameterType('BOOLEAN')).toBe('BOOLEAN');
  });

  it('returns undefined for compound types', () => {
    expect(stepParamToParameterType('ARRAY')).toBeUndefined();
    expect(stepParamToParameterType('OBJECT')).toBeUndefined();
  });
});

describe('parameterTypeToStepParam', () => {
  it('maps all ParameterType values', () => {
    expect(parameterTypeToStepParam('STRING')).toBe('STRING');
    expect(parameterTypeToStepParam('LIST')).toBe('ARRAY');
    expect(parameterTypeToStepParam('INTEGER')).toBe('INTEGER');
    expect(parameterTypeToStepParam('NUMBER')).toBe('NUMBER');
    expect(parameterTypeToStepParam('BOOLEAN')).toBe('BOOLEAN');
  });
});

describe('parseStepParameterType', () => {
  it('recognizes all 6 types case-insensitively', () => {
    expect(parseStepParameterType('string')).toBe('STRING');
    expect(parseStepParameterType('Integer')).toBe('INTEGER');
    expect(parseStepParameterType('NUMBER')).toBe('NUMBER');
    expect(parseStepParameterType('boolean')).toBe('BOOLEAN');
    expect(parseStepParameterType('Array')).toBe('ARRAY');
    expect(parseStepParameterType('OBJECT')).toBe('OBJECT');
  });

  it('maps DECIMAL to NUMBER', () => {
    expect(parseStepParameterType('decimal')).toBe('NUMBER');
    expect(parseStepParameterType('DECIMAL')).toBe('NUMBER');
  });

  it('throws on unknown type', () => {
    expect(() => parseStepParameterType('MAP')).toThrow("Unknown StepParameterType: 'MAP'");
  });
});

describe('validateStepParamValue', () => {
  it('STRING validates typeof string', () => {
    expect(validateStepParamValue('STRING', 'hello')).toBe(true);
    expect(validateStepParamValue('STRING', 42)).toBe(false);
  });

  it('INTEGER validates number + isInteger', () => {
    expect(validateStepParamValue('INTEGER', 42)).toBe(true);
    expect(validateStepParamValue('INTEGER', 3.14)).toBe(false);
    expect(validateStepParamValue('INTEGER', 'x')).toBe(false);
  });

  it('NUMBER validates typeof number', () => {
    expect(validateStepParamValue('NUMBER', 3.14)).toBe(true);
    expect(validateStepParamValue('NUMBER', 42)).toBe(true);
    expect(validateStepParamValue('NUMBER', 'x')).toBe(false);
  });

  it('BOOLEAN validates typeof boolean', () => {
    expect(validateStepParamValue('BOOLEAN', true)).toBe(true);
    expect(validateStepParamValue('BOOLEAN', false)).toBe(true);
    expect(validateStepParamValue('BOOLEAN', 'true')).toBe(false);
  });

  it('ARRAY validates Array.isArray', () => {
    expect(validateStepParamValue('ARRAY', [1, 2])).toBe(true);
    expect(validateStepParamValue('ARRAY', 'not array')).toBe(false);
  });

  it('OBJECT validates non-null non-array object', () => {
    expect(validateStepParamValue('OBJECT', { a: 1 })).toBe(true);
    expect(validateStepParamValue('OBJECT', null)).toBe(false);
    expect(validateStepParamValue('OBJECT', [1])).toBe(false);
    expect(validateStepParamValue('OBJECT', 'str')).toBe(false);
  });
});

describe('parseScalarStepParam', () => {
  it('STRING returns raw', () => {
    expect(parseScalarStepParam('STRING', 'hello')).toBe('hello');
  });

  it('INTEGER parses valid, throws on invalid', () => {
    expect(parseScalarStepParam('INTEGER', '10')).toBe(10);
    expect(() => parseScalarStepParam('INTEGER', 'abc')).toThrow();
  });

  it('NUMBER parses valid, throws on invalid', () => {
    expect(parseScalarStepParam('NUMBER', '2.5')).toBe(2.5);
    expect(() => parseScalarStepParam('NUMBER', 'abc')).toThrow();
  });

  it('BOOLEAN parses truthy and falsy', () => {
    expect(parseScalarStepParam('BOOLEAN', 'yes')).toBe(true);
    expect(parseScalarStepParam('BOOLEAN', 'off')).toBe(false);
    expect(() => parseScalarStepParam('BOOLEAN', 'maybe')).toThrow();
  });

  it('ARRAY and OBJECT throw', () => {
    expect(() => parseScalarStepParam('ARRAY', '[]')).toThrow("compound type 'ARRAY'");
    expect(() => parseScalarStepParam('OBJECT', '{}')).toThrow("compound type 'OBJECT'");
  });
});

describe('chainSources', () => {
  it('returns first defined value', () => {
    const s1 = (k: string) => k === 'a' ? 'from-s1' : undefined;
    const s2 = (k: string) => k === 'a' ? 'from-s2' : k === 'b' ? 'from-s2' : undefined;
    const chained = chainSources(s1, s2);
    expect(chained('a')).toBe('from-s1');
    expect(chained('b')).toBe('from-s2');
  });

  it('returns undefined if none match', () => {
    const s1 = () => undefined;
    expect(chainSources(s1)('x')).toBeUndefined();
  });
});

describe('drillFields', () => {
  it('drills into nested objects by dot path', () => {
    const map = { a: { b: { c: 42 } } };
    expect(drillFields(map, 'a.b.c')).toBe(42);
  });

  it('returns undefined for missing key', () => {
    expect(drillFields({ a: 1 }, 'b')).toBeUndefined();
  });

  it('returns undefined when hitting non-object', () => {
    expect(drillFields({ a: 'str' }, 'a.b')).toBeUndefined();
  });

  it('returns undefined when hitting array', () => {
    expect(drillFields({ a: [1, 2] }, 'a.0')).toBeUndefined();
  });

  it('single key returns top-level value', () => {
    expect(drillFields({ x: 99 }, 'x')).toBe(99);
  });
});

describe('nestedSource', () => {
  it('resolves top-level key as string', () => {
    const src = nestedSource({ grp: { val: 1 } });
    expect(src('grp')).toBe('[object Object]');
  });

  it('drills into nested keys', () => {
    const src = nestedSource({ grp: { val: 42 } });
    expect(src('grp.val')).toBe('42');
  });

  it('returns undefined for missing group', () => {
    const src = nestedSource({});
    expect(src('missing')).toBeUndefined();
  });

  it('returns undefined for missing nested field', () => {
    const src = nestedSource({ grp: { a: 1 } });
    expect(src('grp.b')).toBeUndefined();
  });
});

describe('forEachContextSource', () => {
  it('resolves simple values', () => {
    const src = forEachContextSource({ x: 'hello' }, null);
    expect(src('x')).toBe('hello');
  });

  it('drills into row fields', () => {
    const src = forEachContextSource(null, { item: { name: 'widget', price: 10 } });
    expect(src('item.name')).toBe('widget');
    expect(src('item.price')).toBe('10');
  });

  it('throws on missing field in row', () => {
    const src = forEachContextSource(null, { item: { name: 'x' } });
    expect(() => src('item.missing')).toThrow("Field 'missing' not found in 'item'");
  });

  it('throws when accessing row without field path', () => {
    const src = forEachContextSource(null, { item: { name: 'x' } });
    expect(() => src('item')).toThrow("'item' is a row");
  });

  it('returns undefined for unknown key', () => {
    const src = forEachContextSource({ a: '1' }, null);
    expect(src('unknown')).toBeUndefined();
  });
});

describe('parseForEachDirective', () => {
  it('null returns null', () => {
    expect(parseForEachDirective(null)).toBeNull();
    expect(parseForEachDirective(undefined)).toBeNull();
  });

  it('string returns group-ref', () => {
    expect(parseForEachDirective('myGroup')).toEqual({ type: 'group-ref', groupName: 'myGroup' });
  });

  it('{as, in: array} returns inline', () => {
    expect(parseForEachDirective({ as: 'item', in: [1, 2] })).toEqual({
      type: 'inline', as: 'item', in: [1, 2],
    });
  });

  it('inline without as throws', () => {
    expect(() => parseForEachDirective({ in: [1, 2] })).toThrow("'as' variable name is required");
  });

  it('{in: string} returns group-ref with in as groupName', () => {
    expect(parseForEachDirective({ in: 'items' })).toEqual({ type: 'group-ref', groupName: 'items' });
  });

  it('{as, in: string} returns group-ref with as', () => {
    expect(parseForEachDirective({ as: 'item', in: 'items' })).toEqual({
      type: 'group-ref', groupName: 'items', as: 'item',
    });
  });

  it('{as only} returns group-ref with as as groupName', () => {
    expect(parseForEachDirective({ as: 'items' })).toEqual({ type: 'group-ref', groupName: 'items' });
  });

  it('throws on array input', () => {
    expect(() => parseForEachDirective([1, 2])).toThrow('Invalid forEach value');
  });

  it('throws on invalid type', () => {
    expect(() => parseForEachDirective(42)).toThrow('Invalid forEach value');
  });
});

describe('drillOnlySource', () => {
  it('delegates resolve and disables container return', () => {
    const inner: ObjectVariableSource = {
      resolve: (name: string) => name === 'x' ? 42 : undefined,
      allowContainerReturn: () => true,
    };
    const wrapped = drillOnlySource(inner);
    expect(wrapped.resolve('x')).toBe(42);
    expect(wrapped.resolve('y')).toBeUndefined();
    expect(wrapped.allowContainerReturn()).toBe(false);
  });
});

describe('UnresolvedVariableError', () => {
  it('sets name, variableName, elementContext', () => {
    const err = new UnresolvedVariableError('foo', 'panel1', 'not found');
    expect(err.name).toBe('UnresolvedVariableError');
    expect(err.variableName).toBe('foo');
    expect(err.elementContext).toBe('panel1');
    expect(err.message).toContain("Unresolved variable 'foo'");
    expect(err.message).toContain("'panel1'");
  });
});
