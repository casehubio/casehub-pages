import { loadSite } from "@casehubio/pages-runtime";
import "@casehubio/pages-primitives";
import "@casehubio/pages-viz";
import { applyTheme } from "@casehubio/pages-ui-tokens";
import { createZoneLayoutEngine } from "@casehubio/pages-runtime";
import { dockWorkbench, html, rows, split, columns, withId, dockBar, deferred, withStyle, hostPanel } from "@casehubio/pages-ui/dist/dsl/builders.js";

applyTheme('casehub-dark');

export { loadSite, applyTheme, createZoneLayoutEngine, dockWorkbench, html };
