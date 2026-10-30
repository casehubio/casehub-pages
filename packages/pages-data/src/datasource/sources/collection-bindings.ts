import type { DataSourceBinding } from "../types.js";
import type { ExternalColumnDef } from "../../dataset/external/types.js";
import type { DataSetId } from "../../dataset/types.js";
import { ColumnType } from "../../dataset/types.js";
import { columnId } from "../../dataset/types.js";
import { mutableRestSource } from "./mutable-rest-source.js";

export interface CollectionMeta {
  readonly name: string;
  readonly fields: readonly { name: string; type: string }[];
}

const TYPE_MAP: Record<string, ColumnType> = {
  string: ColumnType.TEXT,
  number: ColumnType.NUMBER,
  boolean: ColumnType.LABEL,
  date: ColumnType.DATE,
  enum: ColumnType.LABEL,
  ref: ColumnType.TEXT,
  array: ColumnType.TEXT,
};

function toColumns(fields: readonly { name: string; type: string }[]): ExternalColumnDef[] {
  const cols: ExternalColumnDef[] = [
    { id: columnId("id"), type: ColumnType.TEXT },
    { id: columnId("_version"), type: ColumnType.TEXT },
  ];
  for (const f of fields) {
    cols.push({ id: columnId(f.name), type: TYPE_MAP[f.type] ?? ColumnType.TEXT });
  }
  return cols;
}

export function collectionBindings(
  appId: string,
  collections: readonly CollectionMeta[],
  fetchFn?: typeof globalThis.fetch,
): DataSourceBinding[] {
  return collections.map(col => {
    const base = `/api/collections/${appId}/${col.name}`;
    return {
      id: `json:${appId}/${col.name}` as DataSetId,
      keyColumn: "id",
      source: mutableRestSource(base, {
        keyColumn: "id",
        create: { url: base },
        update: { url: `${base}/:key` },
        delete: { url: `${base}/:key` },
      }, {
        columns: toColumns(col.fields),
        ...(fetchFn !== undefined && { fetchFn }),
      }),
    };
  });
}
