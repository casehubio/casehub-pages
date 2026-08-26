# ADR-0003: Activation-Layer Containers Over Web Components for Runtime-Managed Types

**Status:** Accepted
**Date:** 2026-08-26
**Issue:** #337

## Context

Schema-form needed composable layout support. The natural approach was a `formScope` web component (extending `PagesElement`) that provides validation, field registration, and submit wiring to any children rendered in its slots.

However, `render.ts` places the viz element and slot containers as siblings inside the wrapper `div[data-component-type]`. Events from children in slot containers never traverse the viz element because they share a parent — not an ancestor-descendant relationship. No existing `DATA_COMPONENT_TYPE` has runtime-rendered children.

## Decision

Container-style component types that need to manage runtime-rendered children use the **activation-layer pattern**: the activation callback (`onNode`) adds event listeners directly on the wrapper `el` created by `renderNode`. No viz element is created. Children are rendered into slot containers inside `el` via the standard `renderNode` slot path.

This follows the precedent of `title`, `html`, and `markdown` activation handlers that operate without viz elements.

## Consequences

- The wrapper `el` is the DOM ancestor of all children — event bubbling works at any slot depth
- No web component needed in pages-viz for container-style types
- Form management logic lives in pages-runtime (activation callback + state objects), not pages-viz
- Future container-style types (e.g. wizard, stepper, accordion-form) should follow this pattern
- Container types must register in `ComponentRegistry` if they dispatch events that site.ts handles (e.g. `pages-record-create` needs `pagePath` for dataScope resolution)

## Alternatives Rejected

- **PagesElement web component in pages-viz** — impossible due to sibling DOM structure
- **DOM restructuring (move children inside viz element)** — fragile, breaks rendering model assumptions
- **wireFormScope in pages-component (like wireInteractivity)** — form management is runtime behavior, not rendering behavior; wrong package
