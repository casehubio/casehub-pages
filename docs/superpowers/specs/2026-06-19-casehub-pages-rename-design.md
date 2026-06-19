# casehub-pages Rename and Ecosystem Integration

**Date:** 2026-06-19
**Status:** Approved
**Tracks:** #24

## Overview

Rename melviz to casehub-pages and integrate as a foundational module in the CaseHub ecosystem. This completes the journey from dashbuilder (full GWT) → melviz (modernisation fork) → casehub-pages (100% TypeScript, near dashbuilder feature parity).

## Identity

- **Artifact name:** casehub-pages
- **GitHub blessed:** casehubio/casehub-pages
- **GitHub fork:** mdproctor/casehub-pages
- **Layer:** Foundation
- **Consumers:** claudony, drafthouse, devtown, life, aml (current targets)

## Package Rename

Every `melviz` and `dashbuilder` reference in active code is purged. Legacy Java core stays as-is for reference — no rename, no build. Audit and remove later.

| Current Package | Current Folder | New Package | New Folder |
|----------------|----------------|-------------|------------|
| `@casehub/component` | `packages/casehub-component` | `@casehub/pages-component` | `packages/pages-component` |
| `@casehub/data` | `packages/casehub-runtime` | `@casehub/pages-data` | `packages/pages-data` |
| `@casehub/ui` | `packages/casehub-ui` | `@casehub/pages-ui` | `packages/pages-ui` |
| `@casehub/viz` | `packages/casehub-viz` | `@casehub/pages-viz` | `packages/pages-viz` |
| `@melviz/component-api` | `packages/melviz-component-api` | `@casehub/pages-api` | `packages/pages-api` |
| `@melviz/component-dev` | `packages/melviz-component-dev` | `@casehub/pages-dev` | `packages/pages-dev` |
| `@melviz/webpack-base` | `packages/webpack-base` | `@casehub/pages-webpack-base` | `packages/pages-webpack-base` |
| `@melviz/tsconfig` | `packages/tsconfig` | `@casehub/pages-tsconfig` | `packages/pages-tsconfig` |
| `melviz-component-echarts` | `components/melviz-component-echarts` | `@casehub/pages-echarts` | `components/pages-echarts` |
| `melviz-component-echarts-base` | `components/melviz-component-echarts-base` | `@casehub/pages-echarts-base` | `components/pages-echarts-base` |
| `melviz-component-llm-prompter` | `components/melviz-component-llm-prompter` | `@casehub/pages-llm-prompter` | `components/pages-llm-prompter` |
| `melviz-component-svg-heatmap` | `components/melviz-component-svg-heatmap` | `@casehub/pages-svg-heatmap` | `components/pages-svg-heatmap` |
| `@melviz/webapp` | `webapp/` | `@casehub/pages-webapp` | `webapp/` |
| `@melviz/examples` | `examples/` | `@casehub/pages-examples` | `examples/` |
| Root: `melviz` | — | `casehub-pages` | — |

## Directory Moves

**Project repo:**
`/Users/mdproctor/claude/melviz/` → `/Users/mdproctor/claude/casehub/pages/`

**Workspace repo:**
`/Users/mdproctor/claude/public/melviz/` → `/Users/mdproctor/claude/public/casehub/pages/`

**Git remotes after move:**
- `origin` → `casehubio/casehub-pages`
- `fork` → `mdproctor/casehub-pages`

**Build graph position:**
```
pages (no casehub deps — independent foundation)
  ↓ consumed by
  ├── claudony
  ├── drafthouse
  ├── devtown
  ├── life
  └── aml
```

## GitHub Repo Creation (History Preserved)

1. Create empty `casehubio/casehub-pages` on GitHub (no README, no template, rebase-merge-only)
2. Add as remote on existing local repo: `git remote add casehub <url>`
3. Push full history: `git push casehub main --tags` — all commits preserved
4. Do the rename work as new commits on top of the existing history
5. Fork from `casehubio/casehub-pages` to `mdproctor/casehub-pages`
6. Old repos (`melviz-org/melviz`, `mdproctor/melviz`) left as-is

## Ecosystem Integration (casehub-parent)

### Applies — needs pages entries

| File | What to add |
|------|-------------|
| `build-all.sh` | `REPO_DIR[pages]="../pages"`, `REPO_GH[pages]="casehub-pages"`, build via `yarn build`, no upstream DEPS |
| `full-stack-build.yml` | Clone step, yarn build step, build timing, module list, outcome tracking |
| `incremental-full-stack-build.yml` | Clone, SHA calc, cache key, yarn build, dependency chaining to claudony/drafthouse |
| `dashboard.yml` | Add `casehubio/casehub-pages` to REPOS list |
| `pr-dashboard.yml` | Add `casehubio/casehub-pages` to REPOS list |
| `docs/index.html` | Add `'casehub-pages'` to PLATFORM_REPOS array |
| `README.md` | Badge row, module table entry, dependency matrix |
| `docs/PLATFORM.md` | Foundation tier entry, capability ownership (YAML dashboard rendering, component API, data binding, forms) |
| `CLAUDE.md` | Add `pages` to core repos list |

### Skipped — not applicable

| File | Why |
|------|-----|
| `pom.xml` (BOM) | No Maven artifacts |
| `aggregator.xml` | Not a Maven module |
| `publish.yml` dispatch loop | No casehub upstream deps |
| Flyway version range | No database |
| `.claude/settings.local.json` sed hooks | No legacy rename fixups |

### casehub-all

- `.gitmodules`: `[submodule "pages"]` → `https://github.com/casehubio/casehub-pages.git`
- `CLAUDE.md` table: `| pages/ | casehubio/casehub-pages | YAML dashboard rendering, component API, forms |`

## Claude Memory and IntelliJ

**Claude project directories (rename):**
- `~/.claude/projects/-Users-mdproctor-claude-melviz/` → `-Users-mdproctor-claude-casehub-pages/`
- `~/.claude/projects/-Users-mdproctor-claude-public-melviz/` → `-Users-mdproctor-claude-public-casehub-pages/`

**CLAUDE.md files to rewrite:**
- Project CLAUDE.md — new paths, package names, build commands
- Workspace CLAUDE.md — update all path references

**IntelliJ recent projects:**
- `~/Library/Application Support/JetBrains/IntelliJIdea*/options/recentProjects.xml` — update path entry
- Or: open from new location, let IntelliJ add it; old entry goes stale

**Cross-project memory scan:**
- Check memory files in both project dirs for hardcoded melviz paths
- Check other workspace memories that might reference melviz

## README Lineage

> **History:** casehub-pages descends from [dashbuilder](https://github.com/kiegroup/kie-tools), a full GWT dashboard authoring platform. The melviz fork modernised the frontend, progressively replacing GWT with TypeScript Web Components. casehub-pages completes that journey — 100% TypeScript, near feature parity with dashbuilder, and designed as a foundational building block for the CaseHub platform.

## Issue Migration

- #24 on `mdproctor/melviz` tracks this work
- After move, new issues go to `mdproctor/casehub-pages`
- Existing open issues on `mdproctor/melviz` — close with pointer to new repo, or leave as historical
