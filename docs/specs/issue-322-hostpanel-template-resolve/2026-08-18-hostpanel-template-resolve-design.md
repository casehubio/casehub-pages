# hostPanel Template Resolution in configure() Props

**Issue:** #322
**Date:** 2026-08-18

## Problem

`hostPanel` passes `panelProps` directly to `configure()` without template resolution. Any `#{xxx}` values in panel props are passed as literal strings — they are never interpolated with context data.

**Location:** `packages/pages-runtime/src/activation.ts` ~line 502:
```typescript
const configurable = panel as unknown as ConfigurablePanel;
if (typeof configurable.configure === "function") {
    configurable.configure(panelProps ?? {});
}
```

Templates ARE resolved for other component types in the same file:
- Title (`type: "title"`) — line 390
- HTML (`type: "html"`) — line 408
- Markdown (`type: "markdown"`) — line 427
- Alert (`type: "alert"`) — line 456
- Dataset URLs — `data-pipeline.ts` line 587
- Action URLs/bodies — `action.ts`

All use `hasTemplateVars()` + `resolveTemplate()` + ContextManager consumer registration. hostPanel bypasses all of these.

## Design

### Template Resolution via ContextManager Registration (D1)

Follow the existing pattern: check for template vars, resolve initially, register a ContextConsumer for reactive updates. The ContextManager handles `filter`, `params`, `datasets`, `page`, and `selection` namespaces.

`#{row.xxx}` is out of scope (D2). The `row` namespace is per-instance (set locally via `createRowContext()`), not global. The ContextManager is a shared singleton — putting row on it would corrupt other consumers. Master-detail panels should use `#{selection.datasetId.field}`.

### Recursive Prop Resolution (D3)

Walk panelProps recursively to resolve string values containing templates. Extends `action.ts`'s `resolveBodyTemplates` pattern to also handle array elements:

```typescript
function resolvePropsTemplates(
  props: Record<string, unknown>,
  context: RuntimeContext,
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (typeof value === "string") {
      resolved[key] = resolveTemplate(value, context, "none");
    } else if (Array.isArray(value)) {
      resolved[key] = value.map(item =>
        typeof item === "string"
          ? resolveTemplate(item, context, "none")
          : item !== null && typeof item === "object"
            ? resolvePropsTemplates(item as Record<string, unknown>, context)
            : item
      );
    } else if (value !== null && typeof value === "object") {
      resolved[key] = resolvePropsTemplates(
        value as Record<string, unknown>,
        context,
      );
    } else {
      resolved[key] = value;
    }
  }
  return resolved;
}
```

Escape mode is `"none"` for all values (D4). panelProps are programmatic configuration consumed by the panel's TypeScript code, not rendered as HTML. The panel decides how to use them.

**Note on array resolution (R1-06):** `action.ts`'s `resolveBodyTemplates` passes arrays through unchanged. This spec extends the pattern for panelProps because panel configuration naturally contains parameterized arrays (endpoint lists, filter values). Updating `action.ts` to also handle arrays is a follow-up — the asymmetry is intentional for now, scoped to this issue.

### Check for Template Vars in Props

```typescript
function propsHaveTemplateVars(
  props: Record<string, unknown>,
): boolean {
  for (const value of Object.values(props)) {
    if (typeof value === "string" && hasTemplateVars(value)) return true;
    if (Array.isArray(value)) {
      for (const item of value) {
        if (typeof item === "string" && hasTemplateVars(item)) return true;
        if (item !== null && typeof item === "object" &&
            propsHaveTemplateVars(item as Record<string, unknown>)) return true;
      }
    }
    if (value !== null && typeof value === "object" && !Array.isArray(value) &&
        propsHaveTemplateVars(value as Record<string, unknown>)) return true;
  }
  return false;
}
```

### Extract Individual Template Strings

To register each template-containing value as a separate entry in the consumer's `templates` Map, extract all template-bearing string values with their dot-path keys:

```typescript
function extractTemplateStrings(
  props: Record<string, unknown>,
  prefix: string,
): Array<{ key: string; template: string }> {
  const result: Array<{ key: string; template: string }> = [];
  for (const [k, value] of Object.entries(props)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof value === "string" && hasTemplateVars(value)) {
      result.push({ key: path, template: value });
    } else if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (typeof item === "string" && hasTemplateVars(item)) {
          result.push({ key: `${path}[${i}]`, template: item });
        } else if (item !== null && typeof item === "object") {
          result.push(
            ...extractTemplateStrings(item as Record<string, unknown>, `${path}[${i}]`),
          );
        }
      }
    } else if (value !== null && typeof value === "object") {
      result.push(
        ...extractTemplateStrings(value as Record<string, unknown>, path),
      );
    }
  }
  return result;
}
```

### Deferred configure() (D5)

Unlike title/html/markdown (where empty text is a valid visual state), panelProps can drive network connections, API calls, and WebSocket subscriptions. Calling configure() with partially-resolved template values causes wasted work and errors.

configure() is deferred until all template vars in panelProps resolve to non-empty values, using `allTemplateVarsResolved()` — the same gate as data-pipeline.ts URL deferral. This means:

1. When panelProps contain template variables, configure() is NOT called before DOM attachment
2. `el.appendChild(panel)` executes — `connectedCallback` fires with no prior configure()
3. When context changes and all template vars resolve, `postEvaluate()` calls configure()

Panels must handle both orderings:
- No template vars → configure() before attachment (unchanged behavior)
- Template vars → connectedCallback first, configure() later

This is compatible with the existing "Re-configuration" clause in the ConfigurablePanel contract — panels already handle re-entry. The change is that the first call may come after connection.

**ConfigurablePanel JSDoc update:** The hosting.ts comment must be updated to reflect conditional timing.

### postEvaluate() Hook for Batched configure() (D6)

Host panel consumers may have multiple template props. Without batching, each entry's `apply` fires independently — intermediate states reach the panel. The fix: add an optional `postEvaluate(changed: boolean)` hook to `ContextConsumer`.

**ContextConsumer interface change** (`context-wiring.ts`):

```typescript
export interface ContextConsumer {
  element: Element;
  templates: Map<string, { /* unchanged */ }>;
  visibleWhen?: { /* unchanged */ };
  suspended: boolean;
  postEvaluate?: (changed: boolean) => void;  // NEW — called once after all templates evaluated
}
```

**ContextManager `#evaluateConsumer` change:**

```typescript
#evaluateConsumer(consumer: ContextConsumer): void {
  // Handle visibleWhen suspension (unchanged)
  // ...

  if (consumer.suspended) return;

  // Evaluate all templates — track whether any changed
  let changed = false;
  for (const [, entry] of consumer.templates) {
    const resolved = resolveTemplate(entry.template, this.#context, entry.escapeMode);
    if (resolved !== entry.lastResolved) {
      entry.lastResolved = resolved;
      entry.apply(resolved);
      changed = true;
    }
  }

  // NEW: post-evaluation hook — only called when at least one template changed
  if (consumer.postEvaluate) {
    consumer.postEvaluate(changed);
  }
}
```

The `changed` parameter tells the consumer whether any template value actually changed this cycle. Host panel consumers check `changed` before calling configure() — no spurious reconfiguration on unrelated context changes. Existing consumers (title, html, markdown) don't set `postEvaluate` — no impact on current behavior.

### Host Panel Consumer Registration

The host-panel branch in activation.ts gains template resolution:

```typescript
if (component.type === "host-panel" && component.props) {
  const { typeName, panelProps, lookup } = component.props as unknown as HostPanelProps;
  if (!typeName) return;

  const tagName = lookupPanel(typeName);
  if (!tagName) {
    el.textContent = `Unknown panel type: ${typeName}`;
    console.warn(`hostPanel: unregistered type "${typeName}"`);
    return;
  }

  const panel = document.createElement(tagName);
  const configurable = panel as unknown as ConfigurablePanel;

  // Template resolution for panelProps
  const hasTemplates = panelProps && contextManager && propsHaveTemplateVars(panelProps);

  if (hasTemplates) {
    const templateEntries = extractTemplateStrings(panelProps, "");
    let dataRequestDispatched = false;

    const templates = new Map(
      templateEntries.map(({ key, template }) => [
        key,
        {
          template,
          escapeMode: "none" as EscapeMode,
          lastResolved: "",
          apply: (_resolved: string) => { /* change detection only */ },
        },
      ]),
    );

    const consumer: ContextConsumer = {
      element: el,  // D7: wrapper el, not panel
      templates,
      suspended: false,
      postEvaluate: (changed: boolean) => {
        if (!changed) return;

        const allResolved = templateEntries.every(({ template }) =>
          allTemplateVarsResolved(template, contextManager.getContext()),
        );
        if (!allResolved) return;

        const resolvedProps = resolvePropsTemplates(panelProps, contextManager.getContext());
        if (typeof configurable.configure === "function") {
          configurable.configure(resolvedProps);
        }

        // Deferred data pipeline binding (D5 + R1-04):
        // dispatch pages-data-request only after template vars resolve
        if (lookup && !dataRequestDispatched) {
          dataRequestDispatched = true;
          dispatchDataRequest(panel, el, lookup, registry, componentId, component, pagePath);
        }
      },
    };

    contextManager.registerConsumer(consumer);
    // registerConsumer calls #evaluateConsumer (not evaluateAll) which
    // triggers postEvaluate — if vars are already resolved, configure()
    // fires before appendChild

    // Registry + appendChild without data binding (deferred above)
    if (!lookup) {
      registry.set(componentId, {
        element: el,
        component,
        pagePath,
        hasExplicitId: component.id !== undefined,
      });
    }
    // If lookup exists, registry + data-request happen in postEvaluate
    // after template vars resolve
  } else {
    // No template vars — existing behavior
    if (typeof configurable.configure === "function") {
      configurable.configure(panelProps ?? {});
    }
    // lookup / registry / appendChild logic unchanged
  }

  el.appendChild(panel);
  return;
}
```

**Deferred data pipeline binding (R1-04):** When a host panel has both template props and a `lookup`, the `pages-data-request` event is deferred alongside configure(). A panel that receives data before configuration can't process it (it doesn't know which endpoint to connect to, which columns to render, etc.). The `dataRequestDispatched` flag ensures the request fires exactly once — on the first postEvaluate where all vars resolve. Subsequent context changes trigger re-configure but not re-dispatch (the data pipeline handles re-delivery through its own subscription mechanism).

The `dispatchDataRequest` helper encapsulates the existing DataReceiver guard, proxy creation, registry entry, and event dispatch — extracted from the current inline code for reuse in both the template and non-template paths.

### Consumer Element Reference (D7)

The consumer uses wrapper `el` (not the panel DOM element) as `consumer.element`. ContextManager prunes stale consumers by checking `consumer.element.isConnected`. The wrapper is managed by the layout engine — removed when the component is torn down or page navigates. This is consistent with all existing consumers.

### selectionSource Composition (D8)

Template props and selectionSource are complementary mechanisms that fire on the same trigger (selection change) with deterministic ordering:

1. `contextManager.updateSelection()` runs first → `evaluateAll()` → template consumers fire configure() with resolved string values
2. `dispatchSelectionToHostPanels()` runs second → `pages-selection-changed` events with raw row object

Panels can use either or both. Template props for simple string configuration (IDs, URLs, labels). selectionSource for full row objects when the panel needs rich data.

## Package Changes

| Package | Change | Breaking |
|---------|--------|----------|
| `pages-runtime` | `ContextConsumer` gains optional `postEvaluate(changed)`. `#evaluateConsumer` calls it with change flag. Activation wiring for host-panel template props. `dispatchDataRequest` helper extracted. | No — `postEvaluate` is optional |
| `pages-component` | ConfigurablePanel JSDoc updated for conditional timing | No — documentation only |

## Testing

### Unit Tests (activation.ts)

1. **No template vars** — configure() called once with raw props (existing behavior)
2. **Template vars, context available** — configure() called with resolved values
3. **Template vars, context unavailable** — configure() deferred until vars resolve
4. **Context change** — configure() re-called with updated values
5. **Multiple template props** — configure() called once per context change (postEvaluate batching)
6. **Nested object templates** — deeply nested `#{xxx}` values resolved
7. **Array element templates** — array items with `#{xxx}` values resolved
8. **Mixed template/literal props** — literal values pass through, template values resolved
9. **Consumer pruned on disconnect** — wrapper el removed from DOM → consumer deregistered
10. **Unrelated context change** — postEvaluate skips configure() when `changed` is false
11. **Template props + lookup** — data-request deferred until template vars resolve
12. **Template props + lookup, vars already resolved** — data-request dispatched on first postEvaluate

### Unit Tests (context-wiring.ts)

10. **postEvaluate fires after templates** — verify postEvaluate called exactly once per evaluateAll cycle
11. **postEvaluate not called when suspended** — visibleWhen=false suppresses postEvaluate
12. **No postEvaluate** — existing consumers without postEvaluate unaffected

### Integration

13. **Master-detail with selectionSource** — both mechanisms fire in correct order
14. **Page navigation** — consumer pruned, no stale configure() calls

## Out of Scope

- `#{row.xxx}` resolution (D2) — row is per-instance context, not global
- Panel-initiated dataset refresh (#134)
- visibleWhen for host panels (separate concern)

## References

- activation.ts:487-546 — host-panel activation branch (the bug site)
- activation.ts:388-440 — title/html/markdown template resolution pattern
- activation.ts:841-879 — registerContentConsumer (existing consumer registration helper)
- context-wiring.ts:16-34 — ContextConsumer interface
- context-wiring.ts:133-174 — #evaluateConsumer (postEvaluate insertion point)
- template-parser.ts:74-83 — resolveTemplate
- template-parser.ts:88-113 — hasTemplateVars, allTemplateVarsResolved
- action.ts:86-108 — resolveBodyTemplates (recursive resolution pattern)
- types.ts:1-8 — RuntimeContext (row is optional, selection is global)
- expression-evaluator.ts:8-16 — createRowContext (local row context)
- hosting.ts:1-18 — ConfigurablePanel contract (JSDoc to update)
- site.ts:685-693 — selection change ordering (updateSelection before dispatch)
- 2026-07-06 ConfigurablePanel spec — DataReceiver/VizTarget bridge design
- Issue #322 — problem statement and scaffold #48 context
