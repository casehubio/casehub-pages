# ARIA Commands: fill

The `fill` command types a value into a text field. It targets the field by its ARIA `role` and accessible `name`.

```yaml
- fill:
    role: textbox
    name: "Full Name"
    value: "Alice Chen"
```

**How it works:**

1. The browser executor searches the DOM for an element with `role="textbox"` and `aria-label="Full Name"`
2. If found, it sets the element's value and dispatches `input` and `change` events
3. Visual feedback highlights the field with a blue pulse animation

**Watch now:** Press **Step** (⏩) to execute the fill commands. You'll see "Alice Chen" appear in the Full Name field, followed by the email address.

The highlight animation shows exactly which element the engine is targeting — the same element a screen reader would announce as "Full Name, text box."
