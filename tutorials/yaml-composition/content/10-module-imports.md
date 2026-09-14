# Multiple Imports

A module becomes powerful when you import it multiple times with different parameters. Each import produces a separate set of section entries, prefixed by its alias.

```yaml
imports:
  - module: dashboard-page
    as: sales
    parameters: {label: Sales, dataset: sales-data}
  - module: dashboard-page
    as: ops
    parameters: {label: Ops, dataset: ops-data}
```

This produces `sales.page` and `ops.page` in the pages section — two distinct pages generated from the same template, each with its own label and dataset.

**Alias as namespace:** The alias serves as a namespace prefix for all section entries. `sales.page` and `ops.page` never collide because their aliases are different. You can import the same module as many times as you need — just give each import a unique alias.

**Watch:** A second import of the same module with `as: ops` produces a separate dashboard alongside the first.
