export type DataSetErrorCode =
  | "FETCH_FAILED"
  | "PARSE_FAILED"
  | "SCHEMA_MISMATCH"
  | "TRANSFORM_FAILED"
  | "TIMEOUT"
  | "INVALID_REF"
  | "UNKNOWN_COLUMN"
  | "TYPE_MISMATCH"
  | "UNKNOWN_PROVIDER";

export class DataSetError extends Error {
  constructor(
    readonly code: DataSetErrorCode,
    message: string,
    readonly cause?: unknown,
  ) {
    super(`${code}: ${message}`);
    this.name = "DataSetError";
  }

  get recoverable(): boolean {
    return this.code === "FETCH_FAILED" || this.code === "TIMEOUT";
  }
}
