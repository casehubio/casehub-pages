# Quinoa Convention Design

**Issue:** casehubio/casehub-pages#26
**Date:** 2026-06-23
**Status:** Approved (revised)
**Prerequisite:** #28 (remove redundant iframe ECharts component)

## Problem

Quarkus host applications (claudony, devtown, drafthouse) need to compose UI with casehub-pages. Today the packages are workspace-only at version 0.0.1, unpublished, and there is no documented integration pattern. Each host that wants to use casehub-pages components would have to figure out the build tooling, registry access, and iframe component wiring independently.

## Decision

Establish Quarkus Quinoa as the standard frontend integration for all Quarkus host apps consuming casehub-pages. Publish all packages to GitHub Packages. Provide a reference template that host apps can copy.

## Approach

Granular npm packages — each host app declares its own dependencies and assembles its build output. No aggregation package, no shared esbuild config package.

## Design

### 0. Scope Rename: `@casehub` → `@casehubio`

GitHub Packages requires the npm scope to match the GitHub organization name exactly. The org is `casehubio`, so packages must use the `@casehubio` scope. The current `@casehub` scope cannot be published to GitHub Packages under the `casehubio` org — client-side `.npmrc` scope mapping only controls which registry the npm client talks to, it does not override the server-side ownership check.

**Action:** Rename all `@casehubio/pages-*` packages to `@casehubio/pages-*`. This touches every `package.json` name field, every `import` statement, every `workspace:*` cross-reference, and every test file. The migration is mechanical — IntelliJ "Replace in Files" (not rename refactoring, which is symbol-based).

**Future:** If the GitHub org is renamed from `casehubio` to `casehuborg`, packages can be republished under `@casehuborg` scope. This is a separate decision that affects all repos and CI.

### 1. Version Bump

All publishable `@casehubio/pages-*` packages move from `0.0.1`/`0.0.0` to `0.2.0`, aligning with the casehub 0.2 release line. Use `scripts/bump-version.mjs` (already committed) — it skips `private: true` packages automatically.

**Publishable packages (bumped to 0.2.0):**
- pages-data, pages-ui, pages-viz, pages-component, pages-runtime, pages-iframe-api
- pages-component-llm-prompter, pages-component-svg-heatmap (after removing `private: true`)

**Not published (stay private):**
- pages-tsconfig — shared tsconfig, monorepo-internal only (`private: true`)
- pages-webpack-base — webpack config, monorepo-internal only (`private: true`)
- pages-iframe-dev — iframe dev tools, monorepo-internal only (add `private: true`)
- pages-component-echarts — deleted by #28
- pages-echarts-base — deleted by #28

Cross-references within the monorepo remain `workspace:*`. Yarn replaces these with `0.2.0` at publish time.

`webapp` and `examples` stay at `0.0.0` — they are `"private": true` and never published.

### 2. Package.json Requirements for Publishing

Every publishable package needs these fields:

**`repository`** — links the package to the GitHub repo (required by GitHub Packages):
```json
"repository": {
  "type": "git",
  "url": "https://github.com/casehubio/casehub-pages.git"
}
```

**`publishConfig`** — targets GitHub Packages instead of npmjs.com:
```json
"publishConfig": {
  "registry": "https://npm.pkg.github.com"
}
```

**`files`** — required for iframe component packages. The root `.gitignore` excludes `dist/`, and npm uses `.gitignore` as a fallback when no `files` field is present. Without `"files": ["dist"]`, published packages would not contain their built bundles, and `copy-components.mjs` would find empty directories.

**`sideEffects`** — required for `pages-viz`. Add `"sideEffects": true` so bundlers preserve the bare import that registers Web Component custom elements. This is an internal concern between pages-runtime and pages-viz (see Section 4) — host app developers do not need to know about it.

Currently missing `repository` from: pages-data, pages-ui, pages-viz, pages-component, pages-runtime, pages-iframe-api. The iframe component packages already have `repository`. All publishable packages need `publishConfig`. Iframe component packages need `"files": ["dist"]`.

### 3. GitHub Packages CI Workflow

**CI workflow:** GitHub Actions on push to `main`:
1. Checkout, Node 22, Yarn 4
2. `yarn install && yarn build` (full build including components and webapp)
3. Configure `.npmrc` with `GITHUB_TOKEN`
4. Publish each non-private package — skip if version already exists in registry

**Auth model:**
- Publishing: `GITHUB_TOKEN` (automatic in Actions)
- Consuming: personal access token with `read:packages` scope, configured in host app `.npmrc`

**No version automation.** Versions are bumped manually via `scripts/bump-version.mjs`. The workflow publishes whatever version is in `package.json` and skips if already published.

### 4. Quinoa Host App Convention

**Pattern:** Quarkus host app adds the Quinoa extension + a `src/main/webui/` directory. Quinoa runs `npm run build` during `mvn package` and serves output from `META-INF/resources/`. During `mvn quarkus:dev`, Quinoa re-runs `npm run build` on file changes — esbuild's ~50ms rebuild time makes this effectively instant.

**Why esbuild, not webpack:** The monorepo uses webpack for its complex multi-package build with loaders, polyfills, and dev-server integration. Host apps have a single entry point and no internal package dependencies to resolve — esbuild handles this in a few lines of config with sub-second builds.

#### Custom element registration: pages-runtime owns the side effect

`pages-viz` registers Web Component custom elements (`casehub-bar-chart`, `casehub-table`, etc.) via `customElements.define()` calls at module scope in each component file. Without registration, `loadSite()` renders layout containers but no charts, tables, or metrics — a silent failure with no error.

`pages-runtime` already declares `pages-viz` as a dependency and imports from it (deep imports for `cellToRaw`, type imports for `CasehubElement`). But it does not currently trigger the side-effect registration. **Fix:** Add `import "@casehubio/pages-viz"` to `pages-runtime/src/index.ts`. This makes custom element registration an internal concern of `pages-runtime` — consumers get a working `loadSite()` without needing to know about the internal package structure.

`pages-viz/package.json` must declare `"sideEffects": true` so bundlers preserve this bare import. This is an internal concern between pages-runtime and pages-viz, invisible to host app developers.

#### Base template (no iframe components)

```
src/main/webui/
├── package.json
├── tsconfig.json
├── esbuild.config.mjs
├── .npmrc
├── src/
│   └── index.ts
└── dist/                    (gitignored)
    └── app.js
```

**package.json dependencies (core — every host app):**
- `@casehubio/pages-runtime` — `loadSite()` entry point (transitively pulls in pages-viz, pages-component, pages-data)
- `@casehubio/pages-ui` — DSL functions (page, table, barChart, etc.) for TypeScript page composition

`pages-viz` is no longer a direct dependency — pages-runtime owns the side-effect import internally. `pages-ui` remains a direct dependency because host apps import DSL functions from it.

**Build scripts:**
- `"build": "node esbuild.config.mjs"` — called by Quinoa (both `mvn package` and `quarkus:dev` file-change rebuilds)
- `"dev": "node esbuild.config.mjs --watch"` — standalone frontend development without Quarkus
- `"typecheck": "tsc --noEmit"` — separate, not part of build

**esbuild config:** Bundle `src/index.ts` → `dist/app.js`. Format ESM, target ES2020, minify in production. The `--watch` flag is for standalone use only; Quinoa handles rebuild triggering in dev mode.

**Template `src/index.ts`:**
```ts
import { loadSite } from "@casehubio/pages-runtime";
import { page, table, barChart, dataset } from "@casehubio/pages-ui";

// ... define pages, call loadSite()
```

#### Adding iframe components (opt-in)

Host apps that need iframe-isolated components (LLM prompter, SVG heatmap) add them as dependencies and include a copy script:

```
src/main/webui/
├── ...base template...
├── scripts/
│   └── copy-components.mjs
└── dist/
    ├── app.js
    └── pages/component/
        ├── llm-prompter/
        └── svg-heatmap/
```

**Additional dependencies (opt-in):**
- `@casehubio/pages-component-llm-prompter`
- `@casehubio/pages-component-svg-heatmap`

**Build script becomes:** `"build": "node esbuild.config.mjs && node scripts/copy-components.mjs"`

**copy-components.mjs:** For each `@casehubio/pages-component-*` in dependencies, copies `node_modules/@casehubio/pages-component-*/dist/` → `dist/pages/component/*/`. Mirrors the path convention from `webapp/webpack.config.js`.

**Note on ECharts:** Pre-#28, hosts using both `pages-viz` (which bundles ECharts for inline Web Components) and the iframe ECharts component would load ECharts twice. #28 eliminates this by removing the redundant iframe ECharts component — `pages-viz` inline Web Components are the single ECharts integration point.

#### Consumer .npmrc

```
@casehubio:registry=https://npm.pkg.github.com
//npm.pkg.github.com/:_authToken=${GITHUB_TOKEN}
```

#### Quinoa configuration

```properties
quarkus.quinoa.build-dir=dist
quarkus.quinoa.package-manager-install=true
```

No additional dev-mode configuration needed. Quinoa's default behavior re-runs `npm run build` on file changes, and esbuild's ~50ms rebuild time makes this effectively instant.

### 5. Convention Doc and Template

**Convention doc:** `docs/quinoa-convention.md` — rationale (including esbuild vs webpack choice), prerequisites, step-by-step setup, adding iframe components (opt-in section), migration path for existing hosts, applies-to list.

**Reference template:** `templates/quinoa-host/` — copy-pasteable files for the base template:
- `package.json`, `tsconfig.json`, `esbuild.config.mjs`, `.npmrc`
- `src/index.ts` — minimal working example with `loadSite()`

Iframe component files (`scripts/copy-components.mjs`, expanded `package.json`) documented in the convention doc's opt-in section rather than included in the base template.

**Applies to:** claudony, devtown, drafthouse, any future Quarkus host consuming casehub-pages.

**ARC42STORIES update:** §7 (Deployment View) and §9 (Backlog) need updating to reflect the Quinoa convention and published packages.

### 6. Scope Boundary

**In scope:**
- Scope rename `@casehub` → `@casehubio` across entire monorepo
- pages-runtime: add `import "@casehubio/pages-viz"` to entry point
- Package.json fields: `repository`, `publishConfig`, `sideEffects`, `files`, `private` flag fixes
- Version bump to 0.2.0
- GitHub Actions publish workflow
- Convention doc with esbuild/webpack rationale and opt-in iframe section
- Reference template (base, no iframe components)

**Prerequisite (execute first or same branch):**
- #28 — Remove redundant iframe ECharts component

**Out of scope (separate issues):**
- Migrating claudony, devtown, or drafthouse (per-host issues)
- npm registry publishing (GitHub Packages only)
- Version automation or changelogs
- GitHub org rename `casehubio` → `casehuborg`

## Testing

- **Publish dry-run:** `npm publish --dry-run` per publishable package to verify fields, scope, `files` inclusion, and publishable state
- **Consumer install:** fresh project can `npm install @casehubio/pages-runtime` from GitHub Packages after CI publishes
- **Template build:** `node esbuild.config.mjs` produces `dist/app.js` from the template's `src/index.ts`
- **Side-effect verification:** built `dist/app.js` contains `customElements.define` calls (confirms pages-viz side effects were preserved by esbuild through pages-runtime's internal import)
- **Iframe bundle inclusion:** `npm pack` of iframe component packages includes `dist/` directory
- **Iframe path test:** `copy-components.mjs` places bundles in `dist/pages/component/<name>/` with correct directory structure
- **Quinoa smoke test:** `mvn quarkus:dev` with Quinoa serves the built frontend from `META-INF/resources/`
