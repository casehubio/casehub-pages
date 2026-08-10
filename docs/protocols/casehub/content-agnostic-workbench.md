---
id: PP-20260810-cdcc8f
title: "Workbench components are content-agnostic"
type: principle
scope: platform
applies_to: "dock-workbench, floating-workspace, and future workbench-layer components"
severity: important
refs:
  - docs/specs/issue-75-tool-window-docking/2026-08-06-tool-window-docking-design.md
violation_hint: "A workbench component importing terminal, editor, or other content-specific types; hardcoded content creation instead of factory/composition"
garden_ref: "GE-20260810-2bf7bc"
created: 2026-08-10
---

Workbench-layer components (dock-workbench, floating-workspace) manage layout, frames, tabs, and persistence — never specific content types. Content is pluggable: via component composition in YAML (dock panels declare `content: type: html`), or via content factory callbacks at runtime (floating workspace receives a `ContentFactory` at attach time). This separation enables the three-layer platform model: pages owns layout, claudony owns dev-tool content, trellis assembles them. A workbench component that knows about terminals or editors cannot be reused by other applications.
