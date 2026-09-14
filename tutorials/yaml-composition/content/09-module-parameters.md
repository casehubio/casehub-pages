# Module Parameters

Module parameters are typed and can have constraints. This catches errors early — before expansion — rather than producing silently wrong output.

```yaml
parameters:
  title:
    type: STRING
    required: true
  subtitle:
    type: STRING
    required: false
    defaultValue: Overview
  port:
    type: INTEGER
    required: true
    minimum: 1024
    maximum: 65535
```

**Parameter types:** `STRING`, `INTEGER`, `NUMBER`, `BOOLEAN`, `LIST`

**Constraints:** `defaultValue`, `minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, `allowedValues`

When `required: false` and `defaultValue` is set, the import can omit the parameter — the default kicks in. This lets modules define sensible defaults that consumers override only when needed.

**Watch:** A second parameter with `defaultValue: Overview` is added — the import omits it, so the default kicks in.
