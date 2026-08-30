# ARIA Commands: click

The `click` command triggers a button or interactive element. The simplest command — just a target, no value.

```yaml
- click:
    role: button
    name: "Submit"
```

**How it works:**

1. The executor finds the element with `role="button"` and `aria-label="Submit"`
2. It calls `.click()` on the element
3. The application responds to the click event (form submission, navigation, state change)

**Watch now:** Press **Step** (⏩) to click the Submit button. The form will show a success message.

With `fill`, `select`, and `click`, you can automate any form-based workflow. These three commands cover the majority of browser interactions — typing into fields, choosing from dropdowns, and pressing buttons.
