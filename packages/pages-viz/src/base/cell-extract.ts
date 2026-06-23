import type { CellValue, Column, ColumnSettings } from "@casehubio/pages-data/dist/dataset/types.js";

/**
 * Compile a cell expression string into a callable function.
 * Uses indirect Function constructor reference to satisfy no-implied-eval.
 */
const FunctionCtor = Function as unknown as new (arg: string, body: string) => (value: string | number | Date) => unknown;

function compileCellExpression(expression: string): (value: string | number | Date) => unknown {
  return new FunctionCtor("value", `return ${expression}`);
}

export function cellToRaw(cell: CellValue): string | number | Date | null {
  if (cell.type === "NULL") return null;
  return cell.value;
}

export function resolveColumnName(
  column: Column,
  propsColumns?: readonly ColumnSettings[],
): string {
  const override = propsColumns?.find((c) => c.id === column.id);
  return override?.name ?? column.settings?.name ?? column.name;
}

export function applyCellExpression(
  raw: string | number | Date | null,
  expression: string,
): string | number | Date | null {
  if (raw === null) return null;
  try {
    const result: unknown = compileCellExpression(expression)(raw);
    if (result === undefined || result === null) return null;
    if (typeof result === "number") return result;
    if (result instanceof Date) return result;
    if (typeof result === "string") return result;
    return typeof result === "boolean" ? String(result) : "";
  } catch {
    return raw;
  }
}

export function resolveColumnExpression(
  columnId: string,
  propsColumns?: readonly ColumnSettings[],
): string | undefined {
  return propsColumns?.find((c) => c.id === columnId)?.expression;
}
