# ForEach Basics

When you have three identical components that differ only in one value, `forEach` generates them from a template.

**Before** — three repeated components:
```yaml
components:
  cpu-metric:
    type: metric
    properties:
      field: cpu
  memory-metric:
    type: metric
    properties:
      field: memory
```

**After** — one template that generates three:
```yaml
components:
  metric:
    type: metric
    forEach:
      as: field
      in: [cpu, memory, disk]
    properties:
      field: ${each.field}
```

**How forEach works:**
- `as` names the iteration variable
- `in` provides the list of values
- `${each.field}` resolves to the current value during expansion
- The template generates stamped copies: `metric.cpu`, `metric.memory`, `metric.disk`

**Format note:** ForEach requires components in map format (keyed by ID) rather than the array format used in earlier steps. This is because forEach stamps unique IDs on each generated copy.

**Your task:** Replace the three repeated metric components with a single template that uses `forEach`. Name the template `metric` and iterate over `[cpu, memory, disk]`.
