import { describe, it, expect } from 'vitest';
import { createComparator } from './sort.js';
import type { ColumnDef } from './types.js';

const textCol: ColumnDef = { id: 'name', label: 'Name', type: 'text', getValue: (r: any) => r.name };
const numCol: ColumnDef = { id: 'age', label: 'Age', type: 'number', getValue: (r: any) => r.age };
const dateCol: ColumnDef = { id: 'date', label: 'Date', type: 'date', getValue: (r: any) => r.date };
const customCol: ColumnDef = {
  id: 'x', label: 'X', getValue: (r: any) => r.x,
  compare: (a: unknown, b: unknown) => (a as number) - (b as number),
};

describe('createComparator', () => {
  it('returns identity for direction=none', () => {
    const cmp = createComparator(textCol, 'none');
    expect(cmp('b', 'a')).toBe(0);
  });

  it('sorts text ascending with localeCompare', () => {
    const cmp = createComparator(textCol, 'asc');
    expect(cmp('apple', 'banana')).toBeLessThan(0);
    expect(cmp('banana', 'apple')).toBeGreaterThan(0);
    expect(cmp('apple', 'apple')).toBe(0);
  });

  it('sorts text descending', () => {
    const cmp = createComparator(textCol, 'desc');
    expect(cmp('apple', 'banana')).toBeGreaterThan(0);
  });

  it('sorts numbers', () => {
    const cmp = createComparator(numCol, 'asc');
    expect(cmp(1, 10)).toBeLessThan(0);
    expect(cmp(10, 1)).toBeGreaterThan(0);
  });

  it('sorts dates', () => {
    const cmp = createComparator(dateCol, 'asc');
    expect(cmp('2024-01-01', '2024-06-01')).toBeLessThan(0);
    expect(cmp('2024-06-01', '2024-01-01')).toBeGreaterThan(0);
  });

  it('sorts nulls last in ascending', () => {
    const cmp = createComparator(textCol, 'asc');
    expect(cmp(null, 'a')).toBeGreaterThan(0);
    expect(cmp('a', null)).toBeLessThan(0);
    expect(cmp(null, null)).toBe(0);
  });

  it('sorts nulls last in descending', () => {
    const cmp = createComparator(textCol, 'desc');
    expect(cmp(null, 'a')).toBeGreaterThan(0);
    expect(cmp('a', null)).toBeLessThan(0);
  });

  it('uses custom comparator when provided', () => {
    const cmp = createComparator(customCol, 'asc');
    expect(cmp(1, 10)).toBeLessThan(0);
  });

  it('falls back to string comparison for untyped columns', () => {
    const col: ColumnDef = { id: 'x', label: 'X', getValue: (r: any) => r.x };
    const cmp = createComparator(col, 'asc');
    expect(cmp('a', 'b')).toBeLessThan(0);
  });
});
