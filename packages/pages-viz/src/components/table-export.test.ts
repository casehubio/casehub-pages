import { describe, it, expect, vi, beforeEach } from "vitest";
import type { DataSet, TypedDataSet, ColumnType, ColumnId, ColumnSettings } from "@casehubio/pages-data/dist/dataset/types.js";
import { toTypedDataSet } from "@casehubio/pages-data/dist/dataset/conversion.js";
import { tableToCsv, downloadCsv } from "./table-export.js";

function makeDataSet(
  columns: [string, string][],
  rows: (string | number | null)[][],
): TypedDataSet {
  const ds: DataSet = {
    columns: columns.map(([id, type]) => ({
      id: id as ColumnId,
      name: id,
      type: type as ColumnType,
    })),
    data: rows.map(row => row.map(cell => cell === null ? null : String(cell))),
  };
  return toTypedDataSet(ds);
}

describe("tableToCsv", () => {
  it("converts a simple dataset to CSV", () => {
    const ds = makeDataSet(
      [["name", "LABEL"], ["age", "NUMBER"]],
      [["Alice", 30], ["Bob", 25]],
    );
    const csv = tableToCsv(ds);
    expect(csv).toBe("name,age\nAlice,30\nBob,25");
  });

  it("quotes fields containing commas", () => {
    const ds = makeDataSet(
      [["city", "LABEL"]],
      [["New York, NY"]],
    );
    const csv = tableToCsv(ds);
    expect(csv).toBe('city\n"New York, NY"');
  });

  it("quotes fields containing double quotes and escapes them", () => {
    const ds = makeDataSet(
      [["quote", "LABEL"]],
      [['He said "hello"']],
    );
    const csv = tableToCsv(ds);
    expect(csv).toBe('quote\n"He said ""hello"""');
  });

  it("quotes fields containing newlines", () => {
    const ds = makeDataSet(
      [["note", "LABEL"]],
      [["line1\nline2"]],
    );
    const csv = tableToCsv(ds);
    expect(csv).toBe('note\n"line1\nline2"');
  });

  it("handles null values as empty strings", () => {
    const ds = makeDataSet(
      [["a", "LABEL"], ["b", "LABEL"]],
      [["x", null]],
    );
    const csv = tableToCsv(ds);
    expect(csv).toBe("a,b\nx,");
  });

  it("handles empty dataset", () => {
    const ds = makeDataSet(
      [["a", "LABEL"]],
      [],
    );
    const csv = tableToCsv(ds);
    expect(csv).toBe("a");
  });

  it("applies column name overrides", () => {
    const ds = makeDataSet(
      [["col1", "LABEL"], ["col2", "NUMBER"]],
      [["val", 42]],
    );
    const columnSettings: readonly ColumnSettings[] = [
      { id: "col1" as ColumnId, name: "Name" },
      { id: "col2" as ColumnId, name: "Value" },
    ];
    const csv = tableToCsv(ds, columnSettings);
    expect(csv).toBe("Name,Value\nval,42");
  });
});

describe("downloadCsv", () => {
  let createObjectURL: ReturnType<typeof vi.fn>;
  let revokeObjectURL: ReturnType<typeof vi.fn>;
  let clickedLinks: Array<{ href: string; download: string }>;

  beforeEach(() => {
    createObjectURL = vi.fn().mockReturnValue("blob:mock");
    revokeObjectURL = vi.fn();
    globalThis.URL.createObjectURL = createObjectURL;
    globalThis.URL.revokeObjectURL = revokeObjectURL;
    clickedLinks = [];
    // eslint-disable-next-line @typescript-eslint/no-deprecated -- required to capture pre-mock reference
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tag: string) => {
      if (tag === "a") {
        const link = origCreateElement("a");
        const origClick = link.click.bind(link);
        link.click = () => {
          clickedLinks.push({ href: link.href, download: link.download });
          origClick();
        };
        return link;
      }
      return origCreateElement(tag);
    });
  });

  it("creates a blob and triggers download", () => {
    downloadCsv("a,b\n1,2");

    expect(createObjectURL).toHaveBeenCalledOnce();
    expect(clickedLinks).toHaveLength(1);
    expect(clickedLinks[0]!.download).toBe("export.csv");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:mock");
  });

  it("uses custom filename", () => {
    downloadCsv("a,b\n1,2", "data.csv");

    expect(clickedLinks[0]!.download).toBe("data.csv");
  });
});
