import type { DataSetId } from "@casehubio/pages-data";

export interface SaveAdapter {
  save(
    dataSetId: DataSetId,
    record: Readonly<Record<string, unknown>>,
    changedFields: readonly string[],
    idColumn: string,
    idValue: unknown,
  ): Promise<SaveResult>;

  delete?(
    dataSetId: DataSetId,
    idColumn: string,
    idValue: unknown,
  ): Promise<SaveResult>;

  create?(
    dataSetId: DataSetId,
    record: Readonly<Record<string, unknown>>,
  ): Promise<SaveResult>;
}

import type { FieldViolation } from "@casehubio/pages-component";
export type { FieldViolation } from "@casehubio/pages-component";

export interface SaveResult {
  readonly success: boolean;
  readonly error?: string;
  readonly updatedRecord?: Readonly<Record<string, unknown>>;
  readonly fieldErrors?: readonly FieldViolation[];
}
