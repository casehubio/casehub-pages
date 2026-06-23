# Quinoa Convention: Quarkus + TypeScript Frontend

## Why Quinoa

- Single `mvn quarkus:dev` hot-reloads both Java and TypeScript
- Single `mvn package` produces one JAR with frontend included
- No Node.js at runtime — Quinoa runs `npm build` at compile time
- TypeScript type checking catches component composition errors at build time

## Why esbuild (not webpack)

The casehub-pages monorepo uses webpack internally for its multi-package build with loaders, polyfills, and dev-server integration. Host apps use esbuild because they have a single entry point and no internal package dependencies to resolve — esbuild handles this in a few lines of config with sub-second builds.

## Prerequisites

1. GitHub token with `read:packages` scope for GitHub Packages access
2. Quarkus Quinoa extension in host app `pom.xml`

## Setup

### 1. Add Quinoa extension

```xml
<dependency>
  <groupId>io.quarkiverse.quinoa</groupId>
  <artifactId>quarkus-quinoa</artifactId>
</dependency>
```

### 2. Copy the reference template

Copy `templates/quinoa-host/` contents to `src/main/webui/` in your host app.

### 3. Configure Quinoa

Add to `application.properties`:

```properties
quarkus.quinoa.build-dir=dist
quarkus.quinoa.package-manager-install=true
```

### 4. Install and build

```bash
cd src/main/webui
npm install
npm run build
```

Or via Maven: `mvn quarkus:dev` (Quinoa runs the build automatically).

## Dependencies

**Required (every host app):**
- `@casehubio/pages-runtime` — `loadSite()` entry point; transitively provides pages-viz (chart/table Web Components), pages-component (layout), pages-data (datasets)
- `@casehubio/pages-ui` — TypeScript DSL for composing pages (page, table, barChart, dataset, lookup, etc.)

**Optional (iframe-isolated components):**
- `@casehubio/pages-component-llm-prompter` — LLM prompt engineering UI
- `@casehubio/pages-component-svg-heatmap` — SVG-based heatmaps

## Adding Iframe Components

1. Add the component package to `package.json` dependencies
2. Create `scripts/copy-components.mjs` (copies built bundles from node_modules to dist):

```js
import { cpSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { createRequire } from "module";
import { readFileSync } from "fs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const require = createRequire(import.meta.url);

const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf-8"));

const deps = Object.keys(pkg.dependencies || {});
for (const dep of deps) {
  const match = dep.match(/^@casehubio\/pages-component-(.+)$/);
  if (!match) continue;

  const name = match[1];
  const depDir = dirname(require.resolve(dep + "/package.json"));
  const src = join(depDir, "dist");
  const dest = join(root, "dist", "pages", "component", name);

  if (existsSync(src)) {
    cpSync(src, dest, { recursive: true });
    console.log(`Copied ${dep} → dist/pages/component/${name}/`);
  }
}
```

3. Update the build script: `"build": "node esbuild.config.mjs && node scripts/copy-components.mjs"`

## Migration Path (Existing Hosts)

For hosts with existing JS/HTML in `META-INF/resources/`:

1. Move static files to `src/main/webui/src/`
2. Add `package.json` with casehub-pages dependencies
3. Convert JavaScript to TypeScript incrementally
4. Add Quinoa extension to `pom.xml`
5. Remove manual static file serving (e.g., UiResource.java)

## Applies To

- casehub-claudony
- casehub-devtown
- casehub-drafthouse (Electron + embedded Quarkus native)
- Any future Quarkus app composing UI with casehub-pages
