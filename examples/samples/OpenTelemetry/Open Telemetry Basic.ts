// @ts-nocheck
import { page, bind, restSource, table, selector, bubbleChart, lookup } from "@casehubio/pages-ui";

const tracesDs = bind("traces", restSource("traces.json", {
  expression: `$.data.spans.[$.traceID, $.spanID, $.operationName, $.startTime / 1000, $.duration]`,
  columns: [
    { id: "Trace ID" },
    { id: "Span ID" },
    { id: "Operation" },
    { id: "Start Time" },
    { id: "Duration", type: "NUMBER" },
  ],
}));

export default page("Open Telemetry Basic",
  table({
    lookup: lookup("traces"),
  }),
  selector({
    lookup: lookup("traces", {
      type: "group",
      groupingKey: { sourceId: "Column 2" },
      functions: [{ source: "Column 2" }],
    }),
    filter: { notification: true },
  }),
  bubbleChart({
    lookup: lookup("traces", {
      type: "group",
      functions: [
        { source: "Column 3" },
        { source: "Column 4" },
        { source: "Column 4" },
        { source: "Column 2" },
      ],
    }),
    filter: { listening: true },
    axis: { x: { labels_show: false } },
    chart: { resizable: true, height: 700, zoom: true },
  }),
  { datasets: [tracesDs] }
);
