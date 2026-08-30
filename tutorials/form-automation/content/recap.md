# Recap

You've learned the fundamentals of form automation:

**Commands covered:**
- `fill` — type a value into a text field by `{role: textbox, name: "..."}`
- `select` — choose a dropdown option by `{role: listbox, name: "..."}`
- `click` — trigger a button by `{role: button, name: "..."}`

**Key concepts:**
- ARIA targeting: every command uses `{role, name}` to find its target element
- The scenario engine executes steps in order, with visual feedback
- The controller UI provides outline navigation, transport controls, and speed adjustment
- Scenarios work in both server mode and browser-only mode

**What's next:**

In the next tutorial, you'll learn about **parameterized scripts** — declaring typed parameters with defaults and using variable resolution to make scenarios reusable.
