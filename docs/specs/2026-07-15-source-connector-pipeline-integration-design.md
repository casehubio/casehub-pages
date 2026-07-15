# SourceConnector and DataSourceController Pipeline Integration

**Issue:** #183 — DataSourceController pipeline integration
**Date:** 2026-07-15

## Problem

DataSourceController (pages-component) and DataPipeline (pages-runtime) independently
implement the same core operation: connect a DataSource to a DataSink, track connection
state, handle disconnect/replace. This creates two parallel data paths — the controller's
data never touches DataSetManager, never gets refresh timers, never participates in
cross-filtering, and never gets evicted when consumers disconnect.

Five concerns exist in the data layer today:

| Concern | Description |
|---------|-------------|
| Declaration | What data, from where, with what options |
| Acquisition | Creating and managing DataSource connections |
| Storage | Holding materialised TypedDataSets, tracking timestamps |
| Freshness | TTL, polling, stale-while-revalidate, eviction |
| Delivery | Filter, sort, paginate, push results to VizTarget |

DataSourceController bundles Declaration, Acquisition, and partial Storage.
DataPipeline bundles Acquisition, Storage (via DataSetManager), Freshness, and Delivery.
Acquisition is duplicated. Storage is split between inline state and DataSetManager.

## Design

### Architecture — Four Layers

```
┌─────────────────────────────────────────────────────────┐
│ Layer 4: Freshness + Delivery              pages-runtime │
│   DataPipeline: TTL, refresh timers, SWR, eviction      │
│   filter/sort/paginate → pushData to VizTarget           │
│   Uses SourceConnector internally                        │
├─────────────────────────────────────────────────────────┤
│ Layer 3: Component State              pages-component    │
│   DataSourceController: VizTarget + Declaration          │
│   loading/error/dataSet/onChange                          │
│   createSource() — produces DataSource from config       │
│   Delegates lifecycle to a SourceConnector               │
├─────────────────────────────────────────────────────────┤
│ Layer 2: Source Lifecycle                    pages-data   │
│   SourceConnector: connect/disconnect/replace/refresh    │
│   Feeds events to DataSetManager via DataSink            │
│   Stale-source guard (ignore events from old source)     │
│   One source per connector instance                      │
├─────────────────────────────────────────────────────────┤
│ Layer 1: Data Primitives                    pages-data   │
│   DataSource, DataSetManager, SourceFactory              │
│   All unchanged                                          │
└─────────────────────────────────────────────────────────┘
```

Every capability lives in exactly one layer. No layer does another layer's job.

### SourceConnector (pages-data) — New Primitive

Extracted from the duplicated connect/disconnect logic in both DataSourceController
and DataPipeline. Manages one DataSource for one DataSetId, feeding events to a
DataSetManager.

```typescript
interface SourceConnector {
  connect(source: DataSource): void;
  disconnect(): void;
  replace(source: DataSource): void;   // atomic: disconnect old + connect new
  refresh(): void;                      // disconnect + reconnect same source
  dispose(): void;                      // disconnect + release all state
  readonly source: DataSource | undefined;
  readonly connected: boolean;
}

function createSourceConnector(
  id: DataSetId,
  manager: DataSetManager,
  options?: {
    onError?: (err: SourceError) => void;
    onConnecting?: () => void;
  },
): SourceConnector;
```

**Internals:**
- `connect()` creates a DataSink calling `manager.apply(id, event)`, calls `source.connect(sink)`
- Stale-source guard: captures source reference at connect time, ignores events from replaced sources
- `replace()` disconnects old source then connects new — single atomic operation
- `refresh()` disconnects then reconnects the same source (triggers re-fetch)
- `onConnecting` fires before `source.connect()` — lets caller set `loading = true`
- `onError` receives full `SourceError` (with `permanent` flag) — caller decides policy

### DataSourceBinding Extension (pages-data)

Extended with freshness configuration:

```typescript
interface DataSourceBinding {
  readonly id: DataSetId;
  readonly source: DataSource;
  readonly keyColumn?: string;
  readonly refreshTime?: string;    // polling interval ("30second", "5minute")
  readonly cacheTtl?: string;       // staleness threshold
}
```

The binding is the data contract between source provider and lifecycle manager.
Freshness requirements are part of that contract. The pipeline reads them when
scheduling refresh — same way it reads `refreshTime`/`cacheTtl` from
`ExternalDataSetDef` today. `parseRefreshTime()` already handles the string format.

### DataSourceController Refactored (pages-component)

Becomes Declaration + VizTarget. Creates sources and receives deliveries.
Delegates all lifecycle to whatever SourceConnector it is given.

```typescript
interface DataSourceControllerOptions {
  onChange?: () => void;
  onRefresh?: () => void;           // application-level refresh (forms, re-submit)
  dataSetId?: DataSetId;
  sourceFactory?: SourceFactory;
  columns?: readonly ExternalColumnDef[];
  dataPath?: string;
  totalPath?: string;
  refreshTime?: string;             // flows into binding
  cacheTtl?: string;                // flows into binding
}

class DataSourceController implements VizTarget {
  // --- VizTarget state (unchanged) ---
  loading: boolean;
  dataSet: TypedDataSet | undefined;
  error: string;
  totalRows: number;
  activeSort: SortColumn | undefined;
  activePage: number | undefined;
  readonly onChange: (() => void) | undefined;

  // --- Declaration ---
  readonly dataSetId: DataSetId;
  endpoint: string | undefined;       // reactive via connector

  // --- Source creation (was private, now public) ---
  createSource(): DataSource | undefined;

  // --- Binding production ---
  toBinding(): DataSourceBinding | undefined;

  // --- Connector delegation ---
  get connector(): SourceConnector | undefined;
  set connector(c: SourceConnector | undefined);

  // --- Refresh (delegates) ---
  refresh(): void;

  // --- Dispose (delegates) ---
  dispose(): void;
}
```

**Endpoint/connector interplay:** Setting either triggers connection when both are present.
Setting endpoint without a connector stores the value. Setting a connector with an existing
endpoint auto-connects. Order of initialization does not matter.

```typescript
set endpoint(url) {
  if (url === this._endpoint) return;
  this._endpoint = url;
  if (this._connector) {
    if (url) {
      this._connector.replace(this.createSource()!);
    } else {
      this._connector.disconnect();
    }
  }
}

set connector(c) {
  this._connector?.disconnect();
  this._connector = c;
  if (c && this._endpoint) {
    c.connect(this.createSource()!);
  }
}
```

**Removed from the class:** `connect()`, `disconnect()`, `connectSource()`,
`disconnectSource()`, `handleEvent()`, `_connected` flag, `source` getter/setter.

**Capability relocation:**

| Removed method | New location | Access path |
|---|---|---|
| `connect()/disconnect()` | `SourceConnector` | `connector.connect()/disconnect()` or auto via endpoint/connector setters |
| `connectSource()/disconnectSource()` | Inside SourceConnector | Implementation detail |
| `handleEvent()` | `DataSetManager.apply()` | Called by SourceConnector's sink |
| `_connected` | `SourceConnector.connected` | `connector.connected` |
| `source` getter | `SourceConnector.source` | `connector.source` |

### Standalone Convenience (pages-component)

Wires controller + connector + manager in one call:

```typescript
function createStandaloneConnector(ctrl: DataSourceController): SourceConnector {
  const manager = createDataSetManager({
    onChanged: (_id: DataSetId, ds: TypedDataSet) => { ctrl.dataSet = ds; },
  });
  return createSourceConnector(ctrl.dataSetId, manager, {
    onError: (err) => { if (err.permanent) ctrl.error = err.message; },
    onConnecting: () => { ctrl.loading = true; },
  });
}
```

**Usage:**
```typescript
class SimpleWidget extends LitElement {
  private ctrl = new DataSourceController({
    onChange: () => this.requestUpdate(),
    sourceFactory: createSourceFactory(),
  });

  connectedCallback() {
    super.connectedCallback();
    this.ctrl.connector = createStandaloneConnector(this.ctrl);
    this.ctrl.endpoint = "/api/data";
  }

  disconnectedCallback() {
    this.ctrl.dispose();
    super.disconnectedCallback();
  }
}
```

### Pipeline Changes (pages-runtime)

**4a. Pipeline uses SourceConnector internally.**

The `connectedSources` map and inline `connectSource()` function are replaced by
SourceConnector instances:

```typescript
const connectors = new Map<DataSetId, SourceConnector>();

function getOrCreateConnector(dataSetId: DataSetId): SourceConnector {
  let connector = connectors.get(dataSetId);
  if (!connector) {
    connector = createSourceConnector(dataSetId, manager, {
      onError: (err) => { /* existing pipeline error handling */ },
      onConnecting: () => { /* set loading on registered VizTargets */ },
    });
    connectors.set(dataSetId, connector);
  }
  return connector;
}
```

**4b. handleBindingRequest gains refresh/TTL support.**

```typescript
function handleBindingRequest(target, lookup, componentId, binding): void {
  const connector = getOrCreateConnector(lookup.dataSetId);

  // Source replacement: endpoint changed
  if (connector.connected && connector.source !== binding.source) {
    connector.replace(binding.source);
    return;
  }

  // Serve from cache
  if (connector.connected && manager.has(lookup.dataSetId)) {
    pushData(target, lookup, ...);

    // Stale-while-revalidate
    const age = manager.age(lookup.dataSetId);
    const ttl = binding.cacheTtl ? parseRefreshTime(binding.cacheTtl)
              : binding.refreshTime ? parseRefreshTime(binding.refreshTime)
              : DEFAULT_TTL_MS;
    if (age !== undefined && age > ttl && !pendingRefreshes.has(lookup.dataSetId)) {
      pendingRefreshes.add(lookup.dataSetId);
      connector.refresh();
    }
    return;
  }

  // Fresh connect + schedule polling
  connector.connect(binding.source);
  if (binding.refreshTime) {
    scheduleBindingRefresh(lookup.dataSetId, binding, connector);
  }
}
```

**4c. evictDataset uses connector.**

```typescript
function evictDataset(dsId: DataSetId): void {
  manager.remove(dsId);
  datasetConsumers.delete(dsId);

  const connector = connectors.get(dsId);
  if (connector) {
    connector.dispose();
    connectors.delete(dsId);
  }
  // ... rest of cleanup unchanged
}
```

**4d. refreshDataSet uses connector for the binding path.**

```typescript
refreshDataSet(dataSetId: DataSetId): void {
  // Push sources skip refresh
  if (pushSubscriptions.has(dataSetId)) return;

  // Binding path: use connector
  const connector = connectors.get(dataSetId);
  if (connector?.connected) {
    connector.refresh();
    pendingRefreshes.delete(dataSetId);
    return;
  }

  // ExternalDataSetDef path: existing re-fetch logic unchanged
  // ...
}
```

### Bridge Mechanism (pages-data-request event extension)

The existing `pages-data-request` event detail is extended to optionally carry a
DataSourceBinding:

```typescript
// Event detail:
{
  dataSetId: DataSetId;
  operations: readonly DataSetOp[];
  binding?: DataSourceBinding;          // optional, for controller-produced sources
}
```

**Pipeline handling in handleDataRequest:**

When a binding is present in the request, the pipeline routes directly to
`handleBindingRequest` with that binding — bypassing scope lookup. This is
how controller-produced sources enter the pipeline.

**Host component dispatches:**

```typescript
connectedCallback() {
  this.ctrl.endpoint = "/api/users";
  this.dispatchEvent(new CustomEvent('pages-data-request', {
    detail: {
      dataSetId: this.ctrl.dataSetId,
      operations: [],
      binding: this.ctrl.toBinding(),
    },
    bubbles: true, composed: true,
  }));
}
```

**Endpoint changes at runtime:** The component dispatches `pages-data-request` again
with the new binding. The pipeline detects `connector.source !== binding.source`
and replaces.

No new event type needed — `pages-data-request` already exists in the reserved
event table. Its detail shape grows backward-compatibly.

## Data Flows

**Standalone (no pipeline):**

```
ctrl.endpoint = "/api/users"
  → SourceFactory creates DataSource
  → connector.replace(source)
    → source.connect(sink)
      → events → manager.apply()
        → manager.onChanged → ctrl.dataSet = dataset
          → ctrl.onChange() → component re-renders
```

**Pipeline-integrated:**

```
ctrl.endpoint = "/api/users"
  → stored (no connector on the controller — pipeline owns lifecycle)
host dispatches pages-data-request with ctrl.toBinding()
  → pipeline catches event
    → pipeline creates its own SourceConnector for this dataSetId
      → connector.connect(binding.source)
        → events → shared DataSetManager.apply()
          → pipeline.deliverDataSet → pushData with filter/sort/page
            → ctrl.dataSet = result → ctrl.onChange()
```

In pipeline mode, the controller's `connector` property is never set. The pipeline
holds the connector directly and manages the source lifecycle. The controller is
purely a VizTarget — it receives data through `pushData`, not through a connector
it owns. This is the key difference: standalone = controller holds the connector;
pipeline = pipeline holds the connector.

## Testing

**SourceConnector tests (pages-data):**
- connect: source.connect called, events reach manager.apply
- disconnect: source.disconnect called, subsequent events ignored
- replace: old source disconnected, new connected, stale events from old ignored
- refresh: disconnect + reconnect same source
- onConnecting callback fires before source.connect
- onError callback fires on source errors
- dispose: disconnects and clears state

**DataSourceController tests (pages-component):**
- VizTarget state: loading/error/dataSet mutual-clearing invariant (unchanged)
- endpoint setter: with connector → connector.replace; without → stores value
- connector setter: with endpoint → connector.connect; without → stores connector
- createSource: returns DataSource from sourceFactory + config
- toBinding: returns binding with id, source, refreshTime, cacheTtl
- refresh: delegates to connector or onRefresh callback
- dispose: calls connector.dispose

**Pipeline tests (pages-runtime):**
- handleBindingRequest with refreshTime → timer scheduled
- handleBindingRequest with cacheTtl → SWR triggers connector.refresh
- Source replacement: new binding with different source → old disconnected, new connected
- evictDataset → connector.dispose called
- Existing ExternalDataSetDef tests unchanged

**Integration test (pages-runtime):**
- DataSourceController + pipeline end-to-end: controller creates source, event
  carries binding, pipeline connects, manager accumulates, pipeline delivers
  filtered/sorted data to controller VizTarget

## Scope

**In scope:**
- SourceConnector primitive (pages-data)
- DataSourceController refactoring (pages-component)
- createStandaloneConnector convenience (pages-component)
- DataSourceBinding extension with refreshTime/cacheTtl (pages-data)
- Pipeline binding path: SourceConnector adoption, refresh/TTL, source replacement (pages-runtime)
- pages-data-request event detail extension (pages-runtime)
- Test migration and new tests

**Out of scope:**
- ExternalDataSetDef path migration to SourceConnector (future convergence)
- Push source (WS/SSE) migration to SourceConnector (future)
- Parameterised URL handling migration (future)
