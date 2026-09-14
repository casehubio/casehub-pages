# Composition

The real power of yaml-core emerges when you combine variables, modules, and parameterization in a single document. Variables centralize configuration. Modules encapsulate reusable patterns. Parameters wire them together.

```yaml
variables:
  config:
    team: Engineering
imports:
  - module: header
    as: top
    parameters:
      title: ${config.team} Portal
  - module: data-panel
    as: stats
    parameters:
      label: ${config.team}
      dataset: team-metrics
```

**Composition patterns:**
- **Variables flow into imports** — `${config.team}` is resolved before module expansion, so the parameter value becomes `Engineering Portal`
- **Multiple modules contribute to the same section** — both header and data-panel add entries to `pages`
- **Single point of change** — updating `team: Engineering` to `team: Design` updates the header title, panel label, and all content

**Watch:** Variables, a header module, and a data-panel module combine — the team variable flows through import parameters into both modules.
