import { describe, it, expect, beforeEach, afterEach } from "vitest";
import type { DataSet, TypedDataSet, ColumnType, ColumnId } from "@casehubio/pages-data/dist/dataset/types.js";
import type { DataSetLookup } from "@casehubio/pages-data/dist/dataset/lookup.js";
import type { TableProps } from "@casehubio/pages-component";
import { toTypedDataSet } from "@casehubio/pages-data/dist/dataset/conversion.js";
import { PagesTable } from "./PagesTable.js";

// ── Helpers ───────────────────────────────────────────────────────────

function mockLookup(id: string): DataSetLookup {
  return { dataSetId: id, operations: [] } as unknown as DataSetLookup;
}

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

function queryRows(el: PagesTable): HTMLTableRowElement[] {
  return Array.from(el.shadowRoot.querySelectorAll("tbody tr"));
}

function queryCells(row: HTMLTableRowElement): (string | null)[] {
  return Array.from(row.querySelectorAll("td")).map(td => td.textContent);
}

function queryHeaders(el: PagesTable): HTMLTableCellElement[] {
  return Array.from(el.shadowRoot.querySelectorAll("thead th"));
}

/**
 * Build a hierarchical dataset with id, parentId, type, name columns.
 * Convenience for tree-table tests.
 */
function makeTreeDataSet(
  rows: [string, string | null, string, string][],
): TypedDataSet {
  return makeDataSet(
    [["id", "LABEL"], ["parentId", "LABEL"], ["type", "LABEL"], ["name", "LABEL"]],
    rows,
  );
}

function expandableProps(overrides?: Partial<TableProps>): TableProps {
  return {
    lookup: mockLookup("test"),
    expandable: {
      idColumn: "id" as ColumnId,
      parentColumn: "parentId" as ColumnId,
    },
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────

describe("PagesTable expandable rows (tree-table)", () => {
  let el: PagesTable;

  beforeEach(() => {
    el = document.createElement("pages-table");
  });

  afterEach(() => {
    if (el.isConnected) {
      el.remove();
    }
  });

  // ── Tree building ─────────────────────────────────────────────────

  describe("tree building", () => {
    it("shows only root rows when defaultExpanded is not set", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "ONCOL-001"],
        ["s1", "t1", "site", "Site A"],
        ["p1", "s1", "patient", "Patient 1"],
      ]);

      el.props = expandableProps();
      document.body.appendChild(el);
      el.totalRows = 3;
      el.dataSet = ds;

      const rows = queryRows(el);
      expect(rows).toHaveLength(1);
      const cells = queryCells(rows[0]!);
      expect(cells).toContain("ONCOL-001");
    });

    it("identifies multiple root rows (parentId is null or empty)", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "Trial A"],
        ["t2", null, "trial", "Trial B"],
        ["s1", "t1", "site", "Site A"],
        ["s2", "t2", "site", "Site B"],
      ]);

      el.props = expandableProps();
      document.body.appendChild(el);
      el.totalRows = 4;
      el.dataSet = ds;

      const rows = queryRows(el);
      expect(rows).toHaveLength(2);
    });

    it("treats empty string parentId as root", () => {
      const ds = makeTreeDataSet([
        ["t1", "", "trial", "Trial A"],
        ["s1", "t1", "site", "Site A"],
      ]);

      el.props = expandableProps();
      document.body.appendChild(el);
      el.totalRows = 2;
      el.dataSet = ds;

      const rows = queryRows(el);
      expect(rows).toHaveLength(1);
    });
  });

  // ── Expand / collapse ─────────────────────────────────────────────

  describe("expand and collapse", () => {
    it("expand toggle click shows children", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "ONCOL-001"],
        ["s1", "t1", "site", "Site A"],
        ["s2", "t1", "site", "Site B"],
      ]);

      el.props = expandableProps();
      document.body.appendChild(el);
      el.totalRows = 3;
      el.dataSet = ds;

      // Should have one root row with a toggle button
      let rows = queryRows(el);
      expect(rows).toHaveLength(1);

      const toggleBtn = rows[0]!.querySelector(".tree-toggle") as HTMLButtonElement;
      expect(toggleBtn).not.toBeNull();
      toggleBtn.click();

      rows = queryRows(el);
      expect(rows).toHaveLength(3); // root + 2 children
    });

    it("collapse hides children recursively", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "ONCOL-001"],
        ["s1", "t1", "site", "Site A"],
        ["p1", "s1", "patient", "Patient 1"],
      ]);

      el.props = expandableProps({
        expandable: {
          idColumn: "id" as ColumnId,
          parentColumn: "parentId" as ColumnId,
          defaultExpanded: true,
        },
      });
      document.body.appendChild(el);
      el.totalRows = 3;
      el.dataSet = ds;

      // All expanded initially
      let rows = queryRows(el);
      expect(rows).toHaveLength(3);

      // Collapse root — all descendants should hide
      const toggleBtn = rows[0]!.querySelector(".tree-toggle") as HTMLButtonElement;
      toggleBtn.click();

      rows = queryRows(el);
      expect(rows).toHaveLength(1);
    });

    it("toggle button shows correct icon: collapsed vs expanded", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "ONCOL-001"],
        ["s1", "t1", "site", "Site A"],
      ]);

      el.props = expandableProps();
      document.body.appendChild(el);
      el.totalRows = 2;
      el.dataSet = ds;

      const rows = queryRows(el);
      const toggleBtn = rows[0]!.querySelector(".tree-toggle") as HTMLButtonElement;
      expect(toggleBtn.textContent?.trim()).toBe("▶"); // collapsed

      toggleBtn.click();
      const updatedRows = queryRows(el);
      const updatedToggle = updatedRows[0]!.querySelector(".tree-toggle") as HTMLButtonElement;
      expect(updatedToggle.textContent?.trim()).toBe("▼"); // expanded
    });

    it("leaf rows have no toggle button", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "ONCOL-001"],
        ["s1", "t1", "site", "Site A"],
      ]);

      el.props = expandableProps({
        expandable: {
          idColumn: "id" as ColumnId,
          parentColumn: "parentId" as ColumnId,
          defaultExpanded: true,
        },
      });
      document.body.appendChild(el);
      el.totalRows = 2;
      el.dataSet = ds;

      const rows = queryRows(el);
      expect(rows).toHaveLength(2);
      // Leaf row (Site A) should not have a toggle button
      const leafToggle = rows[1]!.querySelector(".tree-toggle");
      expect(leafToggle).toBeNull();
    });
  });

  // ── defaultExpanded ───────────────────────────────────────────────

  describe("defaultExpanded", () => {
    it("defaultExpanded: 1 expands first level", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "ONCOL-001"],
        ["s1", "t1", "site", "Site A"],
        ["p1", "s1", "patient", "Patient 1"],
      ]);

      el.props = expandableProps({
        expandable: {
          idColumn: "id" as ColumnId,
          parentColumn: "parentId" as ColumnId,
          defaultExpanded: 1,
        },
      });
      document.body.appendChild(el);
      el.totalRows = 3;
      el.dataSet = ds;

      const rows = queryRows(el);
      // Root (depth 0) + first-level children (depth 1) = t1 + s1
      expect(rows).toHaveLength(2);
      expect(queryCells(rows[0]!)).toContain("ONCOL-001");
      expect(queryCells(rows[1]!)).toContain("Site A");
    });

    it("defaultExpanded: true expands all levels", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "ONCOL-001"],
        ["s1", "t1", "site", "Site A"],
        ["p1", "s1", "patient", "Patient 1"],
      ]);

      el.props = expandableProps({
        expandable: {
          idColumn: "id" as ColumnId,
          parentColumn: "parentId" as ColumnId,
          defaultExpanded: true,
        },
      });
      document.body.appendChild(el);
      el.totalRows = 3;
      el.dataSet = ds;

      const rows = queryRows(el);
      expect(rows).toHaveLength(3);
    });

    it("defaultExpanded: 2 expands two levels deep", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "ONCOL-001"],
        ["s1", "t1", "site", "Site A"],
        ["p1", "s1", "patient", "Patient 1"],
        ["v1", "p1", "visit", "Visit 1"],
      ]);

      el.props = expandableProps({
        expandable: {
          idColumn: "id" as ColumnId,
          parentColumn: "parentId" as ColumnId,
          defaultExpanded: 2,
        },
      });
      document.body.appendChild(el);
      el.totalRows = 4;
      el.dataSet = ds;

      const rows = queryRows(el);
      // depth 0: t1, depth 1: s1, depth 2: p1 — but NOT v1 (depth 3)
      expect(rows).toHaveLength(3);
    });
  });

  // ── Indentation ───────────────────────────────────────────────────

  describe("indentation", () => {
    it("child rows are indented with padding-left scaling by depth", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "ONCOL-001"],
        ["s1", "t1", "site", "Site A"],
        ["p1", "s1", "patient", "Patient 1"],
      ]);

      el.props = expandableProps({
        expandable: {
          idColumn: "id" as ColumnId,
          parentColumn: "parentId" as ColumnId,
          defaultExpanded: true,
        },
      });
      document.body.appendChild(el);
      el.totalRows = 3;
      el.dataSet = ds;

      const rows = queryRows(el);
      // First cell of each row should have indentation
      const firstCells = rows.map(r => r.querySelector("td")!);
      const indent0 = parseInt(firstCells[0]!.style.paddingLeft || "0", 10);
      const indent1 = parseInt(firstCells[1]!.style.paddingLeft || "0", 10);
      const indent2 = parseInt(firstCells[2]!.style.paddingLeft || "0", 10);

      expect(indent1).toBeGreaterThan(indent0);
      expect(indent2).toBeGreaterThan(indent1);
    });
  });

  // ── ARIA attributes ───────────────────────────────────────────────

  describe("ARIA attributes", () => {
    it("sets aria-expanded on expandable rows", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "ONCOL-001"],
        ["s1", "t1", "site", "Site A"],
      ]);

      el.props = expandableProps();
      document.body.appendChild(el);
      el.totalRows = 2;
      el.dataSet = ds;

      const rows = queryRows(el);
      expect(rows[0]!.getAttribute("aria-expanded")).toBe("false");
    });

    it("sets aria-expanded to true when expanded", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "ONCOL-001"],
        ["s1", "t1", "site", "Site A"],
      ]);

      el.props = expandableProps({
        expandable: {
          idColumn: "id" as ColumnId,
          parentColumn: "parentId" as ColumnId,
          defaultExpanded: true,
        },
      });
      document.body.appendChild(el);
      el.totalRows = 2;
      el.dataSet = ds;

      const rows = queryRows(el);
      expect(rows[0]!.getAttribute("aria-expanded")).toBe("true");
    });

    it("sets aria-level on all rows", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "ONCOL-001"],
        ["s1", "t1", "site", "Site A"],
        ["p1", "s1", "patient", "Patient 1"],
      ]);

      el.props = expandableProps({
        expandable: {
          idColumn: "id" as ColumnId,
          parentColumn: "parentId" as ColumnId,
          defaultExpanded: true,
        },
      });
      document.body.appendChild(el);
      el.totalRows = 3;
      el.dataSet = ds;

      const rows = queryRows(el);
      expect(rows[0]!.getAttribute("aria-level")).toBe("1");
      expect(rows[1]!.getAttribute("aria-level")).toBe("2");
      expect(rows[2]!.getAttribute("aria-level")).toBe("3");
    });

    it("sets aria-setsize and aria-posinset on rows", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "Trial A"],
        ["t2", null, "trial", "Trial B"],
        ["s1", "t1", "site", "Site A"],
        ["s2", "t1", "site", "Site B"],
      ]);

      el.props = expandableProps({
        expandable: {
          idColumn: "id" as ColumnId,
          parentColumn: "parentId" as ColumnId,
          defaultExpanded: true,
        },
      });
      document.body.appendChild(el);
      el.totalRows = 4;
      el.dataSet = ds;

      const rows = queryRows(el);
      // Root level: 2 roots
      expect(rows[0]!.getAttribute("aria-setsize")).toBe("2"); // Trial A
      expect(rows[0]!.getAttribute("aria-posinset")).toBe("1");
      // Children of t1: 2 children
      expect(rows[1]!.getAttribute("aria-setsize")).toBe("2"); // Site A
      expect(rows[1]!.getAttribute("aria-posinset")).toBe("1");
      expect(rows[2]!.getAttribute("aria-setsize")).toBe("2"); // Site B
      expect(rows[2]!.getAttribute("aria-posinset")).toBe("2");
      // Trial B root
      expect(rows[3]!.getAttribute("aria-setsize")).toBe("2");
      expect(rows[3]!.getAttribute("aria-posinset")).toBe("2");
    });

    it("leaf rows do not have aria-expanded", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "ONCOL-001"],
        ["s1", "t1", "site", "Site A"],
      ]);

      el.props = expandableProps({
        expandable: {
          idColumn: "id" as ColumnId,
          parentColumn: "parentId" as ColumnId,
          defaultExpanded: true,
        },
      });
      document.body.appendChild(el);
      el.totalRows = 2;
      el.dataSet = ds;

      const rows = queryRows(el);
      // Leaf row should NOT have aria-expanded
      expect(rows[1]!.hasAttribute("aria-expanded")).toBe(false);
    });
  });

  // ── Pagination by root count ──────────────────────────────────────

  describe("pagination by root count", () => {
    it("page boundaries based on root rows only", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "Trial A"],
        ["t2", null, "trial", "Trial B"],
        ["t3", null, "trial", "Trial C"],
        ["s1", "t1", "site", "Site A1"],
        ["s2", "t2", "site", "Site B1"],
      ]);

      el.props = expandableProps({ pageSize: 2 });
      document.body.appendChild(el);
      el.totalRows = 5;
      el.activePage = 0;
      el.dataSet = ds;

      // Page 1: roots t1 and t2 (collapsed), so 2 rows visible
      const rows = queryRows(el);
      expect(rows).toHaveLength(2);
      expect(queryCells(rows[0]!)).toContain("Trial A");
      expect(queryCells(rows[1]!)).toContain("Trial B");
    });

    it("expanding does not push other roots off the page", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "Trial A"],
        ["t2", null, "trial", "Trial B"],
        ["t3", null, "trial", "Trial C"],
        ["s1", "t1", "site", "Site A1"],
        ["s2", "t1", "site", "Site A2"],
      ]);

      el.props = expandableProps({ pageSize: 2 });
      document.body.appendChild(el);
      el.totalRows = 5;
      el.activePage = 0;
      el.dataSet = ds;

      // Expand Trial A
      let rows = queryRows(el);
      const toggleBtn = rows[0]!.querySelector(".tree-toggle") as HTMLButtonElement;
      toggleBtn.click();

      rows = queryRows(el);
      // Trial A + 2 children + Trial B = 4 rows visible on page 0
      expect(rows).toHaveLength(4);
      expect(queryCells(rows[0]!)).toContain("Trial A");
      expect(queryCells(rows[1]!)).toContain("Site A1");
      expect(queryCells(rows[2]!)).toContain("Site A2");
      expect(queryCells(rows[3]!)).toContain("Trial B");
    });

    it("second page shows remaining roots", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "Trial A"],
        ["t2", null, "trial", "Trial B"],
        ["t3", null, "trial", "Trial C"],
        ["s1", "t1", "site", "Site A1"],
      ]);

      el.props = expandableProps({ pageSize: 2 });
      document.body.appendChild(el);
      el.totalRows = 4;
      el.activePage = 1;
      el.dataSet = ds;

      const rows = queryRows(el);
      expect(rows).toHaveLength(1); // Only Trial C on page 2
      expect(queryCells(rows[0]!)).toContain("Trial C");
    });

    it("pagination range shows root count, not total row count", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "Trial A"],
        ["t2", null, "trial", "Trial B"],
        ["t3", null, "trial", "Trial C"],
        ["s1", "t1", "site", "Site A1"],
        ["s2", "t2", "site", "Site B1"],
      ]);

      el.props = expandableProps({ pageSize: 2 });
      document.body.appendChild(el);
      el.totalRows = 5;
      el.activePage = 0;
      el.dataSet = ds;

      const range = el.shadowRoot.querySelector(".range");
      expect(range).not.toBeNull();
      // Should reference root count (3), not total rows (5)
      expect(range!.textContent).toContain("3");
    });
  });

  // ── Filter context rows ───────────────────────────────────────────

  describe("filter context rows", () => {
    it("when text filter active, matching children show with dimmed parents", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "ONCOL-001"],
        ["s1", "t1", "site", "Matching Site"],
        ["s2", "t1", "site", "Other Site"],
      ]);

      el.props = expandableProps();
      document.body.appendChild(el);
      el.totalRows = 3;
      // Simulate text filter being active by setting _filterText
      // We need to trigger a text filter event
      el.dataSet = ds;

      // Type in filter
      const input = el.shadowRoot.querySelector<HTMLInputElement>(".filter-box input")!;
      input.value = "Matching";
      input.dispatchEvent(new Event("input"));

      // After filter, tree should show: parent (dimmed) + matching child
      const rows = queryRows(el);
      // Parent should be shown as context row (dimmed)
      const parentRow = rows.find(r => queryCells(r).includes("ONCOL-001"));
      if (parentRow) {
        expect(parentRow.classList.contains("pages-row-muted")).toBe(true);
      }
      // Matching child should be visible
      const matchingRow = rows.find(r => queryCells(r).includes("Matching Site"));
      expect(matchingRow).toBeDefined();
    });
  });

  // ── Sorting within level ──────────────────────────────────────────

  describe("sorting within level", () => {
    it("siblings are sorted among siblings only", () => {
      const ds = makeTreeDataSet([
        ["t2", null, "trial", "Beta Trial"],
        ["t1", null, "trial", "Alpha Trial"],
        ["s2", "t1", "site", "Zebra Site"],
        ["s1", "t1", "site", "Able Site"],
      ]);

      el.props = expandableProps({
        sortable: true,
        expandable: {
          idColumn: "id" as ColumnId,
          parentColumn: "parentId" as ColumnId,
          defaultExpanded: true,
        },
      });
      document.body.appendChild(el);
      el.totalRows = 4;
      // Simulate sort on name column
      el.activeSort = { columnId: "name" as ColumnId, order: "ASCENDING" };
      el.dataSet = ds;

      const rows = queryRows(el);
      // Roots sorted: Alpha Trial, Beta Trial
      expect(queryCells(rows[0]!)).toContain("Alpha Trial");
      // Children of Alpha sorted: Able Site, Zebra Site
      expect(queryCells(rows[1]!)).toContain("Able Site");
      expect(queryCells(rows[2]!)).toContain("Zebra Site");
      // Then Beta Trial
      expect(queryCells(rows[3]!)).toContain("Beta Trial");
    });
  });

  // ── Expand state preservation ─────────────────────────────────────

  describe("expand state preservation", () => {
    it("expand state persists across data re-pushes", () => {
      const ds = makeTreeDataSet([
        ["t1", null, "trial", "ONCOL-001"],
        ["s1", "t1", "site", "Site A"],
      ]);

      el.props = expandableProps();
      document.body.appendChild(el);
      el.totalRows = 2;
      el.dataSet = ds;

      // Expand root
      const toggleBtn = queryRows(el)[0]!.querySelector(".tree-toggle") as HTMLButtonElement;
      toggleBtn.click();
      expect(queryRows(el)).toHaveLength(2);

      // Re-push same data (simulating data refresh)
      el.dataSet = ds;
      expect(queryRows(el)).toHaveLength(2); // Still expanded
    });
  });
});
