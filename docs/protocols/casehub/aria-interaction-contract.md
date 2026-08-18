---
id: PP-20260817-a11y01
title: "Interactive components declare ARIA role + accessible name — no parallel automation attributes"
type: rule
scope: platform
applies_to: "all interactive Web Components in casehub-pages and blocks-ui"
cross_repo_consumers:
  - blocks-ui
severity: critical
refs:
  - "docs/adr/0002-aria-unified-interaction-model.md"
  - "casehubio/parent#417"
violation_hint: "Interactive component missing role or aria-label, or using data-testid/data-automation for element targeting"
created: 2026-08-17
---

Every interactive Web Component across casehub-pages and blocks-ui must
declare an ARIA `role` and accessible name (`aria-label` or
`aria-labelledby`). These are the only element-targeting mechanism for
automation and accessibility — no `data-testid`, `data-automation`, or
other parallel attribute system.

## Contract

All interactive components satisfy the `AriaInteractive` interface from
`@casehubio/pages-primitives`:

```typescript
interface AriaInteractive {
  role: AriaRole;
  ariaLabel: string;
  ariaBusy?: boolean;
  ariaDisabled?: boolean;
  ariaExpanded?: boolean;
}
```

This is the **minimal base**. Role-specific attributes (e.g.
`aria-valuenow` for meters, `aria-rowcount` for grids, `aria-level` for
tree items) are required by WAI-ARIA and enforced by axe-core CI — not
by this interface.

## ARIA patterns by component type

| Pattern | Roles | Required attributes | Examples |
|---------|-------|---------------------|----------|
| Form/input | textbox, combobox, checkbox | aria-label, aria-required, aria-invalid | PagesInput, PagesSelect, PagesCheckbox |
| Button/action | button | aria-label, aria-disabled, aria-busy | PagesButton, PagesActionButton |
| Grid/table | grid, row, gridcell, columnheader | aria-label, aria-rowcount, aria-sort | PagesDataTable, PagesGridTable |
| Tree | tree, treeitem | aria-label, aria-expanded, aria-level | case-explorer, blocks-plan-item-tree |
| Tabbed layout | tablist, tab, tabpanel | aria-selected, aria-controls, aria-labelledby | session-workbench, orchestration-workbench |
| List | list/listbox, listitem/option | aria-label, aria-selected | notification-inbox, list-pane |
| Dialog | alertdialog | aria-label, aria-modal, aria-describedby | PagesConfirmDialog, approval-gate |
| Status/display | status, meter, alert | aria-label, aria-live, aria-valuenow (meters) | PagesBadge, PagesMeter, PagesAlert |
| Region/layout | region, separator | aria-label, aria-orientation | split-workbench, detail-pane |
| Visualization | img | aria-label | casehub-diagram, blocks-dag-viewer |
| Log/feed | log | aria-live="polite", aria-label | conversation-viewer, execution-monitor |
| Chart (ECharts) | — (non-interactive) | aria.enabled + aria-label on wrapper | PagesBarChart, PagesLineChart, all chart components |

## Enforcement

| Layer | Mechanism | Scope |
|-------|-----------|-------|
| Compile time | `AriaInteractive` type check | pages, blocks-ui |
| CI | `@axe-core/playwright` on rendered fixtures | pages, blocks-ui |

axe-core validates rendered output against full WAI-ARIA requirements
including role-specific required properties. If a component renders
without correct ARIA, CI fails.

## What this protocol does NOT cover

- **Behavioural accessibility** (focus management, keyboard navigation,
  live region announcements) — handled by existing mixins in
  pages-primitives: `FocusTrapMixin`, `RovingTabindexMixin`,
  `LiveRegionMixin`, `KeyboardShortcutMixin`
- **ARIA pattern correctness** (whether a tree should use tree roles vs
  list roles) — a code review concern, not automatable
- **Decorative elements** — elements that are purely visual (sparklines,
  legends marked `aria-hidden`) have no interaction contract

## Prohibited

- `data-testid` attributes for element targeting
- `data-automation` attributes for element targeting
- Any parallel targeting mechanism that duplicates ARIA identity

Automation (scenario YAML, MCP tools, test infrastructure) targets
elements by `{ role, name }` with optional `within` scoping for
disambiguation. This is the same coordinate system screen readers use.
