---
id: PP-20260826-507928
title: "graph-core is a pure data package — no callbacks, no framework dependencies"
type: principle
scope: platform
applies_to: "all code in packages/graph-core/"
severity: important
refs:
  - "docs/specs/2026-08-01-visual-diagram-editor-design.md"
violation_hint: "Adding a function callback, Promise, or framework import (React, Lit, DOM) to graph-core"
created: 2026-08-26
---

graph-core contains only data types (`GraphModel`, `GraphNode`, `GraphEdge`,
`StencilGrammar`), pure functions over those types (`validateConstraints`,
`addNode`, `removeNode`, `addEdge`, `splitEdge`), and structural queries
(`edgesOf`, `childrenOf`, `nodeById`). It has zero framework dependencies.
Behavioral SPIs (like `EditPolicy`) that encode runtime-dependent decision
logic belong in graph-renderer, which owns the interactions that need them.
Static structural validation stays in graph-core; dynamic domain validation
goes through EditPolicy in graph-renderer.
