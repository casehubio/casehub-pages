import { loadSite } from "@casehubio/pages-runtime";
import "@casehubio/pages-primitives";
import "@casehubio/pages-viz";
import type { LiveSite, SiteOptions } from "@casehubio/pages-runtime";
import { applyTheme } from "@casehubio/pages-ui-tokens";

applyTheme('default-light');

export { loadSite, applyTheme };
export type { LiveSite, SiteOptions };
