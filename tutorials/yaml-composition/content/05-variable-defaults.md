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

**Watch:** A variable reference uses `:-` default syntax — since `app.subtitle` is not defined, the fallback value appears.
