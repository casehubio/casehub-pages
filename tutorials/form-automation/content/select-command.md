# ARIA Commands: select

The `select` command chooses a value from a dropdown menu. It targets the dropdown by its ARIA `role` and `name`, then sets the selected option.

```yaml
- select:
    role: listbox
    name: "Department"
    value: "Engineering"
```

**How it works:**

1. The executor finds the `<select>` element with `role="listbox"` and `aria-label="Department"`
2. It sets the value to "Engineering" and dispatches a `change` event
3. The dropdown updates to show the selected option

**Watch now:** Press **Step** (⏩) to select "Engineering" from the Department dropdown, then fill in the Role field.

Note how `select` and `fill` use the same targeting pattern — `{role, name}`. The command determines what action is taken; the target determines which element receives it.
