import { describe, it, expect } from "vitest";
import { dataSetId, columnId } from "./constructors.js";
import type { DataSetId, ColumnId } from "./types.js";

describe("branded type constructors", () => {
  it("dataSetId creates a DataSetId from a string", () => {
    const id: DataSetId = dataSetId("my-dataset");
    expect(id).toBe("my-dataset");
  });

  it("columnId creates a ColumnId from a string", () => {
    const id: ColumnId = columnId("col-1");
    expect(id).toBe("col-1");
  });

  it("DataSetId is assignable where DataSetId is expected", () => {
    const id = dataSetId("ds");
    const fn = (dsId: DataSetId) => dsId;
    expect(fn(id)).toBe("ds");
  });

  it("ColumnId is assignable where ColumnId is expected", () => {
    const id = columnId("c");
    const fn = (colId: ColumnId) => colId;
    expect(fn(id)).toBe("c");
  });
});
