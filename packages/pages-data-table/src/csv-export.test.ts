import { describe, it, expect } from 'vitest';
import { tableToCsv } from './csv-export.js';
import type { ColumnDef } from './types.js';

interface TestRow {
  name: string;
  age: number;
  role: string;
}

const columns: ColumnDef<TestRow>[] = [
  { id: 'name', label: 'Name', getValue: (r) => r.name },
  { id: 'age', label: 'Age', type: 'number', getValue: (r) => r.age },
  { id: 'role', label: 'Role', getValue: (r) => r.role },
];

const rows: TestRow[] = [
  { name: 'Alice', age: 30, role: 'Engineer' },
  { name: 'Bob', age: 25, role: 'Designer' },
];

describe('csv-export', () => {
  describe('tableToCsv', () => {
    it('generates CSV with header and data rows', () => {
      const csv = tableToCsv(rows, columns);
      const lines = csv.split('\n');
      expect(lines).toHaveLength(3);
      expect(lines[0]).toBe('Name,Age,Role');
      expect(lines[1]).toBe('Alice,30,Engineer');
      expect(lines[2]).toBe('Bob,25,Designer');
    });

    it('escapes fields containing commas', () => {
      const commaRows = [{ name: 'Smith, John', age: 40, role: 'Lead' }];
      const csv = tableToCsv(commaRows, columns);
      expect(csv).toContain('"Smith, John"');
    });

    it('escapes fields containing double quotes', () => {
      const quoteRows = [{ name: 'The "Boss"', age: 50, role: 'CEO' }];
      const csv = tableToCsv(quoteRows, columns);
      expect(csv).toContain('"The ""Boss"""');
    });

    it('escapes fields containing newlines', () => {
      const newlineRows = [{ name: 'Line1\nLine2', age: 35, role: 'Writer' }];
      const csv = tableToCsv(newlineRows, columns);
      expect(csv).toContain('"Line1\nLine2"');
    });

    it('handles null and undefined values', () => {
      const nullColumns: ColumnDef[] = [
        { id: 'val', label: 'Value', getValue: () => null },
      ];
      const csv = tableToCsv([{}], nullColumns);
      expect(csv).toBe('Value\n');
    });

    it('excludes hidden columns', () => {
      const withHidden: ColumnDef<TestRow>[] = [
        ...columns,
        { id: 'hidden', label: 'Secret', getValue: () => 'x', visible: false },
      ];
      const csv = tableToCsv(rows, withHidden);
      expect(csv.split('\n')[0]).toBe('Name,Age,Role');
    });

    it('handles empty rows', () => {
      const csv = tableToCsv([], columns);
      expect(csv).toBe('Name,Age,Role');
    });

    it('handles Date values', () => {
      const dateColumns: ColumnDef[] = [
        { id: 'date', label: 'Date', getValue: () => new Date('2026-01-15T00:00:00.000Z') },
      ];
      const csv = tableToCsv([{}], dateColumns);
      expect(csv).toContain('2026-01-15');
    });
  });
});
