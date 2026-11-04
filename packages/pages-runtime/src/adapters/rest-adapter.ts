import type { FieldViolation, SaveAdapter, SaveResult } from "../save-adapter.js";

async function parseValidationErrors(response: Response): Promise<SaveResult | undefined> {
  if (response.status !== 422) return undefined;
  try {
    const body: Record<string, unknown> = await response.json() as Record<string, unknown>;
    if (body.error === "VALIDATION_FAILED" && Array.isArray(body.violations)) {
      const fieldErrors: FieldViolation[] = (body.violations as Record<string, unknown>[]).map((v) => ({
        field: String(v.field ?? ""),
        constraint: String(v.constraint ?? ""),
        params: (v.params as Readonly<Record<string, unknown>>) ?? {},
        message: String(v.message ?? ""),
      }));
      return { success: false, error: "VALIDATION_FAILED", fieldErrors };
    }
  } catch {
    // JSON parse failed — fall through
  }
  return undefined;
}

export interface RestAdapterConfig {
  readonly method?: "PUT" | "PATCH" | "POST";
  readonly headers?: Readonly<Record<string, string>>;
}

export function createRestAdapter(
  config: RestAdapterConfig | undefined,
  datasetUrl: string,
  fetchFn: typeof globalThis.fetch,
): SaveAdapter {
  const method = config?.method ?? "PATCH";

  return {
    async save(dataSetId, record, changedFields, idColumn, idValue): Promise<SaveResult> {
      const url = `${datasetUrl}/${String(idValue)}`;
      const body: Record<string, unknown> = {};
      for (const field of changedFields) {
        body[field] = record[field];
      }

      try {
        const response = await fetchFn(url, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...config?.headers,
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const validationResult = await parseValidationErrors(response);
          if (validationResult) return validationResult;
          return { success: false, error: `HTTP ${String(response.status)}: ${response.statusText}` };
        }

        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const updatedRecord: Record<string, unknown> = await response.json() as Record<string, unknown>;
          return { success: true, updatedRecord };
        }
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async create(_dataSetId, record): Promise<SaveResult> {
      try {
        const response = await fetchFn(datasetUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...config?.headers,
          },
          body: JSON.stringify(record),
        });
        if (!response.ok) {
          const validationResult = await parseValidationErrors(response);
          if (validationResult) return validationResult;
          return { success: false, error: `HTTP ${String(response.status)}: ${response.statusText}` };
        }
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const updatedRecord: Record<string, unknown> = await response.json() as Record<string, unknown>;
          return { success: true, updatedRecord };
        }
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },

    async delete(_dataSetId, _idColumn, idValue): Promise<SaveResult> {
      const url = `${datasetUrl}/${String(idValue)}`;
      try {
        const response = await fetchFn(url, {
          method: "DELETE",
          headers: config?.headers ?? {},
        });
        if (!response.ok) {
          const validationResult = await parseValidationErrors(response);
          if (validationResult) return validationResult;
          return { success: false, error: `HTTP ${String(response.status)}: ${response.statusText}` };
        }
        return { success: true };
      } catch (err) {
        return { success: false, error: err instanceof Error ? err.message : String(err) };
      }
    },
  };
}
