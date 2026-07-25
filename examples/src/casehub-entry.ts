import { loadSite } from "@casehubio/pages-runtime";
import "@casehubio/pages-primitives";
import "@casehubio/pages-viz";
import type { LiveSite, SiteOptions } from "@casehubio/pages-runtime";
import { applyTheme, getTheme } from "@casehubio/pages-ui-tokens";

applyTheme('casehub-dark');

export { loadSite, applyTheme, getTheme };
export type { LiveSite, SiteOptions };
