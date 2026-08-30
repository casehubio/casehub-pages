---
layout: post
title: "From demo tool to data-driven automation"
date: 2026-08-30
entry_type: note
subtype: diary
projects: [casehubio/casehub-pages]
tags: [scenario-engine, automation, compilation, aria-targeting, script-library, gallery]
---

# From demo tool to data-driven automation

Yesterday's session designed the script library. Today we built it — all six batches, from the compilation pipeline through to interactive gallery examples you can click through in the browser.

## The compilation pipeline and the CSV problem

The core of the automation platform is `ScenarioCompiler.compile(yaml, callerParams)`. It wires `casehub-platform-yaml-core`'s shared primitives — `VariableResolver`, `ForEachExpander`, `CsvParser`, `Truthiness` — into a pipeline that takes scenario YAML and produces a flat list of expanded, resolved steps.

The interesting design problem was CSV data sources. The `ForEachExpander` is generic — it stamps elements per iteration value and evaluates `when` conditionals. But it only knows about simple string values. CSV rows have typed columns, and the `when` condition needs to see column values like `${each.member.admin}` to decide whether to include a step.

The first attempt tried to shoehorn CSV through the expander by converting data source names to iteration groups and adding row context in the `ForEachAdapter.stamp()` method. It broke: the expander evaluates `when` *before* calling `stamp`, so the row context wasn't available when the conditional needed it.

The fix was to accept that CSV forEach is scenario-specific logic that doesn't belong in the generic expander. `expandCsvForEach` runs first as a pre-pass: it iterates rows manually, builds a resolver with both `withEachContext` (for the stamp key) and `withEachRowContext` (for column access), evaluates `when` per row, resolves all command values, and produces flat steps with no forEach or when left. The `ForEachExpander` then handles only simple iteration groups — the clean case it was designed for.

## The index field that crossed the stack

Table population needs positional targeting. You can't assume table rows have accessible names — a `<tr>` doesn't naturally have `aria-label="Row 0"`. We needed `{role: row, index: 0}`.

This started as a Java model change — adding an optional `index` field to `AriaTarget`. But it had to flow through:

1. **Java record**: `AriaTarget(role, name, index, within)` — `name` became nullable
2. **Parser**: `HierarchicalParser.parseAriaTarget()` reads `index` from YAML
3. **Compiler**: `resolveAriaTarget()` resolves `${each.index}` in the index field
4. **TypeScript type**: `AriaTarget` interface gains optional `index?: string`
5. **Tree walker**: `resolveTarget()` picks the Nth matching element when index is present

Each layer had its own concern. The Java side stores index as a `String` (not `Integer`) because the parser sees `"${each.index}"` before compilation resolves it. The TypeScript side parses the string to int at match time. The compiler adds the iteration counter to `withEachContext(Map.of(as, rowKey, "index", String.valueOf(i)))` — one line, but it unlocks the whole pattern.

## Call graphs and acyclic enforcement

Script composability — one script calling another via `action: call` — needed cycle detection. `CallGraphValidator` does DFS with path tracking. When it finds a cycle, the error message includes the full path: `root → A → B → root`. The validator takes a `Function<String, Optional<ScriptRef>>` resolver, keeping it decoupled from the registry.

The compiler's `inlineCalls` method walks expanded steps, finds call commands, resolves the callee YAML from the registry, compiles it recursively with merged params, and replaces the call step with the callee's inlined steps prefixed with the script name. The acyclic check runs before inlining — a cycle would cause infinite recursion if inlined first.

## The library view as a reusable component

`PagesLibraryView` is a Lit web component with two modes: server-connected (fetches from `GET /scenario/library`) and standalone (scripts passed via property). The standalone mode made the gallery examples possible — the companion script just sets `.scripts` on the element and listens for `script-selected` events.

The readiness probe is a pure function: `probeReadiness(targets)` calls `resolveTarget` on each ARIA target and returns `ready`, `not-ready`, or `unknown`. The library view runs it per script to show green/amber/red indicators. In the gallery, with the form elements actually in the DOM, the probes resolve live.

## Gallery examples and the stripTs constraint

The examples gallery runs companion `.ts` files through a `stripTs` function that removes TypeScript syntax, then executes the result via `new Function()`. This means no imports, no type annotations, no `interface` declarations, no `const` (in some contexts), and no `String()` (stripTs treats `: String` as a type annotation and removes it, turning `String(x)` into `(x)`).

Every companion script had to be written as ES5-compatible JavaScript with a `.ts` extension. The real `<pages-library-view>` component works because it's bundled via esbuild into `dist/controller.js` and imported by the gallery's webpack entry point. The scenario controller example creates the component programmatically — setting `eventTarget` before DOM insertion so the connection controller picks it up in `firstUpdated`.

Six examples cover the range: form automation (3 selectable scenarios), table population (index-based row targeting), script library (real Lit component with 5 filterable scripts), parameterized execution (custom params before running), composable workflow (parent calling 3 child scripts with section highlighting), and the scenario controller (real component with mock state pump for outline/transport/progress).
