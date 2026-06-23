import type { DataSetLookup } from "@casehubio/pages-data/dist/dataset/lookup.js";
import type { ColumnSettings } from "@casehubio/pages-data/dist/dataset/types.js";
import type {
  FilterSettings,
  RefreshSettings,
} from "@casehubio/pages-component";

export interface VizComponentProps {
  readonly lookup?: DataSetLookup;
  readonly filter?: FilterSettings;
  readonly refresh?: RefreshSettings;
  readonly columns?: readonly ColumnSettings[];
}
