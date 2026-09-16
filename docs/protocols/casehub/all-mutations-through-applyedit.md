---
id: PP-20260916-b6f3e8
title: "All document mutations in builder-shell must go through _applyEdit"
type: rule
scope: repo
applies_to: "pages-builder — builder-shell.ts, any code that mutates PageDocument"
severity: critical
refs:
  - packages/pages-builder/src/shell/builder-shell.ts
violation_hint: "Calling doc.addPage(), node.setProperty(), or any PageDocument mutation directly instead of wrapping in this._applyEdit(origin, () => { ... }). Symptom: tree/editor/preview don't update, or editor cursor jumps."
created: 2026-09-16
---

Every document mutation in builder-shell must be wrapped in `this._applyEdit(origin, () => { mutation })`. Direct calls to PageDocument or node-level APIs bypass the coordinator — views don't sync, undo doesn't record, and the editor may receive a full-content replacement that destroys cursor position. The origin parameter (`'editor' | 'tree' | 'properties' | 'palette' | 'toolbar'`) identifies the source so `_syncViews` can skip writing back to the originator.
