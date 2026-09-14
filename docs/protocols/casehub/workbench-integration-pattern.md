---
id: PP-20260810-72779a
title: "Complex interactive components follow the dock-workbench integration pattern"
type: rule
scope: platform
applies_to: "Any new workbench-level component (dock-workbench, floating-workspace, future compositors)"
severity: important
refs:
  - docs/specs/issue-285-dock-workbench/2026-08-04-dock-workbench-design.md
  - docs/specs/issue-75-tool-window-docking/2026-08-06-tool-window-docking-design.md
  - specs/issue-436-rework-dock-lit-wrap/2026-09-14-rework-dock-lit-wrap-design.md
violation_hint: "A new package created for an interactive layout component, or a component type that bypasses the activation callback"
created: 2026-08-10
---

New interactive components that compose layout, manage state, and respond to user interaction extend the four existing packages — pages-component (types + ComponentTypeRegistry entry), pages-primitives (Lit Web Components), pages-ui (DSL builder + YAML desugaring), and pages-runtime (engine + activation callback + site.ts event handlers). No new packages. Components that require a Lit element (custom element with reactive rendering, light/shadow DOM, and lifecycle) go in pages-primitives; pages-runtime remains pure TypeScript with no Lit dependency. The builder produces a frozen Component; desugaring converts YAML to the builder call; the activation callback wires runtime behavior and creates the Lit element; site.ts handles events and layout persistence. External dependencies are lazy-loaded via dynamic import in the activation callback.
