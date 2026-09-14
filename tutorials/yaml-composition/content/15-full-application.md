# Full Application

You now have all the tools to build a complete, parameterized application from composable parts.

**The building blocks:**
- **Variables** — centralize configuration (`${app.title}`)
- **Modules** — encapsulate reusable patterns with typed parameters (`${params.label}`)
- **Module outputs** — wire modules together with `${module.alias.output}`
- **ForEach** — generate structure from data with `forEach` and `${each.*}`
- **Conditionals** — include or exclude sections with `when`
- **Iteration groups** — coordinate multiple forEach templates over shared data
- **Defaults** — provide fallback values with `${prefix.key:-fallback}`

**Watch:** An Operations Center application is assembled from all the building blocks — variables centralize configuration, modules define reusable patterns, and imports wire them together.
