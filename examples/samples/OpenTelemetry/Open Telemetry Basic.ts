import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType, dataSetId } from "@casehubio/pages-data";
import { page, bind, restSource, dataTable, selector, bubbleChart, lookup, groupBy, col } from "@casehubio/pages-ui";

const tracesDs = bind("traces", restSource("traces.json", dataSetId("traces"), {
  expression: `$.data.spans.[$.traceID, $.spanID, $.operationName, $.startTime / 1000, $.duration]`,
  columns: [
    { id: "Trace ID" as ColumnId, type: ColumnType.LABEL },
    { id: "Span ID" as ColumnId, type: ColumnType.LABEL },
    { id: "Operation" as ColumnId, type: ColumnType.LABEL },
    { id: "Start Time" as ColumnId, type: ColumnType.NUMBER },
    { id: "Duration" as ColumnId, type: ColumnType.NUMBER },
  ],
}));

export default page("Open Telemetry Basic",
  dataTable({
    lookup: lookup("traces"),
  }),
  selector({
    lookup: lookup("traces",
      groupBy("Column 2",
        col("Column 2"))),
    filter: { notification: true },
  }),
  bubbleChart({
    lookup: lookup("traces",
      groupBy(null,
        col("Column 3"),
        col("Column 4"),
        col("Column 4"),
        col("Column 2"))),
    filter: { listening: true },
    xAxis: { showLabels: false },
    resizable: true,
    height: "700",
    zoom: true,
  }),
  { datasets: [tracesDs] }
);
