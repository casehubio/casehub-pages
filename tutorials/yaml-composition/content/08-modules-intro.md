# Modules

When you have the same pattern repeated across multiple pages — same component types, same layout, different data — modules let you define the pattern once and reuse it.

```yaml
modules:
  dashboard:
    parameters:
      label: {type: STRING, required: true}
    sections:
      pages:
        view:
          name: ${params.label} Dashboard
imports:
  - module: dashboard
    as: sales
    parameters: {label: Sales}
pages: {}
```

**How modules work:**
- `modules` defines reusable templates with typed parameters
- `sections` declares what the module contributes to each top-level section (pages, datasets, etc.)
- `imports` instantiates modules with specific parameter values
- `as` provides a unique alias — section keys are prefixed with it (e.g. `sales.view`)
- `${params.label}` references the parameter value inside the module

**Format note:** Module sections use map-format pages (keyed by name) rather than array format. The target section (`pages: {}`) must also be a map. After expansion, each module entry appears with its alias prefix: `sales.view`, `ops.view`.

**Watch:** The repeated dashboard pattern is extracted into a module, then imported twice with different parameters.
