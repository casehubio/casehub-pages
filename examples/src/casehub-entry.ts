import { loadSite } from "@casehubio/pages-runtime";
import "@casehubio/pages-primitives";
import "@casehubio/pages-ui-components/input";
import "@casehubio/pages-ui-components/select";
import "@casehubio/pages-ui-components/textarea";
import "@casehubio/pages-ui-components/checkbox";
import "@casehubio/pages-ui-components/button";
import "@casehubio/pages-ui-components/badge";
import "@casehubio/pages-ui-components/status-dot";
import "@casehubio/pages-viz";
import type { LiveSite, SiteOptions } from "@casehubio/pages-runtime";
import { applyTheme, getTheme } from "@casehubio/pages-ui-tokens";

applyTheme('casehub-dark');

export { loadSite, applyTheme, getTheme };
export type { LiveSite, SiteOptions };

export { createZoneLayoutEngine } from "@casehubio/pages-runtime";
export { dockWorkbench, html, rows, split, columns, withId, dockBar, deferred, withStyle, hostPanel } from "@casehubio/pages-ui/dist/dsl/builders.js";
export type { DockWorkbenchConfig, DockPanelConfig, DockSideConfig } from "@casehubio/pages-ui/dist/dsl/builders.js";
