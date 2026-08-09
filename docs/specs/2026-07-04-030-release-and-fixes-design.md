# 0.3.0 Release and XS Fixes Design

## Scope

Four issues on one branch:

| # | Description | Scale |
|---|-------------|-------|
| #86 | Publish 0.3.0 | S |
| #102 | Caffeine cache `form` field missing from relay hash key | XS |
| #103 | PagesMetric generation counter for async expressions | XS |
| #104 | PagesChartElement async buildOption Promise rejection | XS |

#86 is build/publish — no design needed. The three fixes (#102–#104) land first on the branch; #86 publishes 0.3.0 with all three included.

The three XS fixes share a structural theme: async render correctness. `PagesTable` also uses `applyCellExpression().then()` at three call sites (lines 690, 805, 813) but is not in scope — its `render()` clears the container (`container.textContent = ""`), so stale async results write to detached DOM nodes with no visible effect, and `applyCellExpression` never rejects (see Fix 2), so no `.catch()` is needed.

## Fix 1 — Generation counter lift to PagesElement (#103)

### Problem

`PagesChartElement` owns a private `_renderGen` counter to discard stale async results. `PagesMetric` lacks one entirely — its async `applyCellExpression().then()` callback can overwrite fresh renders with stale results when `render()` is called twice rapidly.

The staleness concern is render-lifecycle, not chart-specific or metric-specific. Any `PagesElement` subclass doing async rendering needs it.

### Design

Move the counter to `PagesElement`:

```
PagesElement
  private _renderGen = 0
  protected get renderGen(): number
  
  update():
    if (!this.isConnected) return
    ++this._renderGen                          // ← before all other guards
    if (this._error) → renderError(); return
    if (!this._props) → renderLoading(); return
    if (!this._dataset) → renderLoading(); return
    this.render(container, props, dataset)
```

The increment is placed after the `isConnected` guard but before all state-transition guards. This ensures that entering error state, clearing props, or clearing dataset all invalidate pending async work. A disconnected component needs no counter bump — its DOM is detached and any stale callback writes are invisible.

This changes the counter's semantics: it previously incremented only inside `PagesChartElement.render()` (once per actual chart render). Now it increments on every `update()` call that passes the `isConnected` guard — including error and loading transitions. This is intentionally more conservative: any state transition invalidates pending async work, which is the correct behavior.

Subclasses capture `const gen = this.renderGen` at render start, then check `this.renderGen !== gen` before applying async results.

### Changes

- `PagesElement.ts`: add `_renderGen` field, increment in `update()`, expose `renderGen` getter
- `PagesChartElement.ts`: remove `private _renderGen`, read `this.renderGen` instead
- `PagesMetric.ts`: capture `gen` before async call, check before `renderWithValue()`

## Fix 2 — Promise rejection handling (#104)

### Problem

`PagesChartElement.render()` calls `void result.then(apply)` with no `.catch()`. If `buildOption()` returns a rejecting Promise (any subclass — e.g. `PagesBarChart` calls `await datasetToSource()` which runs `Promise.all`), the rejection is unhandled. The chart silently freezes in its last state with no user feedback.

`PagesMetric.render()` has a related but distinct gap. `applyCellExpression` itself never rejects — it wraps its body in try-catch and returns `raw` on error (`cell-extract.ts:22-33`). The risk is that the `.then()` callback (`renderWithValue`) could throw, producing an unhandled rejection in the Promise chain. Adding `.catch()` is defense-in-depth against callback exceptions, not against `applyCellExpression` rejection.

### Design

Both async render paths get `.catch()`:

```typescript
// PagesChartElement
void result.then(apply).catch((e: unknown) => {
    if (this.renderGen !== gen) return;
    this.error = e instanceof Error ? e.message : String(e);
});

// PagesMetric
void applyCellExpression(raw, expr)
    .then(result => {
        if (this.renderGen !== gen) return;
        this.renderWithValue(container, props, dataset, title, result === null ? "" : String(result));
    })
    .catch((e: unknown) => {
        if (this.renderGen !== gen) return;
        this.error = e instanceof Error ? e.message : String(e);
    });
```

Using `this.error = msg` is correct:
- It clears the dataset, sets `_error`, and calls `update()`
- `update()` renders the error state with a retry button
- No re-entrancy — the catch handler runs asynchronously after `render()` returns
- Retry re-fetches data and re-renders, which re-attempts `buildOption`/`applyCellExpression`

Both catch handlers check the generation counter — if the render is stale, the rejection is silently discarded (a newer render is already in flight or applied).

## Fix 3 — Cache hash includes form (#102)

### Problem

`DataCacheService.hashRelay()` hashes `url | method | headers | query | body` but omits `form`. The `DataRequest` record has a `form` field (form-encoded POST data). Two requests identical except for form data get the same cache key, returning wrong cached results.

### Design

Add `sorted(r.form())` to the hash string:

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

`form` and `body` are mutually exclusive (TypeScript schema enforces this), but the hash must be comprehensive regardless — the backend receives whatever is sent.

## #86 — Publish 0.3.0

Build/publish task, executed after all three fixes (#102–#104) are committed on the branch. No code changes beyond the fixes above — run `yarn build`, update package versions, publish to GitHub Packages npm registry. The 0.3.0 release includes all three fixes.

## Testing

### Test harness extensions

The existing test subclasses and props don't cover async paths — the following extensions are needed:

- **`PagesChartElement.test.ts`**: `TestChart.buildOption()` currently returns a plain object. Add an `AsyncTestChart` subclass whose `buildOption()` returns a `Promise` (resolving or rejecting) to test both staleness and rejection.
- **`PagesMetric.test.ts`**: No existing tests provide column expressions. Tests must supply `MetricProps` with `columns: [{ id, expression }]` to trigger the `applyCellExpression` async path. Mock or stub `applyCellExpression` to control timing for staleness tests.
- **`PagesElement.test.ts`**: `TestElement.render()` is synchronous. Add an `AsyncTestElement` subclass with a `render()` that starts a deferred async operation, enabling generation counter tests.

### Scenarios

- **PagesElement generation counter**: test that a second `update()` call causes the first async result to be discarded
- **PagesChartElement rejection**: test that a rejecting `buildOption` sets `this.error` (not an unhandled rejection)
- **PagesMetric staleness**: test that rapid dataset updates discard stale expression results
- **PagesMetric callback exception**: test that an exception in `renderWithValue` (via the `.then()` callback) is caught and sets error state
- **DataCacheService form hash**: test that two requests differing only in form data get separate cache entries

## Files Changed

| File | Change |
|------|--------|
| `packages/pages-viz/src/base/PagesElement.ts` | Add `_renderGen`, increment in `update()`, expose getter |
| `packages/pages-viz/src/base/PagesChartElement.ts` | Remove `_renderGen`, use inherited counter, add `.catch()` |
| `packages/pages-viz/src/components/PagesMetric.ts` | Add staleness guard and `.catch()` to async path |
| `packages/pages-viz/src/base/PagesElement.test.ts` | Add `AsyncTestElement` subclass and generation counter test |
| `packages/pages-viz/src/base/PagesChartElement.test.ts` | Add `AsyncTestChart` subclass, rejection and staleness tests |
| `packages/pages-viz/src/components/PagesMetric.async.test.ts` | New file — staleness and callback exception tests with mocked `applyCellExpression` |
| `backend/data/src/main/java/io/casehub/pages/data/DataCacheService.java` | Add `form` to `hashRelay()` |
| `backend/data/src/test/java/io/casehub/pages/data/DataCacheServiceTest.java` | Add form hash test |
