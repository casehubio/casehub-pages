# Module Outputs

Modules can expose outputs — computed values that other imports can reference. This enables cross-module wiring without hardcoding IDs.

```yaml
modules:
  data-source:
    parameters:
      name: {type: STRING, required: true}
    outputs:
      id:
        type: STRING
        value: ${var.name}-dataset
```

**How outputs work:**
- `outputs` declares named values the module exposes after expansion
- `value` is a template resolved against the module's parameters (`${var.name}` references the `name` parameter)
- Other imports reference outputs with `${module.alias.outputName}`

```yaml
imports:
  - module: data-source
    as: sales-src
    parameters: {name: sales}
  - module: viewer
    as: sales-view
    parameters:
      dataset: ${module.sales-src.id}
```

The viewer's `dataset` parameter receives the data source's resolved output. Import order matters — a module can only reference outputs from imports that appear before it.

**Watch:** The `${module.sales-src.id}` reference wires the viewer to the data source's resolved output.
