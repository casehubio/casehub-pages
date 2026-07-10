import type { TypedDataSet, ColumnSettings } from "@casehubio/pages-data/dist/dataset/types.js";
import { cellToRaw, resolveColumnName } from "../base/cell-extract.js";

function escapeCsvField(value: string): string {
  if (value.includes(",") || value.includes('"') || value.includes("\n") || value.includes("\r")) {
    return '"' + value.replace(/"/g, '""') + '"';
  }
  return value;
}

export function tableToCsv(
  dataset: TypedDataSet,
  columnSettings?: readonly ColumnSettings[],
): string {
  const headers = dataset.columns.map(col =>
    escapeCsvField(resolveColumnName(col, columnSettings)),
  );
  const rows = dataset.rows.map(row =>
    dataset.columns.map((_col, colIdx) => {
      const cell = row.cells[colIdx];
      if (!cell) return "";
      const raw = cellToRaw(cell);
      return raw === null ? "" : escapeCsvField(String(raw));
    }).join(","),
  );
  return [headers.join(","), ...rows].join("\n");
}

export function downloadCsv(csv: string, filename = "export.csv"): void {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
