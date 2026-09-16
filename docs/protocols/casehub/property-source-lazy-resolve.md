---
id: PP-20260916-97c8d1
title: "Property source closures must use lazy resolve, not captured node references"
type: rule
scope: repo
applies_to: "pages-builder — _resolvePropertySource in builder-shell.ts, any code creating PropertyPaletteSource objects"
severity: important
refs:
  - packages/pages-builder/src/shell/builder-shell.ts
garden_ref: "GE-20260916-6e1665"
violation_hint: "Direct node capture in a property source closure (e.g. `const node = findComponent(); onChange: () => node.setProperty(...)`) — will mutate the wrong document after undo/redo"
created: 2026-09-16
---

Property source `get data()` and `onChange()` closures must resolve nodes lazily via a `resolve()` function that navigates `this._document` at execution time, not at closure creation time. Direct node captures go stale when undo, redo, or `_flushEditorSync` swaps the document instance — the captured reference points to the old document while mutations target the new one.
