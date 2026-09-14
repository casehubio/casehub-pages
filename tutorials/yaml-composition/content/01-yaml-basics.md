# YAML Basics

A CaseHub page is defined in YAML. The simplest page has a `pages` list with one entry containing a `name` and `components`.

```yaml
pages:
  - name: My First Page
    components:
      - type: title
        properties:
          text: Hello World
```

**Key structure:**
- `pages` is a list of page definitions
- Each page has a `name` and a `components` list
- Each component has a `type` (e.g. `title`, `bar-chart`, `data-table`) and optional `properties`

**Watch:** The editor builds a page with a `components` list containing a `title` component.
