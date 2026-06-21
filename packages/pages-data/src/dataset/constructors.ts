import type { DataSetId, ColumnId } from "./types.js";

export function dataSetId(id: string): DataSetId {
  return id as DataSetId;
}

export function columnId(id: string): ColumnId {
  return id as ColumnId;
}
