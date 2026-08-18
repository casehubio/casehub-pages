# 0002 — ARIA as the unified interaction model for accessibility and scenario automation

Date: 2026-08-17
Status: Accepted

## Context and Problem Statement

CaseHub platform components span two repos (pages, blocks-ui) and serve three consumers that need to identify and interact with UI elements: screen readers, a scenario automation tool (YAML-driven), and LLM agents (via MCP). Historically, accessibility and test automation are treated as separate concerns — ARIA attributes for screen readers, `data-testid` / `data-automation` for automation. This creates two parallel targeting systems that drift independently, doubling maintenance and hiding accessibility bugs that automation tests don't surface.

## Decision Drivers

* Screen readers and automation tools need the same thing: a way to find a component by what it is (role) and what it's called (accessible name), then interact with it
* Parallel attribute systems (`data-testid` alongside ARIA) create drift — automation passes while accessibility is broken
* The platform already has a11y mixins in pages-primitives (FocusTrapMixin, RovingTabindexMixin, LiveRegionMixin, KeyboardShortcutMixin) handling behavioural accessibility; ARIA attribute declaration is the missing layer
* Shadow DOM complicates both ARIA tree walking and automated element location — one solution is better than two
* Components exist across pages and blocks-ui — enforcement must work cross-repo

## Considered Options

* **Option A** — Dual-track: ARIA for accessibility, `data-testid` for automation
* **Option B** — ARIA as the single interaction model for both accessibility and automation
* **Option C** — Custom element registry with ARIA reflection

## Decision Outcome

Chosen option: **Option B — ARIA as the single interaction model**, because it eliminates the class of bugs where automation passes but accessibility is broken. If a scenario step can't find a component by role + name, a screen reader can't either. One root cause, one fix.

### Enforcement

Two-layer enforcement across both repos:

| Layer | Mechanism | What it catches |
|-------|-----------|-----------------|
| Compile time | `AriaInteractive` interface in pages-primitives | Missing role or accessible name on interactive components |
| CI | axe-core validation of rendered component fixtures | Missing required ARIA properties for declared roles, invalid attribute values, contrast violations |

The `AriaInteractive` interface is the minimal base — `role` and `ariaLabel` are mandatory. Role-specific attributes (e.g. `aria-valuenow` for meters, `aria-rowcount` for grids) are enforced by axe-core against WAI-ARIA required properties, not by the TypeScript type.

### Automation targeting

All automation (scenario YAML, MCP tools, future test infrastructure) targets elements by `{ role, name }` — the same coordinates a screen reader uses. Scoped targeting (`within: { role, name }`) handles disambiguation for repeated elements. No `data-testid`, `data-automation`, or other parallel attribute system.

### Architecture

```
Consumers (screen readers, scenario tool, LLM/MCP)
        │
        ▼
  ARIA tree (DOM attributes: role, aria-label, aria-busy, ...)
        ▲
  AriaInteractive contract (pages-primitives)
        ▲
  pages widgets  ·  blocks-ui widgets
```

The in-browser navigation API (`@casehubio/pages-aria`) provides tree walking and command execution against the ARIA tree, consumed by the scenario tool and MCP server. Screen readers consume the ARIA tree directly via the browser's accessibility API.

### Positive Consequences

* One targeting system — if automation finds a component, a screen reader will too
* No parallel attribute maintenance — ARIA attributes are the only element identity mechanism
* axe-core CI catches real accessibility violations, not just missing test IDs
* Existing a11y mixins (focus management, keyboard navigation, live regions) are unchanged — they handle behaviour, ARIA handles identity
* Cross-repo enforcement via shared contract types in pages-primitives

### Negative Consequences / Tradeoffs

* No runtime enforcement — a component can satisfy the TypeScript interface but fail to reflect attributes to DOM. axe-core CI catches this, but only when test fixtures render the component
* Some interactions don't map cleanly to ARIA roles (drag-and-drop, hover tooltips, canvas-internal interactions) — these need escape hatches or future command vocabulary extensions
* Requires all interactive components across both repos to be audited and remediated — substantial upfront work (~40 blocks-ui components, ~20 pages components)

## Pros and Cons of the Options

### Option A — Dual-track

* Good: No change to existing automation — `data-testid` keeps working
* Good: Familiar pattern for frontend testing
* Bad: Two attribute systems to maintain per component
* Bad: Automation can pass while accessibility is broken — the most dangerous failure mode
* Bad: `data-testid` values are arbitrary strings with no spec — naming drifts per developer

### Option B — ARIA as single model

* Good: One system, one set of bugs, one fix
* Good: Industry-standard attributes with a formal spec (WAI-ARIA)
* Good: axe-core validates correctness for free — no custom lint rules
* Bad: Initial remediation effort across two repos
* Bad: Some edge cases need future vocabulary extensions

### Option C — Custom element registry with ARIA reflection

* Good: Programmable — can add custom metadata beyond ARIA
* Bad: Parallel to the actual ARIA tree — if the registry and rendered attributes diverge, the "one model" guarantee is broken
* Bad: Invents infrastructure that ARIA already provides
* Bad: Not consumable by screen readers — they read the DOM, not a custom registry

## Links

* [casehubio/parent#417 — ARIA as unified interaction model](https://github.com/casehubio/parent/issues/417)
* [casehubio/casehub-pages#314 — ADR + platform protocol: codify ARIA decisions](https://github.com/casehubio/casehub-pages/issues/314)
* [casehubio/casehub-pages#15 — Accessibility: ARIA attributes, keyboard navigation, screen reader support](https://github.com/casehubio/casehub-pages/issues/15)
* Design spec: `docs/specs/issue-417-aria-interaction-model/`
