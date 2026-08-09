# distinctJoin Aggregation + Doc Updates — Design Spec

**Date:** 2026-07-02
**Issues:** #84 (distinctJoin), #78 (cross-repo doc updates — in-repo scope only)
**Branch:** issue-84-distinctjoin-and-docs

---

## #84 — distinctJoin Aggregation Function

### Problem

The aggregation engine has `join()` (concatenate all values) and `distinct()` (count unique values) but no way to concatenate deduplicated values. Consumers must compute deduplicated strings server-side and pass them through the dataset as redundant per-row fields.

### Design

Add a `DISTINCTJOIN` aggregation that deduplicates values by their string representation before joining, following PostgreSQL's `STRING_AGG(DISTINCT ...)` semantics.

**Naming:** `DISTINCTJOIN` in the type system/parser (compact, PostgreSQL-style). `distinctJoin()` in the DSL helper (camelCase).

**NULL handling:** NULLs are skipped, same as `join`. They do not appear in the output string.

**Deduplication strategy:** Convert each value to its string representation first (same conversion as `joinValues`), then deduplicate via `Set<string>` on the resulting strings. This means NUMBER `1` and TEXT `"1"` produce the same output string and are treated as one value.

This intentionally differs from `countDistinct`, which uses type-prefixed keys (`NUM:1` vs `TEXT:1`) and would count those as 2. The difference is correct: `distinct()` counts values, so type identity matters. `distinctJoin()` produces a human-readable string, so deduplication at the string level matches what users see. PostgreSQL's `STRING_AGG(DISTINCT ...)` works the same way — deduplication happens on the cast-to-text values, not the typed originals. Outputting `"1, 1"` in a "distinct" join would look like a bug to anyone reading the result.

### Changes

**`packages/pages-data/src/dataset/group.ts`** — Type system:
- Add `{ readonly fn: "DISTINCTJOIN"; readonly separator: string }` to `UniversalAggregation`.

**`packages/pages-data/src/dataset/group-eval.ts`** — Implementation:
- Extract `cellValueToString(val: CellValue): string | null` from the type dispatch in `joinValues`. Returns `null` for NULL, `String(val.value)` for NUMBER, `val.value.toISOString()` for DATE, `val.value` for TEXT/LABEL. This is the single source of truth for cell-to-string conversion in aggregation output — both `joinValues` and `distinctJoinValues` call it.
- Refactor `joinValues` to use `cellValueToString` (filter nulls, collect strings, join).
- New `distinctJoinValues(values: readonly CellValue[], separator: string): CellValue` function. Iterates values, calls `cellValueToString`, skips nulls, deduplicates via `Set<string>`, joins with separator. Returns `{ type: ColumnType.TEXT, value: result }`.
- Add `case "DISTINCTJOIN"` to `computeAggregation` switch.
- Add `case "DISTINCTJOIN"` to `inferAggregateColumnType` returning `ColumnType.TEXT`.

Note: `getBucketName` (used for grouping bucket labels) has different NULL semantics (`"null"` string vs skip) and is intentionally separate from `cellValueToString`.

**`packages/pages-data/src/dataset/lookup-parser.ts`** — YAML/DSL parser:
- Replace manual `AggregationFnType` union with derived type: `type AggregationFnType = Aggregation["fn"]`. This gives compile-time sync with `group.ts` forever — no manual maintenance when aggregation variants are added or removed.
- Add case in `parseAggregation()` producing `{ fn: "DISTINCTJOIN", separator: separator ?? ", " }`.

**`packages/pages-ui/src/dsl/lookup-helpers.ts`** — DSL helper:
- Add `distinctJoin(source: string, separator?: string): ResultColumn` with default separator `", "`.

**`packages/pages-ui/src/dsl/index.ts`** — Barrel re-export:
- Add `distinctJoin` to the re-export list from `./lookup-helpers.js` (alongside existing `distinct` and `join`).

### Tests

**`packages/pages-data/src/dataset/group-eval.test.ts`** — mirror all `JOIN` test patterns:
- Basic dedup: `["a", "b", "a", "c"]` → `"a, b, c"`
- NUMBER values converted to string then deduplicated: `[num(1), num(2), num(1)]` → `"1, 2"`
- DATE values converted to ISO string then deduplicated
- LABEL values converted to string then deduplicated
- Skips NULLs
- Empty input (zero values) → empty string
- All NULL input → empty string
- Mixed value types (TEXT, NUMBER, LABEL) with dedup
- Mixed types producing same string (NUMBER `1` and TEXT `"1"`) → single `"1"` in output
- LABEL `"x"` and TEXT `"x"` → single `"x"` in output (string-based dedup treats these as equal)
- Single value passthrough
- Custom separator
- Preserves insertion order (first occurrence wins)

**`packages/pages-data/src/dataset/lookup-parser.test.ts`** — parser round-trip:
- Parse DISTINCTJOIN with custom separator → `{ fn: "DISTINCTJOIN", separator: "; " }`
- Parse DISTINCTJOIN with default separator → `{ fn: "DISTINCTJOIN", separator: ", " }`

**`packages/pages-ui/src/dsl/lookup-helpers.test.ts`** — DSL helper:
- `distinctJoin("col")` produces correct ResultColumn with default separator
- `distinctJoin("col", "; ")` produces correct ResultColumn with custom separator

---

## #78 — Cross-Repo Doc Updates (In-Repo Scope)

### Problem

Two historical design docs in this repo still use "dashboard rendering" framing, which can confuse LLMs reading the codebase.

### Changes

**`docs/superpowers/plans/2026-06-20-casehub-pages-rename-plan.md`** — 4 instances of stale "dashboard rendering" language. Update to "web application framework" to match current README.md framing.

**`docs/superpowers/specs/2026-06-19-casehub-pages-rename-design.md`** — 1 instance. Same update.

### Out of Scope

Cross-repo files listed in #78 (casehub-parent, casehub-all, fsitrading, soc, devtown) are not in this repo. #78 stays open for those updates.
