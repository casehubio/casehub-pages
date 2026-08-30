# Scenario YAML Structure

Every scenario starts with a `scenario` name and a list of `steps`:

```yaml
scenario: new-team-member
steps:
  - fill:
      role: textbox
      name: "Full Name"
      value: "Alice Chen"
  - click:
      role: button
      name: "Submit"
```

**`scenario`** — a unique name identifying this automation.

**`steps`** — an ordered list of commands to execute. Each step declares an ARIA command (`fill`, `select`, `click`) and a target (`role` + `name`).

The YAML viewer fly-out (click the `{ }` button) shows you the scenario source with the current step highlighted as execution progresses.

In this tutorial, we use the **sectioned format** — steps are grouped into labeled sections with narrative content. This is the same engine; the section structure just adds navigation points.
