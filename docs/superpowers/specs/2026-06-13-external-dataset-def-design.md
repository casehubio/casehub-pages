# ExternalDataSetDef & Typed Data Extraction Design

Covers issue #6. Designs the external dataset definition model, pluggable data provider abstraction, extraction pipeline (JSONata + CSV + Prometheus text + type inference), named extraction presets, join, and accumulate.

**Design invariant:** All data processing (parsing, extraction, typing, join, accumulate) executes in the browser. The server-side relay is a transport option, not a processing tier.

**Relationship to Java:** This is a **superset** of the Java `ExternalDataSetDef`, not a 1:1 port. Deliberate extensions beyond Java parity: `body` field for raw request bodies (§1), `PUT`/`DELETE` HTTP methods (§1). Intentional drops: Java's `dynamic` field (dead code — no getter/setter, never marshalled), Java's `path` field (URL path composition — replaced by full URL; the TypeScript `dataPath` field is a different concept, see §1).

---

## 1. ExternalDataSetDef — the definition model

Describes *what* data to get and *how* to transform it. Pure data structure, fully serializable to/from YAML.

### Types

```typescript
enum HttpMethod {
  GET = "GET",
  POST = "POST",
  PUT = "PUT",
  DELETE = "DELETE",
}
```

**Divergence from Java:** Java has `GET`, `POST`, `HEAD`. TypeScript adds `PUT`, `DELETE` (useful for REST APIs) and drops `HEAD` (useless for data fetching — returns no body).

```typescript
interface ExternalColumnDef {
  readonly id: ColumnId;
  readonly name?: string;
  readonly type: ColumnType;
}
```

When `name` is omitted, it defaults to `id` during `Column` construction. This matches the Java `DataColumnDef` which also has only `id` and `type` — the Java runtime uses `id` as the display name when no explicit name is set.

```typescript
interface ExternalDataSetDef {
  readonly uuid: DataSetId;
  readonly name?: string;

  // Data source — exactly one of: url, content, join
  readonly url?: string;
  readonly content?: string;
  readonly join?: readonly DataSetId[];

  // HTTP request config (only when url is set)
  readonly method?: HttpMethod;                          // default GET
  readonly headers?: Readonly<Record<string, string>>;
  readonly query?: Readonly<Record<string, string>>;
  readonly form?: Readonly<Record<string, string>>;      // application/x-www-form-urlencoded
  readonly body?: string;                                // raw request body (JSON, XML, etc.)

  // Extraction — composable pipeline, not mutually exclusive (see §3)
  readonly dataPath?: string;                            // JSON navigation (dot-separated property access)
  readonly type?: string;                                // named preset (e.g. "prometheus")
  readonly expression?: string;                          // custom JSONata transform

  // Column schema (explicit or inferred)
  readonly columns?: readonly ExternalColumnDef[];

  // Lifecycle
  readonly cacheEnabled?: boolean;
  readonly cacheMaxRows?: number;
  readonly refreshTime?: string;                         // "10minute", "30second"
  readonly accumulate?: boolean;
}
```

**`body` field:** New capability beyond Java parity. The Java `ExternalDataSetDef` has no `body` — it only supports form-encoded POST bodies via `FormData`. The `body` field enables raw request bodies (JSON, XML) needed by APIs like Elasticsearch. `body` and `form` are mutually exclusive.

**`form` field:** Sends `application/x-www-form-urlencoded` data. The Java code uses browser `FormData` (which auto-sets `multipart/form-data`), but `Record<string, string>` cannot express multi-value keys or file uploads. For dashboard data fetching, URL-encoding is the correct default. If multipart is needed in future, it's a backwards-compatible addition.

**`dataPath` field (renamed from `path`):** This is JSON navigation — dot-separated property access (e.g. `"data.items"`), NOT URL path composition. The Java `ExternalDataSetDef.path` is a URL path appended to the base URL (`new URL(def.getPath(), url)`). These are completely different concepts. The Java URL-path behavior is dropped — the URL field should contain the full path. `dataPath` is the new name for the JSON navigation concept to avoid confusion.

### Validation rules

- Must have exactly one of `url`, `content`, or `join`
- `method`, `headers`, `query`, `form`, `body` are only valid when `url` is set
- `form` and `body` are mutually exclusive
- `dataPath`, `type`, and `expression` are only valid when `url` or `content` is set (not `join` — there's nothing to extract from a join)
- `accumulate` is only valid when `url` is set
- `refreshTime` is only valid when `url` is set
- `uuid` is required

**Not in the validation rules:** `type` and `expression` are NOT mutually exclusive. They compose — see §3. `dataPath` can combine with either or both.

---

## 2. DataProvider — the fetch abstraction

A pure fetch strategy. Takes a request descriptor, returns raw data with content type. Knows nothing about datasets, columns, or extraction.

### Interface

```typescript
interface DataRequest {
  readonly url: string;
  readonly method: HttpMethod;
  readonly headers: Readonly<Record<string, string>>;
  readonly query: Readonly<Record<string, string>>;
  readonly form?: Readonly<Record<string, string>>;
  readonly body?: string;
}

interface FetchResult {
  readonly data: unknown;
  readonly contentType?: string;
}

interface DataProvider {
  fetch(request: DataRequest): Promise<FetchResult>;
}
```

### Five implementations

**BrowserFetchProvider** — calls `fetch()` directly. Default for browser deployments. CORS is the deployer's problem. Parses JSON responses automatically; returns raw string for non-JSON content types.

**CorsProxyProvider** — decorator pattern. Takes a `DataProvider` in its constructor and rewrites the request URL through a configurable proxy prefix before delegating. e.g. `https://api.github.com/...` becomes `https://my-proxy.com/https://api.github.com/...`. Composable: wrap `BrowserFetchProvider` or `ServerRelayProvider`.

```typescript
class CorsProxyProvider implements DataProvider {
  constructor(
    private readonly inner: DataProvider,
    private readonly proxyUrl: string,
  ) {}

  fetch(request: DataRequest): Promise<FetchResult> {
    return this.inner.fetch({
      ...request,
      url: this.proxyUrl + request.url,
    });
  }
}
```

**ServerRelayProvider** — sends the entire `DataRequest` as a POST body to a server endpoint (e.g. `/api/data-fetch`). The server executes the real HTTP call and returns the raw response. For deployments that have a backend.

**InlineProvider** — returns the `content` string directly with no HTTP call. Used when `ExternalDataSetDef.content` is set. Returns `{ data: content, contentType: undefined }`.

**PostMessageProvider** — listens for data pushed via `window.postMessage`. The host application fetches data externally and pushes it in. Returns a Promise that resolves when a matching message arrives.

**Matching strategy:** Messages must conform to a defined shape:

```typescript
interface MelvizDataMessage {
  readonly type: "melviz-dataset";
  readonly dataSetId: string;
  readonly data: unknown;
  readonly contentType?: string;
}
```

The provider registers a `message` event listener filtered by `type === "melviz-dataset"` and `dataSetId` matching the requested dataset. This allows concurrent datasets via postMessage without ambiguity. The Promise rejects after a configurable timeout if no matching message arrives.

### Provider selection

```typescript
interface DataProviderConfig {
  readonly defaultProvider?: "browser" | "server-relay";
  readonly corsProxy?: {
    readonly url: string;
    readonly enabled: boolean;
  };
  readonly serverRelay?: {
    readonly endpoint: string;
  };
}

interface DataProviderFactory {
  create(def: ExternalDataSetDef, config: DataProviderConfig): DataProvider;
}
```

Resolution logic (factory composes internally):
1. `def.content` set → `InlineProvider`
2. `def.join` set → no provider needed (join happens downstream)
3. `def.url` set + `config.corsProxy.enabled` → `CorsProxyProvider` wrapping the resolved default
4. `def.url` set + `config.defaultProvider === "server-relay"` → `ServerRelayProvider`
5. `def.url` set (default) → `BrowserFetchProvider`
6. PostMessage provider is registered externally by the host, not auto-selected

---

## 3. Extraction Pipeline — raw data to TypedDataSet

Raw data goes in, a `TypedDataSet` comes out. Four stages: parse → navigate/extract → tabulate → convert.

```typescript
interface ExtractionResult {
  readonly dataset: TypedDataSet;
  readonly inferredColumns: boolean;
}

function extractDataSet(
  result: FetchResult,
  def: ExternalDataSetDef,
  presetRegistry: PresetRegistry,
): Promise<ExtractionResult>
```

Async because JSONata evaluation is async (inherited constraint from the bridge).

### Stage 1: Parse — raw response to structured data

Content type detection:

1. `contentType` is `text/csv` or `application/csv` → CSV parser
2. `contentType` is `application/json` or `*/json` → JSON (already parsed by fetch)
3. URL ends in `metrics` (no dot — matches `/metrics`, `/api/v1/metrics`) or `contentType` is `text/plain` and data matches Prometheus text format → Prometheus text parser (see §3.1)
4. No content type or ambiguous → try `JSON.parse`, fallback to CSV
5. File extension hint from URL (`.csv`, `.json`) used as tiebreaker when content type is missing (static file servers often return `text/plain`)

**Inline content auto-detection:** When `content` is set, the InlineProvider returns no content type. The pipeline tries JSON.parse first; if that fails, treats as CSV. This means inline `content` supports both JSON and CSV via auto-detection, with JSON attempted first.

Errors at this stage produce `DataSetError("PARSE_FAILED", ...)`.

### Stage 1.1: Prometheus text exposition format

The Java codebase has a `MetricsParser` that converts Prometheus text exposition format (line-based `metric_name{label="value"} 42.0`) into a JSON array. This is required for dashboards like the Kepler examples that fetch from raw `/metrics` endpoints.

The parser converts each metrics line into a 3-element array: `[metric_name, labels_string, value]`. Comment lines (starting with `#`) are skipped. `NaN` values are replaced with `"-1"`.

Output: a JSON array of arrays (Shape C) — ready for the extraction stage.

### Stage 2: Extract — composable three-stage pipeline

**This is a composable pipeline, not a precedence-based alternative.** Each stage is optional. They run in sequence when present. This matches the Java behavior (ExternalDataSetClientProvider.java lines 216-233) where `type` expression runs first, then `expression` runs on its output.

```
Parsed data
  ↓
Stage 2a: dataPath (optional) — navigate to subtree
  ↓
Stage 2b: type (optional) — apply preset JSONata expression
  ↓
Stage 2c: expression (optional) — apply custom JSONata transform
  ↓
Result: must be in a recognized tabular shape
```

**Stage 2a — `dataPath`:** Navigate into the data by dot-separated property access (e.g. `"data.items"` → `obj.data.items`). No JSONata, no array indexing — just `obj.key.key` traversal. The result replaces the input for subsequent stages.

**Stage 2b — `type` (preset):** Resolve the preset's JSONata expression from the registry, evaluate it against the current data. The preset typically reshapes complex API responses into a recognized tabular shape.

**Stage 2c — `expression` (custom JSONata):** Evaluate the user's JSONata expression against the current data. This can further filter, transform, or reshape the output of a preset.

**Example of composition:** `type: prometheus` extracts the standard tabular structure, then `expression: "$[value > 100]"` filters rows where value exceeds 100. The user gets the Prometheus boilerplate for free and only writes the domain-specific part.

**Fallback:** If no extraction stages are specified (`dataPath`, `type`, and `expression` are all absent), use the parsed data as-is. It must be in a recognized tabular shape.

### Canonical tabular shapes

What the pipeline output (or raw data) must resolve to:

```
Shape A: { columns: [{id, type}], values: [[v, v, ...], ...] }
Shape B: [{ key: value, key: value }, ...]
Shape C: [[v, v, ...], [v, v, ...], ...]
```

**Shape A** is explicit — columns and values are declared. This is what the Prometheus preset returns.
**Shape B** is common — API responses are typically arrays of objects. Column IDs come from object keys, order from the first object.
**Shape C** is positional — column IDs are auto-generated (`Column 0`, `Column 1`, ...).

### Stage 3: Tabulate — shape to DataSet (wire format)

Converts the recognized shape into a `DataSet` (the wire format: typed columns + string cell arrays). This is where column schema is applied. The tabulation step constructs the `DataSet` literal directly — `{ columns: [...], data: [...] }` — there is no `DataSetFactory` in the TypeScript codebase. Values are coerced to strings (numbers via `String()`, dates via `.toISOString()`, nulls preserved as `null`).

**If `def.columns` is declared (explicit):**
- Map extracted columns to declared columns by `id`
- Validate every declared column exists in the extracted data
- Apply the declared `ColumnType`
- Set `name` to `def.columns[i].name ?? def.columns[i].id`

**If `def.columns` is omitted (inference):**
- **Always infer from the pipeline output** — whatever data the last extraction stage (dataPath → type → expression) produced. If no extraction ran, infer from the parsed raw data, using content-type-specific logic (CSV headers for CSV, metric column detection for Prometheus text).
- **Intentional divergence from Java:** The Java code (ExternalDataSetClientProvider.java:226-236) has a gate where column inference runs on the *raw response text* even when `type` ran — the `else if` branches off `expression`, not `type`. This is a bug: inferring columns from a raw Prometheus JSON response (complex nested structure) when the preset has already reshaped it into a tabular format produces garbage columns. The TypeScript version fixes this by always inferring from the pipeline output.
- Inference rules: numbers → `NUMBER`, ISO date strings → `DATE`, everything else → `LABEL`
- Matches Java `ExternalDataSetJSONParser.findValueType()` for the inference rules themselves
- Column names default to column IDs

### Stage 4: Convert — DataSet to TypedDataSet

Calls the existing `toTypedDataSet(ds: DataSet)` from `conversion.ts`. This handles null cells, string → typed value parsing, and `SCHEMA_MISMATCH` errors. No new code — reuses existing, tested conversion logic.

The extraction pipeline's output is `ExtractionResult`:
```typescript
interface ExtractionResult {
  readonly dataset: TypedDataSet;   // from toTypedDataSet()
  readonly inferredColumns: boolean;
}
```

---

## 4. Extraction Presets — named JSONata templates

A registry of pre-built JSONata expressions for common APIs.

### Interface

```typescript
interface ExtractionPreset {
  readonly id: string;
  readonly expression: string;
}

interface PresetRegistry {
  get(id: string): ExtractionPreset | undefined;
  has(id: string): boolean;
}

function createPresetRegistry(
  custom?: readonly ExtractionPreset[],
): PresetRegistry
```

The factory pre-loads built-in presets and merges any custom presets provided at construction time. The returned `PresetRegistry` is **read-only** — no `register()` method. Custom presets are passed into the factory alongside built-ins. This makes the registry construction explicit and the lifecycle clear: presets are fixed for the lifetime of the registry.

If `def.type` references a preset not in the registry → `DataSetError("UNKNOWN_PRESET", ...)` (fail fast).

### Built-in presets

Each preset below describes the semantics (input shape → output shape). The actual JSONata expressions are implementation details — the implementer writes them guided by the input/output examples. Each preset's example data doubles as a test fixture.

#### 4.1 `prometheus`

Transforms Prometheus HTTP API responses into tabular data. Handles `scalar`, `matrix`, and `vector` result types.

**Raw input (vector):**
```json
{
  "status": "success",
  "data": {
    "resultType": "vector",
    "result": [
      {
        "metric": { "__name__": "up", "instance": "localhost:9090", "job": "prometheus" },
        "value": [1686700000, "1"]
      },
      {
        "metric": { "__name__": "up", "instance": "localhost:9100", "job": "node" },
        "value": [1686700000, "0"]
      }
    ]
  }
}
```

**Extracted output:**
| timestamp | value | instance | job |
|-----------|-------|----------|-----|
| 1686700000000 | 1 | localhost:9090 | prometheus |
| 1686700000000 | 0 | localhost:9100 | node |

Columns: `timestamp` (number), `value` (number), then one column per unique metric label key.

**Raw input (matrix):**
```json
{
  "status": "success",
  "data": {
    "resultType": "matrix",
    "result": [
      {
        "metric": { "instance": "localhost:9090" },
        "values": [[1686700000, "1.5"], [1686700060, "1.7"]]
      }
    ]
  }
}
```

**Extracted output:**
| timestamp | value | instance |
|-----------|-------|----------|
| 1686700000000 | 1.5 | localhost:9090 |
| 1686700060000 | 1.7 | localhost:9090 |

**Raw input (scalar):**
```json
{
  "status": "success",
  "data": {
    "resultType": "scalar",
    "result": [1686700000, "42"]
  }
}
```

**Extracted output:**
| timestamp | value |
|-----------|-------|
| 1686700000000 | 42 |

Timestamps are multiplied by 1000 (Prometheus uses Unix seconds; output is milliseconds).

#### 4.2 `elasticsearch`

Transforms Elasticsearch search responses into tabular data. Unwraps `hits.hits[]._source` and includes `_id`, `_score`, and `_index` as columns.

**Raw input:**
```json
{
  "took": 5,
  "hits": {
    "total": { "value": 2, "relation": "eq" },
    "max_score": 1.0,
    "hits": [
      {
        "_index": "logs-2024",
        "_id": "abc123",
        "_score": 1.0,
        "_source": {
          "timestamp": "2024-06-13T10:00:00Z",
          "level": "ERROR",
          "message": "Connection refused"
        }
      },
      {
        "_index": "logs-2024",
        "_id": "def456",
        "_score": 0.8,
        "_source": {
          "timestamp": "2024-06-13T10:01:00Z",
          "level": "WARN",
          "message": "Timeout exceeded"
        }
      }
    ]
  }
}
```

**Extracted output:**
| _index | _id | _score | timestamp | level | message |
|--------|-----|--------|-----------|-------|---------|
| logs-2024 | abc123 | 1.0 | 2024-06-13T10:00:00Z | ERROR | Connection refused |
| logs-2024 | def456 | 0.8 | 2024-06-13T10:01:00Z | WARN | Timeout exceeded |

#### 4.3 `graphql-relay`

Transforms GraphQL Relay connection responses into tabular data. Unwraps `edges[].node`, discards pagination metadata (`pageInfo`, `cursor`).

The expression operates on the connection object itself — the caller uses `dataPath` to navigate to the connection field first (e.g. `dataPath: "data.repository.issues"`).

**Raw input (after dataPath navigation):**
```json
{
  "edges": [
    {
      "cursor": "Y3Vyc29yOnYyOpHOABC",
      "node": {
        "title": "Fix login bug",
        "state": "OPEN",
        "createdAt": "2024-06-01T08:00:00Z",
        "author": { "login": "alice" }
      }
    },
    {
      "cursor": "Y3Vyc29yOnYyOpHOABD",
      "node": {
        "title": "Add dark mode",
        "state": "CLOSED",
        "createdAt": "2024-06-02T14:30:00Z",
        "author": { "login": "bob" }
      }
    }
  ],
  "pageInfo": {
    "hasNextPage": true,
    "endCursor": "Y3Vyc29yOnYyOpHOABD"
  }
}
```

**Extracted output:**
| title | state | createdAt | author.login |
|-------|-------|-----------|--------------|
| Fix login bug | OPEN | 2024-06-01T08:00:00Z | alice |
| Add dark mode | CLOSED | 2024-06-02T14:30:00Z | bob |

Nested objects are flattened with dot-separated keys.

#### 4.4 `jsonapi`

Transforms JSON:API responses into tabular data. Flattens `data[].attributes` alongside `data[].id` and `data[].type`.

**Raw input:**
```json
{
  "data": [
    {
      "type": "articles",
      "id": "1",
      "attributes": {
        "title": "JSON:API Paints My Bikeshed",
        "body": "The shortest article ever.",
        "created": "2024-05-20T10:00:00Z"
      }
    },
    {
      "type": "articles",
      "id": "2",
      "attributes": {
        "title": "Rails Is Omakase",
        "body": "There are lots of choices.",
        "created": "2024-05-21T12:00:00Z"
      }
    }
  ],
  "links": {
    "self": "https://example.com/articles?page[number]=1",
    "next": "https://example.com/articles?page[number]=2"
  }
}
```

**Extracted output:**
| id | type | title | body | created |
|----|------|-------|------|---------|
| 1 | articles | JSON:API Paints My Bikeshed | The shortest article ever. | 2024-05-20T10:00:00Z |
| 2 | articles | Rails Is Omakase | There are lots of choices. | 2024-05-21T12:00:00Z |

#### 4.5 `odata`

Transforms OData v4 responses into tabular data. Extracts from `value[]`, strips `@odata.*` annotations from each entity.

**Raw input:**
```json
{
  "@odata.context": "https://services.odata.org/V4/OData/$metadata#Products",
  "@odata.count": 100,
  "value": [
    {
      "ID": 1,
      "Name": "Milk",
      "Price": 2.50,
      "ReleaseDate": "2024-01-15",
      "@odata.etag": "W/\"MjAyNC0wNi0xM1QxMDowMDowMFo=\""
    },
    {
      "ID": 2,
      "Name": "Bread",
      "Price": 3.00,
      "ReleaseDate": "2024-02-20",
      "@odata.etag": "W/\"MjAyNC0wNi0xM1QxMDowMTowMFo=\""
    }
  ],
  "@odata.nextLink": "https://services.odata.org/V4/OData/Products?$skip=2"
}
```

**Extracted output:**
| ID | Name | Price | ReleaseDate |
|----|------|-------|-------------|
| 1 | Milk | 2.50 | 2024-01-15 |
| 2 | Bread | 3.00 | 2024-02-20 |

`@odata.*` properties on both the root and individual entities are stripped.

#### 4.6 `kubernetes-pods`

Transforms Kubernetes Metrics API pod metrics into tabular data. Reshapes the nested `containers[].usage` structure into flat rows.

**Raw input (`/apis/metrics.k8s.io/v1beta1/pods`):**
```json
{
  "kind": "PodMetricsList",
  "apiVersion": "metrics.k8s.io/v1beta1",
  "items": [
    {
      "metadata": {
        "name": "nginx-7f4b6d8c9-abc",
        "namespace": "default",
        "creationTimestamp": "2024-06-13T10:00:00Z"
      },
      "timestamp": "2024-06-13T10:05:00Z",
      "window": "30s",
      "containers": [
        {
          "name": "nginx",
          "usage": { "cpu": "50m", "memory": "64Mi" }
        }
      ]
    },
    {
      "metadata": {
        "name": "api-server-5b7d9f-xyz",
        "namespace": "production",
        "creationTimestamp": "2024-06-13T09:00:00Z"
      },
      "timestamp": "2024-06-13T10:05:00Z",
      "window": "30s",
      "containers": [
        {
          "name": "api",
          "usage": { "cpu": "200m", "memory": "256Mi" }
        },
        {
          "name": "sidecar",
          "usage": { "cpu": "10m", "memory": "32Mi" }
        }
      ]
    }
  ]
}
```

**Extracted output:**
| pod | namespace | container | cpu | memory | timestamp |
|-----|-----------|-----------|-----|--------|-----------|
| nginx-7f4b6d8c9-abc | default | nginx | 50m | 64Mi | 2024-06-13T10:05:00Z |
| api-server-5b7d9f-xyz | production | api | 200m | 256Mi | 2024-06-13T10:05:00Z |
| api-server-5b7d9f-xyz | production | sidecar | 10m | 32Mi | 2024-06-13T10:05:00Z |

One row per container. Pods with multiple containers produce multiple rows.

---

## 5. Join — combining multiple datasets

Merges multiple already-registered datasets into a single dataset by appending rows (vertical concatenation / UNION ALL).

```typescript
function joinDataSets(
  ids: readonly DataSetId[],
  manager: DataSetManager,
): TypedDataSet
```

### Rules

- All referenced datasets must already be registered in the DataSetManager
- Column schemas must match exactly — same IDs, same types, same order
- Missing dataset → `DataSetError("UNKNOWN_PROVIDER", ...)`
- Schema mismatch → `DataSetError("SCHEMA_MISMATCH", ...)`
- Result rows concatenated in listed order
- Result gets its own `uuid` and is registered in the manager

When `join` is set, `url` and `content` must be absent. No DataProvider is involved. The extraction pipeline is skipped — joined datasets are already typed. Extraction fields (`dataPath`, `type`, `expression`) are rejected at validation time on join definitions (see §8 validation rules).

---

## 6. Accumulate — appending successive fetches

Enables time-series growth: each refresh fetch appends new rows rather than replacing.

### Semantics (matching Java behavior)

The Java `accumulateDataSet()` (ExternalDataSetClientProvider.java lines 304-317) puts **new data first**, then appends old rows up to `cacheMaxRows`. New rows always survive; oldest rows are shed. Precisely:

1. Start with the newly fetched dataset (new rows are the base)
2. Append rows from the existing dataset, oldest first
3. Stop when the total row count reaches `cacheMaxRows`
4. If the new fetch has zero rows, keep the existing dataset unchanged

This means `cacheMaxRows` is a **hard cap on total rows**. New data takes priority; old data fills the remaining capacity.

### Behavior summary

- First fetch: normal extraction → register
- Subsequent fetches (triggered by `refreshTime`): extract new data, combine with existing per the semantics above
- Column schemas must match between existing and new data — mismatch preserves existing dataset unchanged with `DataSetError("SCHEMA_MISMATCH", ...)`
- `accumulate: false` (default): each refresh replaces entirely

### DataSetManager extension

```typescript
interface DataSetManager {
  register(id: DataSetId, dataset: TypedDataSet): void;
  accumulate(id: DataSetId, dataset: TypedDataSet, maxRows?: number): void;
  get(id: DataSetId): TypedDataSet | undefined;
  remove(id: DataSetId): boolean;
  has(id: DataSetId): boolean;
  lookup(query: DataSetLookup, options?: LookupOptions): TypedDataSet;
}
```

`accumulate()` implements the new-data-first semantics described above. If no dataset is currently registered for the ID, it behaves like `register()`.

---

## 7. ExternalDataSetResolver — the orchestrator

Top-level function that ties everything together.

### Interface

```typescript
interface ResolverContext {
  readonly manager: DataSetManager;
  readonly providerFactory: DataProviderFactory;
  readonly providerConfig: DataProviderConfig;
  readonly presetRegistry: PresetRegistry;
}

interface ResolveResult {
  readonly dataset: TypedDataSet;
  readonly inferredColumns: boolean;
  readonly source: "url" | "content" | "join";
}

function resolveExternalDataSet(
  def: ExternalDataSetDef,
  ctx: ResolverContext,
): Promise<ResolveResult>
```

### Resolution flow

```
1. Validate def (uuid required, exactly one of url/content/join, etc.)
        ↓
2. Route by source type:
   ├─ join    → joinDataSets(def.join, ctx.manager) → register → done
   ├─ content → InlineProvider.fetch() → extraction pipeline
   └─ url     → providerFactory.create(def, config).fetch(request) → extraction pipeline
        ↓
3. Extraction pipeline:
   a. Parse raw data (JSON, CSV, or Prometheus text — content-type aware)
   b. Navigate (dataPath), extract (type preset), transform (expression) — composable pipeline
   c. Tabulate: shape → DataSet (wire format with typed columns)
   d. Convert: toTypedDataSet(ds) → TypedDataSet
        ↓
4. Register result:
   ├─ accumulate: true  → manager.accumulate(def.uuid, dataset, def.cacheMaxRows)
   └─ accumulate: false → manager.register(def.uuid, dataset)
        ↓
5. Return ResolveResult
```

### Error codes

Extends the existing `DataSetErrorCode` union in `errors.ts`. Uses existing codes where they match; adds new codes for external-specific concerns:

| Code | Source | Existing? |
|------|--------|-----------|
| `PARSE_FAILED` | Parse stage | Existing |
| `SCHEMA_MISMATCH` | Type validation, accumulate, join | Existing |
| `FETCH_FAILED` | DataProvider.fetch() | Existing |
| `UNKNOWN_PROVIDER` | Join references unregistered dataset | Existing |
| `UNKNOWN_PRESET` | def.type not in registry | **New** |
| `EXTRACTION_ERROR` | JSONata expression failed at runtime | **New** |
| `INVALID_DEFINITION` | Validation failure | **New** |
| `EMPTY_RESULT` | Extraction produced zero rows and zero columns | **New** |

No separate `ExternalDataSetErrorCode` type. The four new codes are added to the existing `DataSetErrorCode` union. All errors use the existing `DataSetError` class.

Each error carries the `DataSetId` in the message for identification when resolving multiple datasets.

### Ordering

When a dashboard defines multiple `ExternalDataSetDef`s, they must be resolved in dependency order. Join defs depend on the datasets they reference. The resolver does not handle ordering — the caller (dashboard loader) topologically sorts definitions before calling `resolveExternalDataSet` for each. Circular join references are detected at validation time.

---

## 8. Validation — Zod schemas

Runtime validation when parsed from YAML. Follows the `DataSetLookup` Zod schema pattern from issue #5.

```typescript
const ExternalColumnDefSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  type: z.nativeEnum(ColumnType),
});

const ExternalDataSetDefSchema = z.object({
  uuid: z.string().min(1),
  name: z.string().optional(),

  url: z.string().optional(),
  content: z.string().optional(),
  join: z.array(z.string().min(1)).min(1).optional(),

  method: z.nativeEnum(HttpMethod).optional(),
  headers: z.record(z.string()).optional(),
  query: z.record(z.string()).optional(),
  form: z.record(z.string()).optional(),
  body: z.string().optional(),

  dataPath: z.string().optional(),
  expression: z.string().optional(),
  type: z.string().optional(),

  columns: z.array(ExternalColumnDefSchema).optional(),

  cacheEnabled: z.boolean().optional(),
  cacheMaxRows: z.number().int().positive().optional(),
  refreshTime: z.string().regex(
    /^\d+(millisecond|second|minute|hour|day|week|month|quarter|year)$/,
    "Must be a number followed by a time unit (e.g. '10minute', '30second', '1hour')",
  ).optional(),
  accumulate: z.boolean().optional(),
}).refine(
  d => [d.url, d.content, d.join].filter(Boolean).length === 1,
  { message: "Exactly one of url, content, or join is required" },
).refine(
  d => !(d.form && d.body),
  { message: "form and body are mutually exclusive" },
).refine(
  d => d.url !== undefined || [d.method, d.headers, d.query, d.form, d.body]
    .every(v => v === undefined),
  { message: "method, headers, query, form, body are only valid when url is set" },
).refine(
  d => !d.join || [d.dataPath, d.type, d.expression]
    .every(v => v === undefined),
  { message: "dataPath, type, expression are not valid with join (nothing to extract)" },
).refine(
  d => !d.accumulate || d.url !== undefined,
  { message: "accumulate is only valid when url is set" },
).refine(
  d => !d.refreshTime || d.url !== undefined,
  { message: "refreshTime is only valid when url is set" },
);
```

**Note:** `type` and `expression` have NO mutual exclusivity refinement — they compose as a pipeline (§3). `dataPath` also composes with both.

**`refreshTime` validation:** The schema validates the format string against the pattern used by the Java `TimeAmount.parse()`. The parsing into a numeric millisecond interval is the responsibility of the refresh loop (deferred to `LocalDataService`).

The TypeScript interface is inferred from the schema with `z.infer<typeof ExternalDataSetDefSchema>`.

---

## 9. CSV Parsing

### Detection

If raw data is a string and fails `JSON.parse`, attempt CSV parsing. Also forced when response `Content-Type` is `text/csv` or `application/csv`. File extension (`.csv`) from the URL is used as a tiebreaker when content type is missing.

### Parser

```typescript
interface CsvParseOptions {
  readonly delimiter?: string;    // default ","
  readonly hasHeader?: boolean;   // default true
  readonly quote?: string;        // default '"'
}

function parseCsv(
  raw: string,
  options?: CsvParseOptions,
): { headers: string[]; rows: string[][] }
```

**Rules:**
- If `hasHeader` is true, first row becomes column IDs. If false, columns are auto-generated (`Column 0`, `Column 1`, ...) — matching Java's `COLUMN_PREFIX` convention
- Handles quoted fields containing delimiters and newlines (RFC 4180)
- Empty lines are skipped
- Trailing delimiter on a row produces an empty final field

**No external dependency.** Inline parser, no library.

### Integration with extraction pipeline

- CSV produces Shape C (array of arrays) if no header, or Shape B (array of objects) if header row present
- Column typing follows the same inference rules as JSON
- JSONata expressions can run on the parsed output (receives the parsed array, not raw CSV string)

`CsvParseOptions` is not exposed on `ExternalDataSetDef` in this version. The defaults cover the vast majority of CSV files. Custom delimiters are a backwards-compatible future addition.

---

## 10. Lifecycle Field Interaction Matrix

The lifecycle fields (`cacheEnabled`, `cacheMaxRows`, `refreshTime`, `accumulate`) interact. The Java behavior (ExternalDataSetClientProvider.handleCache, lines 282-301) defines the semantics:

| `accumulate` | `cacheEnabled` | `refreshTime` | Behavior |
|---|---|---|---|
| `false` | `true` | set | Data cached. On refresh timer expiry, cached data is evicted — next lookup triggers a re-fetch. |
| `false` | `true` | absent | Data cached indefinitely for the dashboard session. |
| `false` | `false` | — | Data evicted from manager immediately after each lookup completes. Every lookup triggers a fresh fetch. |
| `true` | — | set | `cacheEnabled` is irrelevant — accumulate overrides. Each refresh timer tick fetches new data and appends (new-first semantics, §6). `cacheMaxRows` caps total rows. |
| `true` | — | absent | Accumulate with no refresh: data fetched once. Subsequent programmatic calls to `resolveExternalDataSet` append. |

**Key interactions:**
- `accumulate: true` skips cache invalidation entirely (Java: `handleCache` returns early when `accumulate` is true). They are independent dimensions.
- `cacheMaxRows` applies to both accumulate (rolling window cap) and non-accumulate (truncation limit after extraction).
- `cacheEnabled: false` without `refreshTime` means the data is ephemeral — evicted after use. This is the Java behavior (`clientDataSetManager.removeDataSet(uuid)`).

---

## 11. File Structure

```
packages/core/src/dataset/external/
├── types.ts              — ExternalDataSetDef, DataRequest, FetchResult,
│                           ExternalColumnDef, HttpMethod, MelvizDataMessage
├── schema.ts             — Zod validation schemas
├── provider.ts           — DataProvider interface, DataProviderFactory,
│                           DataProviderConfig
├── providers/
│   ├── browser-fetch.ts  — BrowserFetchProvider
│   ├── cors-proxy.ts     — CorsProxyProvider (decorator)
│   ├── server-relay.ts   — ServerRelayProvider
│   ├── inline.ts         — InlineProvider
│   └── post-message.ts   — PostMessageProvider
├── extraction.ts         — extractDataSet pipeline (parse → extract → tabulate → convert)
├── csv.ts                — CSV parser
├── metrics-parser.ts     — Prometheus text exposition format parser
├── presets/
│   ├── registry.ts       — PresetRegistry, createPresetRegistry()
│   ├── prometheus.ts     — Prometheus preset + example
│   ├── elasticsearch.ts  — Elasticsearch preset + example
│   ├── graphql-relay.ts  — GraphQL Relay preset + example
│   ├── jsonapi.ts        — JSON:API preset + example
│   ├── odata.ts          — OData preset + example
│   └── kubernetes.ts     — Kubernetes metrics preset + example
├── join.ts               — joinDataSets
├── accumulate.ts         — accumulate logic (new-data-first semantics)
├── resolver.ts           — resolveExternalDataSet orchestrator
└── index.ts              — public API re-exports
```

Test files mirror this structure in `__tests__/external/` with one test file per source file. Each preset test uses the documented example as a fixture.

### Exports

`packages/core/src/dataset/external/index.ts` re-exports the public API. Internal types (provider implementations, CSV parser internals) are not exported.

### Impact on existing code

- `DataSetManager` gains the `accumulate()` method (§6)
- `DataSetErrorCode` union gains 4 new codes: `UNKNOWN_PRESET`, `EXTRACTION_ERROR`, `INVALID_DEFINITION`, `EMPTY_RESULT` (§7)
- No other existing types change

---

## 12. YAML Examples

### URL fetch with explicit columns (GitHub API)

```yaml
datasets:
  - uuid: github_repos
    url: https://api.github.com/search/repositories?q=stars:>1&s=stars
    expression: >-
      $.items.[name, stargazers_count, forks, open_issues, owner.login, language ? language : '-']
    columns:
      - id: name
        type: label
      - id: stars
        type: number
      - id: forks
        type: number
      - id: open_issues
        type: number
      - id: owner
        type: label
      - id: language
        type: label
    cacheEnabled: true
    refreshTime: 10minute
```

### Prometheus preset

```yaml
datasets:
  - uuid: cpu_usage
    url: http://prometheus:9090/api/v1/query?query=node_cpu_seconds_total
    type: prometheus
    cacheEnabled: true
    refreshTime: 30second
    accumulate: true
    cacheMaxRows: 1000
```

### Prometheus preset + custom filter (pipeline composition)

```yaml
datasets:
  - uuid: high_cpu
    url: http://prometheus:9090/api/v1/query?query=node_cpu_seconds_total
    type: prometheus
    expression: "$[value > 100]"
```

`type: prometheus` extracts the standard tabular structure. `expression` then filters rows where value exceeds 100.

### Inline JSON content

```yaml
datasets:
  - uuid: regions
    content: >-
      [
        {"region": "North", "target": 50000},
        {"region": "South", "target": 45000},
        {"region": "East", "target": 60000}
      ]
    columns:
      - id: region
        type: label
      - id: target
        type: number
```

### Inline CSV content

```yaml
datasets:
  - uuid: sales
    content: |
      region,revenue,quarter
      North,50000,Q1
      South,45000,Q2
    columns:
      - id: region
        type: label
      - id: revenue
        type: number
      - id: quarter
        type: label
```

Inline `content` supports both JSON and CSV. JSON is attempted first; if JSON.parse fails, CSV parsing is used as fallback.

### Inline content with expression (reshaping)

```yaml
datasets:
  - uuid: top_regions
    content: >-
      {
        "report": { "date": "2024-Q2", "regions": [
          {"name": "North", "revenue": 50000, "cost": 30000},
          {"name": "South", "revenue": 45000, "cost": 28000},
          {"name": "East", "revenue": 60000, "cost": 35000}
        ]}
      }
    dataPath: report.regions
    expression: "$[revenue > 45000]"
    columns:
      - id: name
        type: label
      - id: revenue
        type: number
      - id: cost
        type: number
```

`dataPath` navigates to the `regions` array, then `expression` filters to regions with revenue above 45000. `content` + extraction fields compose the same way as `url` + extraction fields.

### CSV file loaded in browser

```yaml
datasets:
  - uuid: sales_data
    url: https://example.com/data/sales.csv
    columns:
      - id: region
        type: label
      - id: revenue
        type: number
      - id: quarter
        type: label
```

### GraphQL Relay with dataPath + preset

```yaml
datasets:
  - uuid: issues
    url: https://api.github.com/graphql
    method: POST
    headers:
      Authorization: "Bearer ${token}"
      Content-Type: application/json
    body: '{"query": "{ repository(owner:\"facebook\", name:\"react\") { issues(first:50) { edges { cursor node { title state createdAt author { login } } } pageInfo { hasNextPage endCursor } } } }"}'
    dataPath: data.repository.issues
    type: graphql-relay
```

`dataPath` navigates to the connection object, then the `graphql-relay` preset unwraps `edges[].node`.

### Join

```yaml
datasets:
  - uuid: sales_north
    url: https://example.com/api/sales/north
    columns:
      - id: product
        type: label
      - id: revenue
        type: number
  - uuid: sales_south
    url: https://example.com/api/sales/south
    columns:
      - id: product
        type: label
      - id: revenue
        type: number
  - uuid: all_sales
    join:
      - sales_north
      - sales_south
```

### Elasticsearch preset with JSON body

```yaml
datasets:
  - uuid: error_logs
    url: http://elasticsearch:9200/logs-*/_search
    method: POST
    headers:
      Content-Type: application/json
    body: '{"query": {"match": {"level": "ERROR"}}}'
    type: elasticsearch
```

### OData preset

```yaml
datasets:
  - uuid: products
    url: https://services.odata.org/V4/OData/Products?$top=50
    type: odata
    columns:
      - id: ID
        type: number
      - id: Name
        type: label
      - id: Price
        type: number
```

### Server-side relay (deployment config, not YAML)

The dataset YAML is identical — the provider is selected by deployment configuration:

```typescript
const config: DataProviderConfig = {
  defaultProvider: "server-relay",
  serverRelay: { endpoint: "/api/data-fetch" },
};
```

### CORS proxy (deployment config)

```typescript
const config: DataProviderConfig = {
  corsProxy: {
    url: "https://my-cors-proxy.com/",
    enabled: true,
  },
};
```

---

## 13. Deferred Concerns

- **Refresh loop** — periodic re-fetching based on `refreshTime`. Belongs to the dashboard runtime lifecycle (`LocalDataService`), not the extraction layer. The `refreshTime` format is validated at the schema level (§8); parsing into a numeric interval is the refresh loop's responsibility.
- **Pagination** — some APIs require multiple fetches to get all data (e.g. GitHub's `Link` header pagination, OData's `@odata.nextLink`). Deferred — presets handle single-page responses. Multi-page fetching is a DataProvider concern for a future issue.
- **Authentication** — API keys, OAuth tokens, bearer tokens. Currently handled via `headers` in the definition. A dedicated auth configuration layer (like Grafana's datasource auth) is a future concern.
- **CsvParseOptions on the definition** — custom delimiters, no-header mode. Backwards-compatible addition when needed.
- **Streaming / large datasets** — the current design loads entire responses into memory. Streaming parse for very large datasets is a future optimization.
- **Panel-only embedding** — using a single chart + data pipeline without the full dashboard runtime. The data layer primitives (ExternalDataSetDef → DataProvider → extraction → DataSetManager) are designed to work standalone, but the embedding API surface is a separate design concern.
- **Global dataset defaults** — the Kepler examples show `uuid: metrics` with no URL, inheriting from a global `dataset.url` config. This is a dashboard YAML schema concern (issue #8), not an ExternalDataSetDef concern.
