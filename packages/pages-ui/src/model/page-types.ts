import type { Component, GridPlacement } from "./types.js";
import type { DataSetId } from "@casehubio/pages-data/dist/dataset/types.js";
import type { ExternalDataSetDef } from "@casehubio/pages-data/dist/dataset/external/types.js";

// Re-export types that moved to pages-component
export type {
  PageProps,
  PageSettings,
  DataComponentDefaults,
  LookupDefaults,
  DataSetDefaults,
  DataScope,
  DataScopeRef,
  SaveConfig,
} from "@casehubio/pages-component";

// Runtime types stay in pages-ui
export interface ViewState {
  readonly currentPage?: string;
  readonly expandedNodes?: readonly string[];
  readonly activeFilters?: Readonly<Record<string, readonly string[]>>;
  readonly drillDownPath?: readonly DrillDownStep[];
  readonly layoutOverrides?: readonly LayoutOverride[];
  readonly collapsedPanels?: readonly string[];
  readonly scrollPositions?: Readonly<Record<string, number>>;
}

export interface DrillDownStep {
  readonly source: string;
  readonly column: string;
  readonly value: string;
  readonly targetPage: string;
}

export interface LayoutOverride {
  readonly componentId: string;
  readonly placement: GridPlacement;
}

export interface DeepLink {
  readonly page: string;
  readonly parameters?: Readonly<Record<string, string>>;
  readonly filters?: Readonly<Record<string, readonly string[]>>;
  readonly drillDown?: readonly DrillDownStep[];
  readonly sort?: { readonly column: string; readonly order: "ASC" | "DESC" };
}

export interface Site {
  readonly root: Component;
  page(path: string): Component | null;
  dataset(id: DataSetId, fromPage?: string): ExternalDataSetDef | null;
  readonly state: ViewState;
}
