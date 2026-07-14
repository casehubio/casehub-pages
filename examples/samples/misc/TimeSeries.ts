import { page, bind, restSource, timeseries, lookup} from "@casehubio/pages-ui";

import type { DataSetId } from "@casehubio/pages-data";

// TypeScript companion to "TimeSeries.dash.yaml"
// Simple timeseries example

const timeseriesDs = bind("timeseries", restSource("data/sample_timeseries.json", {}));

export default page(
  {},
  {},
  [
    timeseries({
      lookup: lookup("timeseries" as DataSetId, ),
      chart: { resizable: true },
    })
  ],
  { datasets: [timeseriesDs] });
