---
id: PP-20260916-be1fba
title: "Shell document creation must use _parseDocument for coordinated mode"
type: rule
scope: repo
applies_to: "pages-builder — builder-shell.ts, any code path that creates or swaps a PageDocument instance"
severity: critical
refs:
  - packages/pages-builder/src/shell/builder-shell.ts
garden_ref: "GE-20260916-31780d"
violation_hint: "Direct PageDocument.parse() call in the shell — coordinated mode not active, causing double-fire between internal onChange and _syncViews"
created: 2026-09-16
---

All PageDocument instances in builder-shell must be created via `this._parseDocument(yaml)` (which delegates to `PageDocument.parseCoordinated()`), never via `PageDocument.parse()` directly. Coordinated mode suppresses internal undo recording and onChange notification — without it, every mutation fires both `_syncViews` and the document's internal listeners, causing double editor writes, duplicate change events, and dual undo stacks.
