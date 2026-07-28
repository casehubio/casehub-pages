---
id: PP-20260728-3676e1
title: "Build scripts for Maven-only outputs must be separate from the default build script"
type: rule
scope: repo
applies_to: "all package.json scripts in packages/ and components/ that produce dist/ outputs"
severity: important
refs: []
violation_hint: "A build:* script merged into the default build script causes its output to appear in casehub-pages-npm via pack-all.sh"
created: 2026-07-28
---

Build scripts that produce outputs exclusively for Maven artifact packaging
(`build:tokens`, `build:bundle`) must not be merged into the default `build`
script. `pack-all.sh` packs all of `dist/` for every non-private workspace
package into `casehub-pages-npm`. Any file present in `dist/` after `yarn build`
will be included in the npm artifact. Static-asset-only outputs are generated
by `assembly.sh` at Maven build time, not during `yarn build`.
