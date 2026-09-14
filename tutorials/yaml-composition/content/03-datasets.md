# Datasets

Components that display data need a data source. The `datasets` section defines named data sources that components can reference.

```yaml
datasets:
  sales:
    type: rest
    url: /api/sales
pages:
  - name: Dashboard
    components:
      - type: bar-chart
        properties:
          dataset: sales
```

The chart references `sales` by name — it doesn't need to know the URL or data format. Multiple components can share the same dataset.

**Watch:** A `datasets` section defines a named data source, then `dataset` properties wire the chart and table to it.
