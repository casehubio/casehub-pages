# Decisions — issue-435-yaml-tutorial

## D1: yaml-core as universal composition layer for all formats

**Choice:** yaml-core becomes a universal preprocessing layer that composes with ANY YAML format (pages, case, swf, htn, org). Every format gains variables, forEach, modules, conditionals, CSV data.
**Alternatives:**
- Tutorial-only store domain — teach yaml-core with illustrative constructors unrelated to real formats. No runtime integration, no reuse.
- Pages-only integration — add yaml-core to pages but not other formats. Misses the platform-wide opportunity.
**Rationale:** yaml-core operates on raw maps — it's inherently format-agnostic. Making this explicit unifies the YAML language across the platform and eliminates the two-dialect problem.
**Trade-offs:** Larger scope than the original tutorial issue. Requires yaml-core in the browser and LSP integration across all formats.
**Sources:** platform/yaml-core Java source (VariableResolver, ForEachExpander, ModuleExpander — all map-based, zero format coupling). ForEachAdapter<E> SPI confirms format-agnostic design.
**Exploration:** deep-analysis
**Status:** captured

## D2: TypeScript port of yaml-core for browser execution

**Choice:** Native TypeScript port of yaml-core (~1500-2000 LOC). Conformance tests derived from the Java test suite + JSON Schema fragments as behavioral contract. Migrate to J2CL later when pages#344 builds the J2CL infrastructure for the larger scenario engine modules.
**Alternatives:**
- J2CL compilation (Java → JS) — single source of truth but adds JVM build step to every `yarn build`, JRE emulation overhead, debugging through compiled JS. Disproportionate infrastructure for a small, stable library. Evaluate when #344 is tackled.
- Java backend REST endpoint — no port needed but adds server dependency, no browser-side benefits (LSP, builder), no offline capability.
**Rationale:** yaml-core is small (~40 files), algorithmically simple (regex matching, map walking, type checking), stable (through #247, #252, #257 design rounds), and has a formal JSON Schema contract. The sync risk is low — managed through conformance tests and the schema contract. A TS port integrates natively into the Yarn workspace build, produces debuggable TypeScript, and ships immediately without blocking on J2CL infrastructure that doesn't exist yet.
**Trade-offs:** Two implementations (Java + TS) that must stay in sync. Mitigated by: yaml-core's stability (infrequent changes), JSON Schema contract, conformance test suite. When #344 J2CL pipeline exists, yaml-core can migrate from TS port to J2CL — or the TS port coexists (it's small enough).
**Sources:** platform/yaml-core Java source (~40 files, zero deps), platform#247 (yaml-core designed J2CL-compatible), pages#344 (J2CL strategy — "not for current slot"), JSON Schema fragments in yaml-core/src/main/resources/schema/
**Exploration:** deep-analysis (revised after decision review — R1-03 finding + practical cost analysis)
**Status:** revised

## D3: Schema composition — yaml-core as a language layer, not a format

**Choice:** Define yaml-core Zod schemas as a reusable module. Each format's documentSchema composes via `.merge()`: `yamlCoreSchema.merge(formatSchema)`. Element-level keys (forEach, when) added to element base schemas.
**Alternatives:**
- Extend page format only — adds yaml-core keys to dashboardSchema. Wrong abstraction: treats language-level constructs as format-specific.
- New format registration — `.composed.page.yaml` extension. Fragments the format unnecessarily.
**Rationale:** yaml-core is a language layer, not a format. It's orthogonal to what format the content describes. Schema composition makes this explicit — one yaml-core schema, composed with every format. The existing schema-navigation engine handles merged ZodObjects transparently (tested: handles ZodObject, ZodIntersection, ZodDiscriminatedUnion).
**Trade-offs:** None significant. Pre-release — no backward compatibility concern. Schema and runtime ship together — no false-promise gap.
**Sources:** pages-lsp/src/schema-navigation.ts (navigateSchema handles ZodObject, ZodIntersection), pages-lsp/src/types.ts (FormatRegistration.documentSchema)
**Exploration:** deep-analysis (first-principles analysis — the "false dichotomy" reframe)
**Status:** captured

## D4: Unified tutorial — teach yaml-core through building pages

**Choice:** The tutorial teaches yaml-core by building progressively complex pages. No separate store domain. Every yaml-core feature demonstrated through real page composition (metric grids, dashboard templates, data-driven layouts).
**Alternatives:**
- Store domain (product-catalog, shopping-cart, payment) — artificial constructs that don't map to real user work.
- Three-part split (yaml-core → constructors → pages) — teaches two dialects, concepts don't transfer.
**Rationale:** If yaml-core becomes the composition layer for pages, the tutorial should teach them together. Users learn one unified YAML language where every concept applies to real work. The builder workbench (tree + CodeMirror + visual preview) gives immediate visual feedback.
**Trade-offs:** Tutorial requires yaml-core runtime integration in pages to show live results. Can't ship tutorial without the runtime integration.
**Sources:** Issue #435 learning path structure, builder-shell.ts (workbench with tree + editor + visual preview), pages-tutorial-host.ts (existing tutorial infrastructure)
**Exploration:** deep-analysis
**Status:** captured
**Depends on:** D1 (yaml-core as universal layer), D2 (J2CL for browser execution)

## D5: Zod schemas from yaml-core's existing JSON Schema fragments

**Choice:** Convert yaml-core's existing JSON Schema fragments (`module.schema.json`, `foreach.schema.json`, `variable.schema.json`, `when.schema.json`, `data.schema.json`, `iterations.schema.json`) to Zod at build time using `json-schema-to-zod` (well-maintained npm package). No custom generator needed.
**Alternatives:**
- Custom Java→Zod code generator — builds a third generation path alongside ts-morph (#411) and ts-morph (#420). Unnecessary when the JSON schemas already exist and are maintained alongside the Java code per platform#247 D3.
- Hand-author Zod schemas — divergence risk with Java types.
**Rationale:** yaml-core already ships composable JSON Schema fragments (established by platform#247 D3: "each primitive ships a reusable schema fragment that domains compose via $ref"). Converting these to Zod uses the SAME source of truth, requires zero custom generator code, and produces type-safe Zod schemas for the LSP.
**Trade-offs:** Depends on json-schema-to-zod handling JSON Schema draft 2020-12 features correctly ($defs, oneOf). If edge cases arise, the schemas are small enough to hand-tune the generated output.
**Sources:** platform/yaml-core/src/main/resources/schema/*.schema.json (6 fragments), platform#247 D3 (JSON Schema fragment strategy)
**Exploration:** deep-analysis (revised after decision review — R1-02 finding)
**Depends on:** D3 (schema composition)
**Status:** revised

## D6: Read-only expanded diagram for yaml-core documents

**Choice:** For SWF/Case documents using yaml-core, show a read-only expanded diagram. J2CL yaml-core expands the document, diagram renders the concrete result. Click-to-source navigates to the template (forEach block, module import) in the editor.
**Alternatives:**
- Template-aware diagram — special stencils for forEach (×N badge), modules (collapsible subgraph). Rich but high complexity, unclear value over read-only.
- Side-by-side toggle (Template + Expanded views) — more work but shows both perspectives. Future enhancement.
- Defer diagram support — address separately. Viable but risks forgetting.
**Rationale:** Read-only expanded diagram gives the essential feedback loop ("did my composition produce what I expected?") without the unsolved UX problem of visually editing templates. Natural fit with the builder workbench's Source/Split/Visual modes.
**Trade-offs:** No visual editing of forEach/module constructs in the diagram. Users must edit in the YAML source.
**Sources:** builder-shell.ts (Source/Split/Visual view modes), GE-20260805-bdbc53 (dual-walk pattern for diagram adapters)
**Exploration:** quick
**Status:** captured

## D7: LSP semantic completions as follow-up issues

**Choice:** Structural completions (schema composition) ship with the integration. Semantic completions (variable references, module names, cross-module outputs) are tracked as follow-up issues.
**Alternatives:**
- Ship all completions together — delays the integration for semantic LSP work that's incremental.
- Skip semantic completions entirely — loses significant value.
**Rationale:** 80/20 — structural completions (what keys go where) are free with schema composition. Semantic completions need document-aware intelligence (J2CL yaml-core for scoping). Incremental addition, not a blocker.
**Trade-offs:** Initial LSP experience won't suggest available variable names or module references. Users must know what variables exist.
**Sources:** pages-lsp/src/schema-navigation.ts (walks Zod generically — structural completions work automatically)
**Exploration:** quick
**Status:** captured
