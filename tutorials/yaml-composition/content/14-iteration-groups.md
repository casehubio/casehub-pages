# Iteration Groups

When multiple components need to iterate over the same values, named iteration groups avoid repeating the list.

```yaml
iterations:
  regions:
    as: region
    in: [us, eu, ap]
pages:
  - name: Regional Overview
    components:
      chart:
        type: bar-chart
        forEach: regions
        properties:
          title: ${each.region} Sales
      table:
        type: data-table
        forEach: regions
        properties:
          title: ${each.region} Details
```

**How iteration groups work:**
- `iterations` defines named groups with a variable name (`as`) and values (`in`)
- Components reference the group by name: `forEach: regions` (a string, not an object)
- Both components expand over the same three values, producing `chart.us`, `chart.eu`, `chart.ap` and `table.us`, `table.eu`, `table.ap`
- All components using the same group stay coordinated — adding a region to the list expands all of them

**Watch:** Both chart and table components reference `forEach: regions` — they expand over the same values, staying coordinated.
