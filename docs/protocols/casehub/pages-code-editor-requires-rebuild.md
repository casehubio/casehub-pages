---
id: PP-20260916-c2d406
title: "pages-code-editor source changes require yarn build before Vite picks them up"
type: rule
scope: repo
applies_to: "pages-code-editor package — any source file change in packages/pages-code-editor/src/"
severity: important
refs:
  - packages/pages-code-editor/package.json
garden_ref: "GE-20260916-e52ecf"
violation_hint: "Editing pages-code-editor source and expecting Vite HMR to pick it up. Symptom: changes have no effect in the browser despite correct source. The browser loads from dist/, not src/."
created: 2026-09-16
---

The pages-code-editor package exports from `dist/` via its `package.json` `exports` field. Vite resolves workspace imports through this field, so source changes in `src/` are invisible until rebuilt. After editing any file in `packages/pages-code-editor/src/`, run `yarn workspace @casehubio/pages-code-editor run build` before testing in the Vite dev server.
