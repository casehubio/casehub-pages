---
id: PP-20260705-8fcb31
title: "All module versions must align with casehub-parent"
type: rule
scope: repo
applies_to: "all package.json and pom.xml version declarations in casehub-pages"
severity: important
refs: []
violation_hint: "npm package version or Maven module version does not match casehub-parent's major.minor"
created: 2026-07-05
---

npm packages use `<major>.<minor>.0` matching casehub-parent's `<major>.<minor>-SNAPSHOT`
(e.g. parent 0.2-SNAPSHOT → npm 0.2.0, Maven 0.2-SNAPSHOT). When bumping versions,
update all three in lockstep: npm core packages, Maven backend modules, and downstream
consumers that hardcode the version (e.g. connectors/chat-demo `casehub-pages-auth`).
Internal packages at 0.0.0 (root workspace, tsconfig, webpack-base) and components
already at the correct version are excluded.
