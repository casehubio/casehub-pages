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

**Your task:** Add a `components` list to the page with a single `title` component. Set its `text` property to any value you like.
