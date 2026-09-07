---
id: PP-20260907-47c747
title: "YAML properties must be declared in the component's TypeScript interface"
type: rule
scope: platform
applies_to: "all component types in ComponentTypeRegistry — displayer-desugar and component-desugar paths"
severity: critical
refs:
  - packages/pages-ui/src/parser/displayer-desugar.ts
  - packages/pages-schema/scripts/generate-schemas.ts
violation_hint: "A YAML property works in the live preview but silently disappears after a schema regeneration — the property is not in the TypeScript interface."
created: 2026-09-07
---

Every property that a component accepts through YAML must be declared in its TypeScript interface (in `pages-component/src/model/`). The schema-aware property filter in `displayer-desugar.ts` checks each raw YAML key against the generated Zod schema's shape — only declared properties pass through. Undeclared properties are silently dropped, not passed to the component. This replaces the previous blind passthrough that forwarded arbitrary YAML keys.
