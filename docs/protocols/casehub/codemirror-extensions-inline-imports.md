---
id: PP-20260916-187ec0
title: "CodeMirror extensions must use the consumer's @codemirror/* imports"
type: rule
scope: repo
applies_to: "any package creating CodeMirror extensions consumed by another package"
severity: critical
refs:
  - packages/pages-builder/src/shell/builder-shell.ts
  - packages/pages-code-editor/src/pages-code-editor.ts
garden_ref: "GE-20260916-b8eab4"
violation_hint: "Importing a pre-built extension (e.g. createSchemaCompletion) from another workspace package. Symptom: keymap bindings silently ignored, autocompletion doesn't appear — 'Unrecognized extension value' in console."
created: 2026-09-16
---

CodeMirror extensions must be built inline using the consuming package's own `@codemirror/*` imports — never import pre-built extensions from a different workspace package. In a Yarn workspace monorepo, separate packages may resolve to different physical copies of `@codemirror/state`, causing `instanceof` checks in CodeMirror's extension resolution to fail silently. Build the `keymap.of()`, `autocompletion()`, etc. calls in the same package that creates the `EditorView`.
