# Visual YAML Builder — Design Decisions

## D1: YAML/Builder Relationship

**Choice:** Hybrid with progressive disclosure — full visual capability, natural slide into YAML
**Alternatives:**
- Teaching companion (side-by-side always) — forces YAML exposure too early for beginners
- Visual-first, YAML hidden — loses the on-ramp to YAML fluency
**Rationale:** Users who never want to see YAML can work entirely visually. Users who want to learn YAML discover it naturally through the collapsible pane with node highlighting.
**Trade-offs:** More complex sync logic than either pure-visual or pure-text
**Exploration:** quick

## D2: Scope and Phasing

**Choice:** Design both file-level builder and project-level builder together; implement file-level first
**Alternatives:**
- File-level only — risks painting into a corner for project-level extension
- Both in parallel — too large a scope for initial delivery
**Rationale:** Designing together ensures the file-level builder architecture (facades, tree, palette) extends naturally to other document types and the project graph.
**Trade-offs:** Larger design effort upfront, but prevents rework
**Exploration:** quick

## D3: Project Scope

**Choice:** Full multi-module CaseHub application builder spanning pages, DevOps, Eidos, case definitions, blocks, work, neocortex
**Alternatives:**
- Pages only — misses the primary value proposition for agentic AI applications
- Pages + DevOps only — still misses the agentic composition story
**Rationale:** CaseHub applications are multi-module, multi-file, multi-concern. The visual builder's value is showing the connected whole, not just one file type.
**Trade-offs:** Very large eventual scope; phased delivery essential
**Exploration:** quick

## D4: Composition Model

**Choice:** Outline tree + property panel (Figma layers pattern)
**Alternatives:**
- Canvas with placeholders — more visual for layout but harder for data pipeline wiring and deep nesting
- Hybrid tree + mini canvas — best of both but significantly more to build
**Rationale:** Tree handles deep nesting well, maps directly to YAML structure, and the property panel reuses the existing pages-property-palette. Proven pattern from design tools.
**Trade-offs:** Less visual than a canvas for layout composition; compensated by the live preview toggle
**Exploration:** quick

## D5: YAML Disclosure Mechanism

**Choice:** Collapsible YAML pane (starts collapsed, live bidirectional sync)
**Alternatives:**
- Per-node YAML preview — less overwhelming but fragments the learning experience
- Confidence-based auto-reveal — risks feeling patronising
**Rationale:** The pane is discoverable but not forced. Node highlighting when selected is the key teaching mechanism — "I clicked the bar chart, and that's the YAML for it."
**Trade-offs:** Full-document YAML can be intimidating on first open; mitigated by node highlighting and scroll-to-selection
**Exploration:** quick

## D6: Component Discovery

**Choice:** Categorised palette with previews, contextual filtering (soft promotion + hard filtering)
**Alternatives:**
- Intent-based chooser ("What do you want to show?") — more guided but more complex
- Both palette + intent wizard — two paths to maintain
**Rationale:** Categories map naturally to the component schema registry. Contextual promotion (form components first inside form-scope) guides without hiding. Search covers power users.
**Trade-offs:** Less guided than a wizard for complete beginners; archetype templates address the cold-start problem instead
**Exploration:** quick

## D7: Data Pipeline Configuration

**Choice:** Dedicated data section + visual wiring (datasets at tree top, components reference via dropdown)
**Alternatives:**
- Inline with each component — simpler for single-component pages but hides shared datasets
- Visual data flow diagram — most visual but requires a second view to learn
**Rationale:** Datasets are a top-level concern; treating them as first-class tree nodes makes sharing explicit. Dropdown pickers populated from the dataset list eliminate string-based wiring.
**Trade-offs:** Requires understanding the dataset-as-shared-resource model upfront
**Exploration:** quick

## D8: Hosting

**Choice:** Integrated into pages-runtime edit mode
**Alternatives:**
- Standalone dev tool — outputs files but disconnected from the running page
- IDE extension companion — tighter dev workflow but limits non-developer users
**Rationale:** The builder should show the live page alongside the editing experience. Edit mode is the natural entry point.
**Trade-offs:** Couples builder to the runtime; the facade layer keeps the logic decoupled
**Exploration:** quick

## D9: Model Architecture

**Choice:** CST-backed typed facade (YAML CST is truth, typed facade provides clean API)
**Alternatives:**
- Raw CST as model — visual builder must understand CST paths directly, less ergonomic
- Typed semantic model — cleanest API but loses comments/formatting and risks divergence
**Rationale:** Single source of truth (CST), format-preserving, typed API for the builder. Builds on existing yaml-edits.ts primitives. Extensible to other document types.
**Trade-offs:** Facade layer is new code, but thin — delegates to existing CST operations
**Sources:** packages/pages-lsp/src/refactoring/yaml-edits.ts (existing CST mutation primitives)
**Exploration:** deep-analysis

## D10: Type-Safe Cross-Document References

**Choice:** First-class typed reference system across multi-document projects
**Alternatives:**
- String-based references with runtime validation — simpler but error-prone, no refactoring support
- Schema-only validation without refactoring — catches errors but can't fix them
**Rationale:** Multi-document projects need type-safe traversal and refactoring. Renaming a capability must propagate to all bindings, workers, and pattern references. This is a core differentiator for CaseHub.
**Trade-offs:** Significant investment in the reference type system; pays off at scale
**Exploration:** quick
