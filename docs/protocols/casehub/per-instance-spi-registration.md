---
id: PP-20260826-6e9569
title: "Rendering-tier SPIs use per-instance registration, not module-level singletons"
type: rule
scope: platform
applies_to: "SPI interfaces in graph-renderer that encode runtime-dependent decision logic"
severity: guidance
refs:
  - "docs/specs/2026-08-01-visual-diagram-editor-design.md"
violation_hint: "Module-level let/var storing an SPI implementation with setXxx/getXxx global accessors"
created: 2026-08-26
---

SPIs that encode runtime-dependent decision logic (e.g. `EditPolicy` —
"can this user connect these nodes in this diagram?") must be registered
per component instance, not as module-level singletons. Multiple diagram
instances on the same page (case diagram + SWF diagram) each need their
own policy. Use a Lit `@property({ attribute: false })` or equivalent
per-instance mechanism. The grammar registry (`registerGrammar`) is an
exception — grammar rules are static type-level metadata that don't vary
between instances.
