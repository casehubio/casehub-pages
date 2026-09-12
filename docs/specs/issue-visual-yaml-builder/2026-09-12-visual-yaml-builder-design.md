# Visual YAML Builder — Design Specification

**Date:** 2026-09-12
**Status:** Draft
**Scope:** Phase 1 (page builder) detailed; Phase 2+ (project graph, agentic AI layers) architecture

## Problem

CaseHub adopts a YAML-first authoring model across pages, case definitions, agentic
patterns, cognitive profiles, org structures, and work orchestration. The CodeMirror
editor with schema-driven autocomplete addresses syntax, but does not address the
harder problems: discoverability (what components/capabilities exist?), structural
composition (how do I nest rows, columns, and components?), cross-document wiring
(does this reference actually resolve?), and the cold-start problem (where do I begin?).

Users need a visual builder that:

1. Makes the full component/capability catalogue discoverable without memorising type names
2. Guides structural composition through drag-and-drop and contextual palettes
3. Validates cross-document references at authoring time
4. Works as a complete authoring environment — users who never open the YAML pane are not second-class
5. Creates a natural gradient from fully visual to fully textual, so users learn YAML without being forced into it

## Architecture

### Canonical Model: CST-Backed Typed Facade

The YAML Concrete Syntax Tree (CST) is the single source of truth. A typed facade
wraps the CST, providing structural operations that internally perform format-preserving
mutations via the existing `yaml-edits.ts` primitives. The visual builder interacts
with the facade, never touching the CST directly.

**Why CST, not a semantic model:**
- Format-preserving — comments, whitespace, and author formatting survive edits
- Single truth — no model/YAML divergence risk
- Bidirectional sync is natural — both visual and text views operate on the same CST
- Existing infrastructure — `yamlSetOrDelete`, `yamlSwitchVariant`, `yamlAppendWithUniqueName` are already in `pages-lsp`

```
Visual Builder UI (Lit web components)
  │
  ▼
Document Facade (typed API per document type)
  │
  ▼
YAML CST (parseDocument from 'yaml' library) + yaml-edits.ts
  │
  ▼
Code Editor (pages-code-editor, CodeMirror 6)
```

### Type-Safe Cross-Document References

Reference fields are typed, not strings. A binding's capability field is a
`CapabilityRef` that resolves against declared capabilities. A worker's agentId
is an `AgentRef` that resolves against Eidos agent profiles. The project graph
validates all references and supports rename-refactoring across files.

This is a core CaseHub differentiator: multi-document projects get the same
type safety that single-file languages take for granted.

---

## Phase 1: Page Builder

### Document Facade — `PageDocument`

Lives in `pages-lsp/src/facades/`. Wraps a parsed YAML CST and exposes typed
operations for page composition.

```typescript
class PageDocument {
  static parse(yaml: string): PageDocument
  static empty(): PageDocument

  toString(): string

  // Structure
  getPages(): PageNode[]
  getDatasets(): DatasetNode[]
  getNavTree(): NavTreeNode | undefined
  getProperties(): Record<string, string>

  // Mutations
  addPage(name: string): PageNode
  removePage(index: number): void
  addDataset(uuid: string, defaults?: Partial<DatasetDef>): DatasetNode
  removeDataset(index: number): void
  setProperty(key: string, value: string): void

  // Undo/redo
  undo(): boolean
  redo(): boolean
  canUndo(): boolean
  canRedo(): boolean

  // Change notification
  onChange(listener: (yaml: string) => void): Unsubscribe
}

interface PageNode {
  readonly path: readonly (string | number)[]
  name: string
  getRows(): RowNode[]
  getComponents(): ComponentNode[]
  addRow(): RowNode
  addComponent(type: string, props?: Record<string, unknown>): ComponentNode
  removeChild(index: number): void
}

interface ComponentNode {
  readonly path: readonly (string | number)[]
  type: string
  getProperties(): Record<string, unknown>
  setProperty(key: string, value: unknown): void
  removeProperty(key: string): void
  getSchema(): z.ZodType
  moveTo(targetPath: readonly (string | number)[]): void
  duplicate(): ComponentNode
}
```

Node objects hold CST paths, not data copies. Reading walks the CST. Writing
mutates the CST and fires `onChange`. Undo/redo maintains a CST snapshot stack.

### Builder Shell — `pages-builder-shell`

The orchestrating Lit component that composes tree, property panel, palette,
and YAML pane into the edit-mode experience.

```
┌─────────────────────────────────────────────────────────┐
│  Toolbar: [+ Page] [+ Dataset] [Undo] [Redo] [Preview] │
├──────────────┬──────────────────────────────────────────┤
│  Outline     │  Property Panel                          │
│  Tree        │  (pages-property-palette)                │
│              │                                          │
│  ▼ Datasets  │  Type: [bar-chart ▼]                     │
│    sales_tx  │  Dataset: [sales_transactions ▼]         │
│  ▼ Pages     │  Subtype: [column-stacked ▼]             │
│    ▼ Overview│  ▼ Filter                                │
│      ▼ Row 1 │    Listening: [✓]                        │
│        metric│  ▼ Lookup                                │
│        ...   │    Column: [region ▼]                    │
│              │                                          │
│              │  ┌ Component Palette ──────────────────┐ │
│  [+ Add]     │  │ Layout  Charts  Tables  Forms  ... │ │
│              │  └────────────────────────────────────┘ │
├──────────────┴──────────────────────────────────────────┤
│  ▸ YAML                                           [▾]  │
└─────────────────────────────────────────────────────────┘
```

### Outline Tree — `pages-builder-tree`

Renders the page document structure as an interactive tree.

**Node display:**
- Datasets section at top, pages below, navigation at bottom
- Each node shows: component type icon, human-readable label (derived from title/name/lookup.uuid), column span in brackets
- Colour coding by category (charts blue, layout grey, forms green, etc.)

**Interactions:**
- Click → select node, populate property panel
- Drag → reorder within container or move between containers
- Right-click → context menu (Add child, Duplicate, Delete, Wrap in row/column)
- `+` button on containers → opens component palette

**Label derivation:**
- `title` components → `properties.text`
- Data components → `properties.title` or `properties.lookup.uuid`
- Pages → `name`
- Fallback → component `type`

### Component Palette — `pages-builder-palette`

Categorised, searchable, contextually filtered.

**Categories:** Layout, Charts, Tables & Data, Metrics, Forms, Content, Workbench

**Each entry:**
```typescript
interface ComponentCatalogEntry {
  type: string;
  label: string;
  category: string;
  icon: string;
  description: string;
  defaultProps: Record<string, unknown>;
  contextRelevance(ctx: PaletteContext): 'promoted' | 'normal' | 'hidden' | 'needs-prereq';
  prereqHint?: string;
}
```

**Contextual filtering:**
- Hard filter: hide entries invalid at the insertion point
- Soft promotion: surface relevant entries first (form components inside form-scope, metrics inside metric-grid)
- Prerequisite hints: data components show "Add a dataset first" when none exist

**Palette context:**
```typescript
interface PaletteContext {
  parentType: string | undefined;
  acceptsComponents: boolean;
  availableDatasets: string[];
  siblingTypes: string[];
}
```

### Property Panel

Reuses `pages-property-palette` with enhancements:

1. **Type switcher** — dropdown at top showing current component type. Changing it calls `yamlSwitchVariant` on the CST.
2. **Dataset picker** — `lookup.uuid` renders as a dropdown populated from `document.getDatasets()`.
3. **Column mapper** — once a dataset is selected, column-reference fields render as dropdowns populated from that dataset's column definitions.
4. **Filter builder** — structured form: pick column (dropdown), pick function (dropdown from enum), enter args. Not free-text YAML.
5. **Expression helper** — `${expression}` fields show available page properties and a link to define new ones.

### YAML Pane — Progressive Disclosure

Uses `pages-code-editor` (CodeMirror 6) with bidirectional CST sync.

**Collapsed state (default):**
- Thin bar at bottom with "YAML" label and expand chevron
- Subtle highlight on change — invites curiosity

**Expanded state:**
- Resizable splitter, full syntax highlighting, autocomplete, linting
- **Node highlighting** — selecting a tree node highlights and scrolls to the corresponding YAML range
- **Reverse selection** — clicking a YAML key selects the corresponding tree node

**Bidirectional sync:**
```
Visual edit → facade mutation → CST update → onChange fires
  → code editor receives new text (diff-applied, preserves cursor/scroll)

Text edit → code editor 'input' event → facade re-parses CST
  → tree re-renders → property panel updates
  → parse failure: show lint errors, keep last valid tree state
```

**Teaching gradient:**
1. Build visually, never open pane
2. Open pane, see highlighting as you click — passive learning
3. Make small text edits, see tree update — active learning
4. Copy-paste in YAML for speed — proficiency
5. Work primarily in YAML — mastery

### Package Structure

```
packages/
  pages-lsp/src/
    facades/
      page-document.ts          # PageDocument facade
      types.ts                  # Shared node interfaces
    refactoring/
      yaml-edits.ts             # Existing CST primitives

  pages-builder/                # NEW package
    src/
      shell/
        builder-shell.ts        # Orchestrating shell
        yaml-sync.ts            # Bidirectional sync coordinator
      tree/
        builder-tree.ts         # Outline tree component
      palette/
        builder-palette.ts      # Component palette
        component-catalog.ts    # Category/icon/description/defaults
        palette-context.ts      # Contextual filtering
      data/
        builder-data-panel.ts   # Dataset configuration
      index.ts

  pages-code-editor/            # Existing — YAML pane
  pages-property-palette/       # Existing — property editing
  pages-diagram-palette/        # Existing — base for palette
```

---

## Phase 2: Project-Level Builder

### Project Graph

A connected view of an entire multi-module CaseHub application. Each file in the
project is parsed into its document facade, and the project graph holds all facades
with cross-reference validation.

```typescript
interface ProjectGraph {
  // Document collections
  orgs: OrgDocument[];
  agents: AgentDocument[];
  cases: CaseDocument[];
  patterns: PatternDocument[];
  cognition: CognitionDocument[];
  worlds: WorldDocument[];
  work: WorkDocument[];
  pages: PageDocument[];

  // Cross-reference resolution
  resolveAgentRef(agentId: string): AgentNode | undefined;
  resolveCapabilityRef(caseName: string, capName: string): CapabilityNode | undefined;
  resolvePatternRef(name: string): PatternNode | undefined;
  resolveDatasetRef(uuid: string): DatasetNode | undefined;

  // Validation
  validateReferences(): TypedValidationError[];

  // Refactoring
  renameSymbol(symbol: TypedSymbol, newName: string): FileEdit[];

  // Navigation
  getReferencesTo(nodeId: string): CrossReference[];
  getReferencesFrom(nodeId: string): CrossReference[];
}
```

### Authoring Flow

The project graph surfaces the natural authoring flow for agentic AI applications:

```
1. EIDOS — Define org and agents
   │  Organization YAML: units, relationships, archetypes
   │  Agent profiles: identity, capabilities, disposition
   │
   ▼
2. ENGINE — Define the case
   │  Capabilities, workers, bindings, milestones, goals
   │  Worker types: do | agent | a2a | mcp | react | sequence | forEach
   │
   ▼
3. BLOCKS — Define agent coordination
   │  Pattern YAML: supervisor | parallel | loop | voting | debate | htn
   │  Cognition YAML: drive, mood, personality, memory
   │  World YAML: actions, entities, affordances
   │  Pipeline YAML: event processing, summarisation
   │
   ▼
4. WORK — Define human participation
   │  Templates, progress definitions, SLA escalation
   │
   ▼
5. NEOCORTEX — Wire cognitive capabilities
   │  Cognitive profiles, CBR memory, RAG configuration
   │
   ▼
6. PAGES — Build the UI
      Layouts, components, data pipelines, navigation
```

### Cross-Document Reference Types

| Reference | From | To | Validation |
|-----------|------|----|------------|
| `CapabilityRef` | Engine binding | Engine capability | Name must exist in same case |
| `WorkerRef` | Engine binding | Engine worker | Worker must claim the capability |
| `AgentRef` | Engine worker | Eidos agent | AgentId must resolve to a profile |
| `PatternRef` | Engine worker (composed) | Blocks pattern | Pattern must exist |
| `DispositionRef` | Neocortex cognitive profile | Eidos disposition | Derivation chain |
| `DatasetRef` | Pages component | Pages/Engine dataset | UUID must resolve |
| `ActionRef` | Blocks world action | Engine capability | Name alignment |
| `TemplateRef` | Engine humanTask | Work template | Candidate group wiring |

### Document Facades Per Layer

Each layer gets its own facade class following the same CST-backed pattern:

| Layer | Facade | Key Operations |
|-------|--------|----------------|
| Eidos | `OrgDocument` | Add/remove units, wire relationships, apply archetype |
| Eidos | `AgentDocument` | Set capabilities, disposition sliders, Jungian profile |
| Engine | `CaseDocument` | Capability/worker/binding triad, milestone/goal, planning strategy |
| Blocks | `PatternDocument` | Recursive agent composition, routing, termination |
| Blocks | `CognitionDocument` | Drive/mood/personality tuning |
| Blocks | `WorldDocument` | Actions, entities, affordances |
| Blocks | `PipelineDocument` | Source, levels, summarisers |
| Work | `WorkDocument` | Templates, progress stages, SLA |
| Neocortex | `CognitiveProfileDocument` | Personality, mood, curiosity, vocabulary |
| Pages | `PageDocument` | Components, layout, data pipelines |

### Archetype Scaffolding

Archetypes generate connected multi-file projects with cross-references pre-wired:

**Existing archetypes to leverage:**
- Eidos: 9 org archetypes (pipeline, federation, market, matrix, divisional-holarchy, etc.)
- Blocks: 5 full examples (incident-response, fleet-logistics, research-team, contract-review, historical-encounter)
- Engine: 8 examples (choreography, sequential, GOAP, LLM, A2A, MCP, humanTask, subcase)

**Archetype structure:**
```
archetype/
  eidos/
    org.yaml              # Pre-configured org structure
    agents/*.yaml         # Agent profiles for each role
  engine/
    case.yaml             # Case definition with capabilities and workers
  blocks/
    pattern.yaml          # Agent coordination pattern
    cognition.yaml        # Cognitive configuration
    world.yaml            # Environment and actions
  work/
    templates.yaml        # Human task templates
  pages/
    dashboard.page.yaml   # Monitoring/control UI
```

### Complexity Areas Requiring Special Builder Support

1. **Capability → Worker → Binding triad** (Engine) — the builder must validate that every capability is claimed by a worker and wired by a binding. Missing any one silently breaks the chain.

2. **Recursive pattern composition** (Blocks) — composed agents contain nested patterns. The tree must show unlimited nesting depth with clear visual hierarchy.

3. **Disposition configuration** (Eidos) — weighted term vectors across 5 axes plus Jungian profiles. Needs slider-based UI with sensible defaults, not raw number entry.

4. **JQ/JSONata expressions** (Engine) — input/output projections and guard conditions. Needs syntax highlighting, validation, and autocomplete against the data model.

5. **Cross-file reference consistency** — agent names, capability names, event types must match across files. The project graph validates these and the palette populates from the typed graph.

6. **Model provider configuration** (Engine workers) — discriminated union across 5 LLM providers (Anthropic, OpenAI, Ollama, Mistral, Google), each with different parameters. The property panel must switch schemas when the provider changes.

---

## Design Principles

1. **YAML is always truth** — the CST is canonical, the visual builder is a view
2. **Type-safe by default** — references are typed, validation is immediate, refactoring propagates
3. **Contextual, not exhaustive** — show what's relevant here, not everything that exists
4. **Progressive disclosure** — full visual for beginners, natural slide to YAML, no dead ends
5. **Archetype-driven cold start** — begin from a working application, not a blank page
6. **One facade pattern** — every document type gets the same CST-backed typed facade, the same tree+property+palette UI pattern, and the same progressive YAML disclosure

## References

- `packages/pages-lsp/src/refactoring/yaml-edits.ts` — existing CST mutation primitives
- `packages/pages-schema/src/document-schema.ts` — page document Zod schema
- `packages/pages-schema/src/schema-registry.ts` — component type → schema mapping
- `packages/pages-property-palette/` — existing schema-driven property editor
- `packages/pages-diagram-palette/` — existing component palette pattern
- `packages/pages-code-editor/` — existing CodeMirror 6 editor
- `packages/pages-lsp/src/schema-navigation.ts` — schema traversal and completion
- Backstage Template Builder — visual YAML authoring without hiding YAML
- Google Blockly — block-based visual programming library
- `engine/schema/src/main/resources/schema/CaseDefinition.yaml` — engine case schema
- `blocks/agentic-yaml/src/main/java/io/casehub/blocks/agentic/yaml/spec/` — blocks pattern specs
- `eidos/org-api/src/main/java/io/casehub/eidos/org/api/` — org structure types
- `eidos/api/src/main/java/io/casehub/eidos/api/` — agent descriptor types
- `eidos/examples/org-scenarios/src/test/resources/archetypes/` — org archetype templates
- `blocks/agentic-yaml/src/test/resources/examples/` — full agentic application examples
