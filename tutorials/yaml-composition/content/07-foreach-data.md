# ForEach with Data

Instead of hardcoding values in `in: [...]`, forEach can iterate over structured data. CSV data sources provide typed columns that forEach templates can access.

```yaml
data:
  envs:
    inline: "name:STRING,port:INTEGER\nstaging,8080\nprod,443"
iterations:
  envs:
    as: env
    in: []
```

**How data-driven forEach works:**
- `data` defines named CSV data sources with typed columns
- `iterations` maps a data source to an iteration group with a variable name
- `forEach: envs` references the group by name (instead of inline `{as, in}`)
- `${each.env.name}` and `${each.env.port}` access individual columns per row

Each row becomes one expansion. With two CSV rows, the template produces two components: `deploy-step.staging` and `deploy-step.prod`.

**Your task:** Add a `data` section with an inline CSV defining environments, an `iterations` section that references it, and update the component's forEach to use the named group.
