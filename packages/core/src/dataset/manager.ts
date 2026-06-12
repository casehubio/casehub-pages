import type { DataSetId, TypedDataSet, Column } from "./types.js";
import type { DataSetLookup } from "./lookup.js";
import type { DataSetOp, ResolvedDataSetOp } from "./ops.js";
import { applyOps } from "./ops.js";
import { resolveFilterTypes } from "./filter-resolve.js";
import { DataSetError } from "./errors.js";

export interface LookupOptions {
  readonly rowOffset?: number;
  readonly rowCount?: number;
  readonly referenceDate?: Date;
}

export interface DataSetManager {
  register(id: DataSetId, dataset: TypedDataSet): void;
  get(id: DataSetId): TypedDataSet | undefined;
  remove(id: DataSetId): boolean;
  has(id: DataSetId): boolean;
  lookup(query: DataSetLookup, options?: LookupOptions): TypedDataSet;
}

function resolveOps(
  ops: readonly DataSetOp[],
  columns: readonly Column[],
): ResolvedDataSetOp[] {
  return ops.map(op => {
    if (op.type !== "filter") return op;
    return {
      type: "filter" as const,
      expressions: op.expressions.map(expr => resolveFilterTypes(expr, columns)),
    };
  });
}

function paginate(
  ds: TypedDataSet,
  offset: number,
  count: number,
): TypedDataSet {
  if (offset === 0 && count < 0) return ds;
  const start = Math.min(offset, ds.rows.length);
  const rows = count < 0
    ? ds.rows.slice(start)
    : ds.rows.slice(start, start + count);
  return { columns: ds.columns, rows };
}

class DataSetManagerImpl implements DataSetManager {
  private readonly datasets = new Map<DataSetId, TypedDataSet>();

  register(id: DataSetId, dataset: TypedDataSet): void {
    this.datasets.set(id, dataset);
  }

  get(id: DataSetId): TypedDataSet | undefined {
    return this.datasets.get(id);
  }

  remove(id: DataSetId): boolean {
    return this.datasets.delete(id);
  }

  has(id: DataSetId): boolean {
    return this.datasets.has(id);
  }

  lookup(query: DataSetLookup, options?: LookupOptions): TypedDataSet {
    const offset = options?.rowOffset ?? 0;
    if (offset < 0) {
      throw new DataSetError("INVALID_OPERATION", `rowOffset cannot be negative: ${offset}`);
    }

    const dataset = this.datasets.get(query.dataSetId);
    if (!dataset) {
      throw new DataSetError("UNKNOWN_PROVIDER", `Dataset "${query.dataSetId}" not registered`);
    }

    const resolvedOps = resolveOps(query.operations, dataset.columns);
    const opsOptions = options?.referenceDate !== undefined ? { referenceDate: options.referenceDate } : undefined;
    const result = applyOps(dataset, resolvedOps, opsOptions);
    return paginate(result, offset, options?.rowCount ?? -1);
  }
}

export function createDataSetManager(): DataSetManager {
  return new DataSetManagerImpl();
}
