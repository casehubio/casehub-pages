# Variable Defaults

Sometimes a variable might not be defined. Instead of failing, you can provide a default value using `:-` syntax:

```yaml
variables:
  app:
    name: Dashboard
pages:
  - name: ${app.name}
    components:
      - type: title
        properties:
          text: ${app.subtitle:-Welcome}
```

`${app.subtitle:-Welcome}` means: use `app.subtitle` if it exists, otherwise use `Welcome`. Since `subtitle` is not defined in `variables`, the default kicks in.

This is useful for optional configuration — modules can define parameters with sensible defaults that consumers can override when needed.

**Your task:** Add a variable reference with a `:-` default value to one of the component properties. Use a variable key that is NOT defined in the variables section — the default should provide the displayed value.
