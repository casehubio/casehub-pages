# Conditionals

The `when` attribute controls whether a component exists in the expanded result. If the condition is falsy, the component is removed entirely.

```yaml
variables:
  features:
    showMetrics: "true"
    showTable: "false"
pages:
  - name: Dashboard
    components:
      metrics:
        type: metric
        when: "${features.showMetrics}"
      details:
        type: data-table
        when: "${features.showTable}"
```

**How `when` works:**
- The value must resolve to a boolean string: `true/false/yes/no/on/off/1/0`
- If falsy, the component is removed from the expanded map
- If truthy (or absent), the component stays
- `when` is evaluated at build time — it's not a runtime visibility toggle

**`when` vs `visibleWhen`:** `when` removes the component from the document entirely. `visibleWhen` keeps it in the DOM but toggles CSS visibility at runtime. Use `when` for composition-time decisions, `visibleWhen` for runtime UI state.

**Watch:** `when` conditions use feature flag variables — the metrics component stays, but the table is removed because `showTable` is `"false"`.
