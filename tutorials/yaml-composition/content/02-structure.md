# Multi-Component Pages

Pages become useful when they combine multiple components. A dashboard typically has a title, one or more charts, and a data table.

```yaml
components:
  - type: title
    properties:
      text: Sales Overview
  - type: bar-chart
    properties:
      title: Revenue by Region
  - type: data-table
    properties:
      title: Transaction Log
```

Components render in order — the title appears first, then the chart, then the table. Each component type has its own set of properties.

**Your task:** Add a `bar-chart` and a `data-table` component after the existing title.
