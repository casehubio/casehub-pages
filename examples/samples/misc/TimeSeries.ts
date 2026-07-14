import { page, bind, restSource, timeseries, lookup } from "@casehubio/pages-ui";

const timeseriesDs = bind("timeseries", restSource("data/sample_timeseries.json", {}));

export default page("TimeSeries",
  timeseries({
    lookup: lookup("timeseries"),
    resizable: true,
  }),
  { datasets: [timeseriesDs] }
);
