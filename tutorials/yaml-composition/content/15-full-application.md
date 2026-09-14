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

**Your task:** Build an Operations Center application:
1. Define a variable for the app title
2. Create a `header` module with a title parameter that renders a banner page with a title component
3. Create a `data-panel` module with label and dataset parameters that renders a page with chart and table components
4. Import both modules — pass the app title variable to the header, and provide infrastructure parameters to the data panel

The result should have at least `header.banner` and `infra.panel` in the expanded pages.
