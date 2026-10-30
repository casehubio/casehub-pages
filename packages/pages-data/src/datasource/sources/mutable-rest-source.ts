import type { DataSink, MutableDataSource, DataAction, SourceError } from "../types.js";
import type { DataSetEvent } from "../../dataset/events.js";
import type { ReplaceEvent, RemoveEvent } from "../../dataset/events.js";
import type { Column, ColumnId, DataSetId } from "../../dataset/types.js";
import type { ExternalColumnDef } from "../../dataset/external/types.js";
import { restSource } from "./rest-source.js";
import { createTypedRow } from "../../dataset/conversion.js";
import type { CellValue } from "../../dataset/types.js";
import { ColumnType } from "../../dataset/types.js";
import { ValidationError, ConflictError } from "../errors.js";

export type UrlTemplate = string | ((action: DataAction) => string);

export interface WriteEndpoint {
  readonly url: UrlTemplate;
  readonly method?: string;
}

export interface WriteConfig {
  readonly update?: WriteEndpoint;
  readonly create?: WriteEndpoint;
  readonly delete?: WriteEndpoint;
  readonly headers?: Record<string, string>;
  readonly refreshAfterWrite?: boolean;
  readonly keyColumn?: string;
}

export interface MutableRestSourceOptions {
  readonly columns?: readonly ExternalColumnDef[];
  readonly dataPath?: string;
  readonly fetchFn?: typeof globalThis.fetch;
  readonly writeFetchFn?: typeof globalThis.fetch;
}

const DEFAULT_METHODS: Record<string, string> = {
  update: "PATCH",
  create: "POST",
  delete: "DELETE",
};

export function mutableRestSource(
  readUrl: string,
  writeConfig: WriteConfig,
  options?: MutableRestSourceOptions,
): MutableDataSource {
  const readFetchFn = options?.fetchFn ?? globalThis.fetch;
  const writeFetchFn = options?.writeFetchFn ?? options?.fetchFn ?? globalThis.fetch;
  const keyColumnId = writeConfig.keyColumn as ColumnId | undefined;

  let currentSink: DataSink | null = null;
  let columns: readonly Column[] = [];

  const readOpts: Record<string, unknown> = { fetchFn: readFetchFn };
  if (options?.columns) readOpts.columns = options.columns;
  if (options?.dataPath) readOpts.dataPath = options.dataPath;

  const inner = restSource(readUrl, "" as DataSetId, readOpts);

  const wrapperSink: DataSink = {
    apply(event: DataSetEvent): void {
      if (event.type === "snapshot") {
        columns = event.dataset.columns;
      }
      currentSink?.apply(event);
    },
    error(err: SourceError): void {
      currentSink?.error(err);
    },
  };

  function resolveUrl(endpoint: WriteEndpoint, action: DataAction): string {
    if (typeof endpoint.url === "function") return endpoint.url(action);
    if ("key" in action) return endpoint.url.replace(":key", action.key);
    return endpoint.url;
  }

  async function doRefresh(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const refreshSink: DataSink = {
        apply(event: DataSetEvent): void {
          wrapperSink.apply(event);
          resolve();
        },
        error(err: SourceError): void {
          wrapperSink.error(err);
          reject(new Error(err.message));
        },
      };
      const refreshSource = restSource(readUrl, "" as DataSetId, readOpts);
      refreshSource.connect(refreshSink);
    });
  }

  function toCellValue(value: unknown, col: Column): CellValue {
    if (value === null || value === undefined) return { type: "NULL" as const };
    switch (col.type) {
      case ColumnType.NUMBER:
        return { type: ColumnType.NUMBER, value: typeof value === "number" ? value : parseFloat(String(value)) };
      case ColumnType.DATE:
        return { type: ColumnType.DATE, value: value instanceof Date ? value : new Date(String(value)) };
      case ColumnType.LABEL:
        return { type: ColumnType.LABEL, value: String(value) };
      case ColumnType.TEXT:
      default:
        return { type: ColumnType.TEXT, value: String(value) };
    }
  }

  function responseToRow(data: Record<string, unknown>): import("../../dataset/types.js").TypedRow {
    const cells = columns.map(col => toCellValue(data[col.id as string], col));
    return createTypedRow(cells, columns);
  }

  async function dispatchAction(action: DataAction): Promise<void> {
    const endpoint = writeConfig[action.type];
    if (!endpoint) throw new Error(`Unsupported action type: ${action.type}`);

    const url = resolveUrl(endpoint, action);
    const method = endpoint.method ?? DEFAULT_METHODS[action.type] ?? "POST";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...writeConfig.headers,
    };
    if ("version" in action && action.version !== undefined) {
      headers["If-Match"] = action.version;
    }

    const init: RequestInit = { method, headers };
    if (action.type !== "delete") {
      init.body = JSON.stringify(action.type === "create" ? action.data : action.changes);
    }

    const response = await writeFetchFn(url, init);

    if (!response.ok) {
      if (response.status === 422) {
        const body = await response.json().catch(() => ({})) as Record<string, unknown>;
        const fieldErrors = (body.errors ?? {}) as Record<string, string[]>;
        throw new ValidationError(fieldErrors);
      }
      if (response.status === 409) {
        const body = await response.json().catch(() => ({})) as Record<string, unknown>;
        throw new ConflictError(body.currentVersion as string | undefined);
      }
      const text = await response.text().catch(() => "");
      throw new Error(`${String(response.status)}: ${text}`);
    }

    if (writeConfig.refreshAfterWrite) {
      await doRefresh();
      return;
    }

    const hasBody = response.status !== 204 && response.headers.get("content-length") !== "0";

    if (!hasBody) {
      await doRefresh();
      return;
    }

    const responseData = await response.json() as Record<string, unknown>;

    if (!currentSink || !keyColumnId) return;

    switch (action.type) {
      case "create":
        currentSink.apply({ type: "append", rows: [responseToRow(responseData)] });
        break;
      case "update":
        currentSink.apply({
          type: "replace",
          keyColumn: keyColumnId,
          key: action.key,
          row: responseToRow(responseData),
        } satisfies ReplaceEvent);
        break;
      case "delete":
        currentSink.apply({
          type: "remove",
          keyColumn: keyColumnId,
          key: action.key,
        } satisfies RemoveEvent);
        break;
    }
  }

  return {
    connect(sink: DataSink): void {
      currentSink = sink;
      inner.connect(wrapperSink);
    },
    disconnect(): void {
      inner.disconnect();
      currentSink = null;
    },
    dispatch(action: DataAction): Promise<void> {
      return dispatchAction(action);
    },
  };
}
