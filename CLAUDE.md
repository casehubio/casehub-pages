# casehub-pages

## Project Type

type: custom
**Stage:** pre-release

## Work Tracking

Issue tracking: enabled
GitHub repo: casehubio/casehub-pages

## Repository Role

Web application framework for the CaseHub platform — TypeScript runtime for composing applications from layouts, data pipelines, visualization, forms, hosted components, and inter-component communication.

**Tier:** Integration (UI layer consumed by application-tier repos)

## IntelliJ Plugin

`plugins/intellij/` — Kotlin/Gradle project (not managed by Yarn). Requires JDK 21 and LSP4IJ plugin dependency.

```bash
# Build (requires pages-lsp bundle to exist first)
JAVA_HOME=/path/to/jdk21 plugins/intellij/gradlew -p plugins/intellij buildPlugin

# Verify compatibility
JAVA_HOME=/path/to/jdk21 plugins/intellij/gradlew -p plugins/intellij verifyPlugin
```

## Documentation

This repo owns its own documentation, synced to parent via subtree:
- `docs/guides/consumer-guide.md` — for app builders: web components, data pipelines, layout, push protocol
- `docs/guides/contributor-guide.md` — for contributors: package architecture, build system, extension points

Update the relevant guide in the same session when implementation changes components, APIs, or protocols. Do not defer — drift compounds. Parent (`casehubio/parent`) aggregates these at `docs/repos/casehub-pages/` for RAG retrieval.

## Editor Packages

Three packages provide the editor infrastructure:
- `packages/pages-editor-core/` — `EditableText` interface, `EditableTextBridge` base, MCP tool adapter, edit sessions
- `packages/pages-markdown-editor/` — Milkdown/ProseMirror LIT component with dual-mode (WYSIWYG/source/split), toolbar, annotations
- `packages/pages-document-diff/` — generic LCS diff, word highlights, canvas minimap, scroll sync (extracted from casehub-mosaic)

`pages-code-editor` extends `EditableTextBridge` from editor-core. `pages-aria` re-exports types from editor-core (deprecated `ScenarioEditableText` alias remains for backward compat).

## Step Viewer

`packages/pages-step-viewer/` — Lit web components for rendering playbook step YAML as visual cards, swim lanes, and control flow diagrams. Gallery at `gallery.html` (run via Vite).

v1 components (pages-owned, render playbook steps via yaml-core):
- `step-card`, `swim-lane-view`, `step-block-view`, `if-else-view`, `match-view`, `try-catch-view`, `invoke-card`, `error-step`, `decorator-badge`

v2 components (moving to casehub-mosaic per #578 — render agency/eidos YAML):
- `eidos-view`, `voting-view`, `debate-view`, `agent-card`, `agent-viewer`

Design mockup: `docs/mockups/step-review-viewer.html` (24 sections). Spec: `docs/specs/2026-10-17-step-review-viewer-design.md`.
