# 0.3.0 Release and XS Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use hortora:subagent-driven-development (recommended) or hortora:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three async render correctness bugs (#102, #103, #104) and publish 0.3.0 (#86).

**Architecture:** Lift the render generation counter from PagesChartElement to PagesElement (base class), add `.catch()` to both async render paths, and add `form` to the Java cache hash. Then version bump and publish.

**Tech Stack:** TypeScript 5 / Vitest (frontend), Java / JUnit 5 / Quarkus (backend)

## Global Constraints

- Use `yarn workspace @casehub/pages-viz run test` for frontend tests
- Use Maven (`/opt/homebrew/bin/mvn -f backend/data/pom.xml test`) for backend tests
- Every commit references an issue: `Refs #N` (ongoing) or `Closes #N` (done)
- Use IntelliJ MCP for code navigation, never bash grep/find for class lookups

---

### Task 1: Lift generation counter to PagesElement (#103)

**Files:**
- Modify: `packages/pages-viz/src/base/PagesElement.ts:17-19,190-209`
- Test: `packages/pages-viz/src/base/PagesElement.test.ts`

**Interfaces:**
- Produces: `protected get renderGen(): number` on PagesElement — all later tasks depend on this getter

- [ ] **Step 1: Write the failing test for renderGen getter**

Add to `PagesElement.test.ts`, after the existing `TestElement` class (line 23) and before the `describe` block:

```typescript
class AsyncTestElement extends PagesElement<TestProps> {
  renderCalls: Array<{ props: TestProps; dataset: TypedDataSet }> = [];
  lastRenderGen = -1;

  protected override render(
    _container: HTMLDivElement,
    props: TestProps,
    dataset: TypedDataSet,
  ): void {
    this.renderCalls.push({ props, dataset });
    this.lastRenderGen = this.renderGen;
  }
}

customElements.define("test-async-pages-element", AsyncTestElement);
```

Add a new `describe("renderGen", ...)` block at the end of the test file:

```typescript
describe("renderGen", () => {
  let asyncEl: AsyncTestElement;

  beforeEach(() => {
    asyncEl = document.createElement("test-async-pages-element") as AsyncTestElement;
  });

  afterEach(() => {
    if (asyncEl.isConnected) {
      asyncEl.remove();
    }
  });

  it("exposes a renderGen getter that increments on each update", () => {
    asyncEl.props = { label: "test" };
    document.body.appendChild(asyncEl);
    asyncEl.dataSet = mockDataSet();

    const gen1 = asyncEl.lastRenderGen;
    expect(gen1).toBeGreaterThan(0);

    asyncEl.dataSet = mockDataSet();
    const gen2 = asyncEl.lastRenderGen;
    expect(gen2).toBeGreaterThan(gen1);
  });

  it("increments renderGen even on error/loading transitions", () => {
    asyncEl.props = { label: "test" };
    document.body.appendChild(asyncEl);
    asyncEl.dataSet = mockDataSet();

    const genAfterRender = asyncEl.lastRenderGen;

    // Error transition increments gen (but doesn't call render)
    asyncEl.error = "fail";

    // Recovery — new dataset triggers render again
    asyncEl.dataSet = mockDataSet();
    const genAfterRecovery = asyncEl.lastRenderGen;

    // Gen should have incremented past the error transition
    expect(genAfterRecovery).toBeGreaterThan(genAfterRender + 1);
  });

  it("does not increment renderGen when not connected", () => {
    // Not connected — setting props+dataset should not increment
    asyncEl.props = { label: "test" };
    asyncEl.dataSet = mockDataSet();
    expect(asyncEl.lastRenderGen).toBe(-1); // never rendered
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `yarn workspace @casehub/pages-viz run test -- --reporter verbose PagesElement.test`
Expected: FAIL — `this.renderGen` is not a property of PagesElement

- [ ] **Step 3: Implement the generation counter in PagesElement**

In `packages/pages-viz/src/base/PagesElement.ts`, add the field and getter after the existing private fields (around line 19):

```typescript
private _renderGen = 0;
```

Add the getter after the `activePage` setter (around line 111):

```typescript
protected get renderGen(): number {
  return this._renderGen;
}
```

Modify `update()` (line 190) to increment the counter after the `isConnected` guard but before all other guards:

```typescript
private update(): void {
  if (!this.isConnected) return;

  ++this._renderGen;

  if (this._error) {
    this.renderError(this.container, this._error);
    return;
  }

  if (!this._props) {
    this.renderLoading(this.container);
    return;
  }

  if (!this._dataset) {
    this.renderLoading(this.container);
    return;
  }

  this.render(this.container, this._props, this._dataset);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn workspace @casehub/pages-viz run test -- --reporter verbose PagesElement.test`
Expected: PASS — all existing tests plus the new renderGen tests pass

- [ ] **Step 5: Commit**

```
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-viz/src/base/PagesElement.ts packages/pages-viz/src/base/PagesElement.test.ts
git -C /Users/mdproctor/claude/casehub/pages commit -m "feat: lift render generation counter to PagesElement

Refs #103"
```

---

### Task 2: PagesChartElement — use inherited counter + rejection handling (#103, #104)

**Files:**
- Modify: `packages/pages-viz/src/base/PagesChartElement.ts:91,93-114`
- Test: `packages/pages-viz/src/base/PagesChartElement.test.ts`

**Interfaces:**
- Consumes: `protected get renderGen(): number` from PagesElement (Task 1)
- Produces: no new public API

- [ ] **Step 1: Write failing tests for async staleness and rejection**

Add after the existing `TestChart` class in `PagesChartElement.test.ts` (after line 61):

```typescript
class AsyncTestChart extends PagesChartElement<TestChartProps> {
  resolveOption?: (value: Record<string, unknown>) => void;
  rejectOption?: (reason: Error) => void;

  override buildOption(
    _props: TestChartProps,
    _dataset: TypedDataSet,
  ): Promise<Record<string, unknown>> {
    return new Promise((resolve, reject) => {
      this.resolveOption = resolve;
      this.rejectOption = reject;
    });
  }
}

customElements.define("test-async-chart", AsyncTestChart);
```

Add new describe blocks at the end of the test file:

```typescript
describe("async buildOption", () => {
  let asyncEl: AsyncTestChart;

  beforeEach(() => {
    vi.clearAllMocks();
    mockChart.getOption.mockReturnValue({ series: [{ type: "bar" }] });
    asyncEl = document.createElement("test-async-chart") as AsyncTestChart;
  });

  afterEach(() => {
    if (asyncEl.isConnected) {
      asyncEl.remove();
    }
  });

  it("stale async result is discarded when a newer render has started", async () => {
    asyncEl.props = { lookup: mockLookup("sales") };
    document.body.appendChild(asyncEl);
    asyncEl.dataSet = mockDataSet();

    const firstResolve = asyncEl.resolveOption!;

    // Trigger second render — new dataset
    asyncEl.dataSet = mockDataSet();
    const secondResolve = asyncEl.resolveOption!;

    // Resolve second first (fresh)
    secondResolve({ series: [{ type: "bar", data: [4, 5, 6] }] });
    await Promise.resolve();

    expect(mockChart.setOption).toHaveBeenCalledTimes(1);
    expect(mockChart.setOption).toHaveBeenCalledWith(
      { series: [{ type: "bar", data: [4, 5, 6] }] },
      true,
    );

    // Resolve first (stale) — should be discarded
    mockChart.setOption.mockClear();
    firstResolve({ series: [{ type: "bar", data: [1, 2, 3] }] });
    await Promise.resolve();

    expect(mockChart.setOption).not.toHaveBeenCalled();
  });

  it("rejected buildOption sets error state instead of unhandled rejection", async () => {
    asyncEl.props = { lookup: mockLookup("sales") };
    document.body.appendChild(asyncEl);
    asyncEl.dataSet = mockDataSet();

    const reject = asyncEl.rejectOption!;
    reject(new Error("Expression evaluation failed"));
    await Promise.resolve();

    expect(asyncEl.error).toBe("Expression evaluation failed");
  });

  it("stale rejection is silently discarded", async () => {
    asyncEl.props = { lookup: mockLookup("sales") };
    document.body.appendChild(asyncEl);
    asyncEl.dataSet = mockDataSet();

    const firstReject = asyncEl.rejectOption!;

    // Trigger second render
    asyncEl.dataSet = mockDataSet();

    // Reject first (stale) — should not set error
    firstReject(new Error("stale error"));
    await Promise.resolve();

    expect(asyncEl.error).toBe("");
  });
});
```

- [ ] **Step 2: Run test to verify failures**

Run: `yarn workspace @casehub/pages-viz run test -- --reporter verbose PagesChartElement.test`
Expected: FAIL — stale result test fails (no generation check from base class yet in PagesChartElement), rejection test fails (no `.catch()`)

- [ ] **Step 3: Implement changes in PagesChartElement**

In `packages/pages-viz/src/base/PagesChartElement.ts`:

Remove the private field (line 91):
```typescript
// DELETE: private _renderGen = 0;
```

Update `render()` (lines 93-114) to use the inherited counter and add `.catch()`:

```typescript
protected override render(
  container: HTMLDivElement,
  props: P,
  dataset: TypedDataSet,
): void {
  const gen = this.renderGen;
  const chart = this.ensureChart(container);
  const result = this.buildOption(props, dataset);

  const apply = (option: Record<string, unknown>): void => {
    if (this.renderGen !== gen) return;
    chart.setOption(option, true);
    if (this._selectedValue !== undefined && this._selectedDataIndex !== undefined) {
      this.syncHighlight(chart, undefined, this._selectedDataIndex);
    }
  };

  if (result instanceof Promise) {
    void result.then(apply).catch((e: unknown) => {
      if (this.renderGen !== gen) return;
      this.error = e instanceof Error ? e.message : String(e);
    });
  } else {
    apply(result);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn workspace @casehub/pages-viz run test -- --reporter verbose PagesChartElement.test`
Expected: PASS — all existing tests plus async staleness and rejection tests pass

- [ ] **Step 5: Commit**

```
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-viz/src/base/PagesChartElement.ts packages/pages-viz/src/base/PagesChartElement.test.ts
git -C /Users/mdproctor/claude/casehub/pages commit -m "fix: use inherited renderGen counter and add Promise rejection handling

Refs #103, #104"
```

---

### Task 3: PagesMetric — staleness guard and rejection handling (#103, #104)

**Files:**
- Modify: `packages/pages-viz/src/components/PagesMetric.ts:29-65`
- Create: `packages/pages-viz/src/components/PagesMetric.async.test.ts`

**Interfaces:**
- Consumes: `protected get renderGen(): number` from PagesElement (Task 1)
- Produces: no new public API

- [ ] **Step 1: Write failing tests for staleness and callback exception**

Create a separate test file `packages/pages-viz/src/components/PagesMetric.async.test.ts` to isolate the `vi.mock` (Vitest hoists mocks to file scope — they cannot be toggled per-test in the same file as unmocked tests):

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { DataSet, TypedDataSet, ColumnType, ColumnId } from "@casehubio/pages-data/dist/dataset/types.js";
import type { DataSetLookup } from "@casehubio/pages-data/dist/dataset/lookup.js";
import type { MetricProps, ColumnSettings } from "@casehubio/pages-component";
import { toTypedDataSet } from "@casehubio/pages-data/dist/dataset/conversion.js";

// ── Controllable mock ────────────────────────────────────────────────

let applyCellResolvers: Array<(v: string | number | Date | null) => void> = [];
let applyCellRejecters: Array<(e: Error) => void> = [];

vi.mock("../base/cell-extract.js", async (importOriginal) => {
  const original = await importOriginal<typeof import("../base/cell-extract.js")>();
  return {
    ...original,
    applyCellExpression: vi.fn(
      () =>
        new Promise<string | number | Date | null>((resolve, reject) => {
          applyCellResolvers.push(resolve);
          applyCellRejecters.push(reject);
        }),
    ),
  };
});

import { PagesMetric } from "./PagesMetric.js";

// ── Helpers ──────────────────────────────────────────────────────────

function mockLookup(id: string): DataSetLookup {
  return { dataSetId: id, operations: [] } as unknown as DataSetLookup;
}

function makeDataSet(
  columns: [string, string][],
  rows: (string | number | null)[][],
): TypedDataSet {
  const ds: DataSet = {
    columns: columns.map(([id, type]) => ({
      id: id as ColumnId,
      name: id,
      type: type as ColumnType,
    })),
    data: rows.map(row => row.map(cell => (cell === null ? null : String(cell)))),
  };
  return toTypedDataSet(ds);
}

// ── Tests ────────────────────────────────────────────────────────────

describe("PagesMetric async expressions", () => {
  let el: PagesMetric;

  beforeEach(() => {
    vi.clearAllMocks();
    applyCellResolvers = [];
    applyCellRejecters = [];
    el = document.createElement("pages-metric");
  });

  afterEach(() => {
    if (el.isConnected) {
      el.remove();
    }
  });

  it("stale async expression result is discarded on rapid dataset update", async () => {
    const ds1 = makeDataSet([["val", "NUMBER"]], [[10]]);
    const ds2 = makeDataSet([["val", "NUMBER"]], [[20]]);
    const props: MetricProps = {
      lookup: mockLookup("test"),
      columns: [{ id: "val", expression: "$value * 2" } as ColumnSettings],
    };

    el.props = props;
    document.body.appendChild(el);

    // First dataset — triggers async expression
    el.dataSet = ds1;
    expect(applyCellResolvers).toHaveLength(1);

    // Second dataset — triggers another async expression
    el.dataSet = ds2;
    expect(applyCellResolvers).toHaveLength(2);

    // Resolve second (fresh) first
    applyCellResolvers[1]!("40");
    await Promise.resolve();

    const value = el.shadowRoot.querySelector(".card .value");
    expect(value?.textContent).toBe("40");

    // Resolve first (stale) — should NOT overwrite
    applyCellResolvers[0]!("20");
    await Promise.resolve();

    expect(value?.textContent).toBe("40");
  });

  it("rejected expression sets error state", async () => {
    const ds = makeDataSet([["val", "NUMBER"]], [[10]]);
    const props: MetricProps = {
      lookup: mockLookup("test"),
      columns: [{ id: "val", expression: "$value * 2" } as ColumnSettings],
    };

    el.props = props;
    document.body.appendChild(el);
    el.dataSet = ds;

    expect(applyCellRejecters).toHaveLength(1);
    applyCellRejecters[0]!(new Error("callback boom"));
    await Promise.resolve();
    await Promise.resolve();

    const errorEl = el.shadowRoot.querySelector("[data-pages-error]");
    expect(errorEl).not.toBeNull();
    expect(errorEl!.textContent).toContain("callback boom");
  });
});
```

- [ ] **Step 2: Run test to verify failures**

Run: `yarn workspace @casehub/pages-viz run test -- --reporter verbose PagesMetric.async.test`
Expected: FAIL — stale result is not discarded, error is not caught

- [ ] **Step 3: Implement staleness guard and catch in PagesMetric**

In `packages/pages-viz/src/components/PagesMetric.ts`, modify the `render()` method (lines 29-65):

```typescript
protected override render(
  container: HTMLDivElement,
  props: MetricProps,
  dataset: TypedDataSet,
): void {
  container.textContent = "";

  // Style
  const style = document.createElement("style");
  style.textContent = METRIC_CSS;
  container.appendChild(style);

  // Extract value and title
  const title = props.title ?? "";
  if (dataset.columns.length === 0 || dataset.rows.length === 0) {
    this.renderCard(container, title, "—");
    return;
  }
  const firstColumn = dataset.columns[0];
  const firstRow = dataset.rows[0];
  if (!firstColumn || !firstRow) {
    this.renderCard(container, title, "—");
    return;
  }
  const colId = firstColumn.id;
  const raw = cellToRaw(firstRow.cell(colId));
  const expr = resolveColumnExpression(colId, props.columns);
  if (expr) {
    const gen = this.renderGen;
    void applyCellExpression(raw, expr)
      .then(result => {
        if (this.renderGen !== gen) return;
        this.renderWithValue(container, props, dataset, title, result === null ? "" : String(result));
      })
      .catch((e: unknown) => {
        if (this.renderGen !== gen) return;
        this.error = e instanceof Error ? e.message : String(e);
      });
    return;
  }
  const value = raw === null ? "" : String(raw);

  this.renderWithValue(container, props, dataset, title, value);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `yarn workspace @casehub/pages-viz run test -- --reporter verbose PagesMetric`
Expected: PASS — all existing tests (PagesMetric.test) plus async staleness and error tests (PagesMetric.async.test) pass

- [ ] **Step 5: Commit**

```
git -C /Users/mdproctor/claude/casehub/pages add packages/pages-viz/src/components/PagesMetric.ts packages/pages-viz/src/components/PagesMetric.async.test.ts
git -C /Users/mdproctor/claude/casehub/pages commit -m "fix: add async staleness guard and rejection handling to PagesMetric

Refs #103, #104"
```

---

### Task 4: DataCacheService form field in relay hash key (#102)

**Files:**
- Modify: `backend/data/src/main/java/io/casehub/pages/data/DataCacheService.java:108-116`
- Test: `backend/data/src/test/java/io/casehub/pages/data/DataCacheServiceTest.java`

**Interfaces:**
- Consumes: existing `DataRequest` record (has `form` field)
- Produces: no new public API

- [ ] **Step 1: Write the failing test**

Add to `DataCacheServiceTest.java`:

```java
@Test
void differentFormDataGetsSeparateCacheEntries() {
    var request1 = new DataRequest("https://api.example.com/data", "POST",
        Map.of(), Map.of(), Map.of("field", "value1"), null, null);
    var request2 = new DataRequest("https://api.example.com/data", "POST",
        Map.of(), Map.of(), Map.of("field", "value2"), null, null);

    var result1 = cache.fetchCached("tenant-1", request1, () -> { fetchCount++; return new FetchResult("form1", null); });
    var result2 = cache.fetchCached("tenant-1", request2, () -> { fetchCount++; return new FetchResult("form2", null); });

    assertThat(result1.data()).isEqualTo("form1");
    assertThat(result2.data()).isEqualTo("form2");
    assertThat(fetchCount).isEqualTo(2);
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `/opt/homebrew/bin/mvn -f /Users/mdproctor/claude/casehub/pages/backend/data/pom.xml test -Dtest=DataCacheServiceTest#differentFormDataGetsSeparateCacheEntries -pl .`
Expected: FAIL — both requests return "form1" because form is not in the hash

- [ ] **Step 3: Add form to hashRelay**

In `backend/data/src/main/java/io/casehub/pages/data/DataCacheService.java`, modify `hashRelay()` (line 108-116):

```java
private String hashRelay(DataRequest r) {
    return sha256(
        (r.url() != null ? r.url() : "") + "|" +
        (r.method() != null ? r.method() : "GET") + "|" +
        sorted(r.headers()) + "|" +
        sorted(r.query()) + "|" +
        sorted(r.form()) + "|" +
        (r.body() != null ? r.body() : "")
    );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `/opt/homebrew/bin/mvn -f /Users/mdproctor/claude/casehub/pages/backend/data/pom.xml test -Dtest=DataCacheServiceTest -pl .`
Expected: PASS — all existing tests plus the new form hash test pass

- [ ] **Step 5: Commit**

```
git -C /Users/mdproctor/claude/casehub/pages add backend/data/src/main/java/io/casehub/pages/data/DataCacheService.java backend/data/src/test/java/io/casehub/pages/data/DataCacheServiceTest.java
git -C /Users/mdproctor/claude/casehub/pages commit -m "fix: include form field in Caffeine relay cache hash key

Closes #102"
```

---

### Task 5: Publish 0.3.0 (#86)

**Files:**
- Modify: `packages/pages-component/package.json` (version)
- Modify: `packages/pages-data/package.json` (version)
- Modify: `packages/pages-iframe-api/package.json` (version)
- Modify: `packages/pages-runtime/package.json` (version)
- Modify: `packages/pages-ui/package.json` (version)
- Modify: `packages/pages-viz/package.json` (version)

**Interfaces:**
- Consumes: all fixes from Tasks 1-4 committed on branch
- Produces: published npm packages at version 0.3.0

- [ ] **Step 1: Run the full test suite to confirm green**

Run: `yarn workspace @casehub/pages-viz run test`
Run: `/opt/homebrew/bin/mvn -f /Users/mdproctor/claude/casehub/pages/backend/data/pom.xml test -pl .`
Expected: all tests PASS

- [ ] **Step 2: Run the full build**

Run: `cd /Users/mdproctor/claude/casehub/pages && yarn build`
Expected: BUILD SUCCESS — all packages, components, and webapp build cleanly

- [ ] **Step 3: Bump versions from 0.2.0 to 0.3.0**

Update `"version"` in each publishable package.json from `"0.2.0"` to `"0.3.0"`:

- `packages/pages-component/package.json`
- `packages/pages-data/package.json`
- `packages/pages-iframe-api/package.json`
- `packages/pages-runtime/package.json`
- `packages/pages-ui/package.json`
- `packages/pages-viz/package.json`

Also update any cross-references between these packages (dependency versions in `dependencies` or `peerDependencies` that reference `"0.2.0"`).

- [ ] **Step 4: Rebuild with new versions**

Run: `cd /Users/mdproctor/claude/casehub/pages && yarn build`
Expected: BUILD SUCCESS

- [ ] **Step 5: Commit version bump**

```
git -C /Users/mdproctor/claude/casehub/pages add packages/*/package.json
git -C /Users/mdproctor/claude/casehub/pages commit -m "chore: bump publishable packages to 0.3.0

Refs #86"
```

- [ ] **Step 6: Publish to GitHub Packages**

Run from project root for each publishable package:
```
yarn workspace @casehubio/pages-data npm publish
yarn workspace @casehubio/pages-ui npm publish
yarn workspace @casehubio/pages-component npm publish
yarn workspace @casehubio/pages-iframe-api npm publish
yarn workspace @casehubio/pages-viz npm publish
yarn workspace @casehubio/pages-runtime npm publish
```

Expected: each package published successfully to `https://npm.pkg.github.com`

- [ ] **Step 7: Commit and close issues**

```
git -C /Users/mdproctor/claude/casehub/pages commit --allow-empty -m "feat: publish 0.3.0 with workbench primitives + terminal + async fixes

Closes #86, #103, #104"
```

Note: #102 was already closed in Task 4's commit.
