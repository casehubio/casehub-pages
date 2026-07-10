import type { ColumnDef } from './types.js';

export function tableToCsv<R>(rows: readonly R[], columns: readonly ColumnDef<R>[]): string {
  const visibleColumns = columns.filter(c => c.visible !== false);

  const header = visibleColumns.map(c => escapeCsvField(c.label)).join(',');

  const dataRows = rows.map(row =>
    visibleColumns.map(col => {
      const value = col.getValue(row);
      return escapeCsvField(formatValue(value));
    }).join(',')
  );

  return [header, ...dataRows].join('\n');
}

export function downloadCsv(csv: string, filename = 'export.csv'): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(csv: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(csv);
    return true;
  } catch {
    return false;
  }
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatValue(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
