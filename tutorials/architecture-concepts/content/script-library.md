# Script Library

The script library is a browsable catalog of reusable scenario scripts, aggregated from three source types.

<svg viewBox="0 0 420 180" xmlns="http://www.w3.org/2000/svg" style="width: 100%; max-width: 420px;">
  <rect x="20" y="20" width="100" height="45" rx="6" fill="var(--pages-neutral-3, #f5f5f5)" stroke="var(--pages-neutral-6, #ccc)" stroke-width="1.5"/>
  <text x="70" y="40" text-anchor="middle" fill="var(--pages-neutral-12, #1a1a1a)" font-size="11" font-family="system-ui">Bundled</text>
  <text x="70" y="55" text-anchor="middle" fill="var(--pages-neutral-8, #999)" font-size="9" font-family="system-ui">classpath</text>

  <rect x="160" y="20" width="100" height="45" rx="6" fill="var(--pages-neutral-3, #f5f5f5)" stroke="var(--pages-neutral-6, #ccc)" stroke-width="1.5"/>
  <text x="210" y="40" text-anchor="middle" fill="var(--pages-neutral-12, #1a1a1a)" font-size="11" font-family="system-ui">Uploaded</text>
  <text x="210" y="55" text-anchor="middle" fill="var(--pages-neutral-8, #999)" font-size="9" font-family="system-ui">filesystem</text>

  <rect x="300" y="20" width="100" height="45" rx="6" fill="var(--pages-neutral-3, #f5f5f5)" stroke="var(--pages-neutral-6, #ccc)" stroke-width="1.5"/>
  <text x="350" y="40" text-anchor="middle" fill="var(--pages-neutral-12, #1a1a1a)" font-size="11" font-family="system-ui">External</text>
  <text x="350" y="55" text-anchor="middle" fill="var(--pages-neutral-8, #999)" font-size="9" font-family="system-ui">registry URL</text>

  <line x1="70" y1="65" x2="210" y2="100" stroke="var(--pages-accent-7, #6366f1)" stroke-width="1.5"/>
  <line x1="210" y1="65" x2="210" y2="100" stroke="var(--pages-accent-7, #6366f1)" stroke-width="1.5"/>
  <line x1="350" y1="65" x2="210" y2="100" stroke="var(--pages-accent-7, #6366f1)" stroke-width="1.5"/>

  <rect x="130" y="100" width="160" height="50" rx="8" fill="var(--pages-accent-3, #e8eaf6)" stroke="var(--pages-accent-7, #6366f1)" stroke-width="2"/>
  <text x="210" y="122" text-anchor="middle" fill="var(--pages-neutral-12, #1a1a1a)" font-size="12" font-family="system-ui" font-weight="600">ScriptRegistry</text>
  <text x="210" y="140" text-anchor="middle" fill="var(--pages-neutral-8, #999)" font-size="10" font-family="system-ui">unified catalog</text>
</svg>

**Source types:**

- **Bundled** — scripts packaged with the application on the classpath (`META-INF/scenarios/*.yaml`). Read-only.
- **Uploaded** — scripts uploaded via the UI or API, stored on the server filesystem. Read-write.
- **External** — scripts from remote registries via JSON manifest URLs. Read-only.

**Script metadata:**

Each script has a **descriptor** with:
- `name` and `description`
- **Labels** — typed categorization: `domain:hr`, `capability:onboarding`
- **Tags** — free-form: `getting-started`, `team-setup`
- **Params** — typed parameter declarations with defaults and enums
- **Calls** — scripts this one invokes (for dependency visualization)

**Library browser:**

The `<pages-library-view>` component provides search, label filtering, and readiness probes — checking if each script can run on the current page by testing whether its first-step ARIA targets exist in the DOM.
