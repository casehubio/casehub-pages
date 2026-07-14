import { page, bind, restSource, table, selector, bubbleChart, lookup} from "@casehubio/pages-ui";

import type { DataSetId, ColumnId } from "@casehubio/pages-data";

// TypeScript companion to "Open Telemetry Basic.yaml"
// OpenTelemetry traces visualization

// Note: The YAML has some malformed syntax (`.displayer:` and `.columns:` with leading dots).
// This translation corrects those to valid DSL calls.

const tracesDs = bind("traces", restSource("traces.json", {;

export default page(
  {},
  {},
  [
      expression: `$.data.spans.[$.traceID, $.spanID, $.operationName, $.startTime / 1000, $.duration]`,
      columns: [
        { id: "Trace ID" as ColumnId },
        { id: "Span ID" as ColumnId },
        { id: "Operation" as ColumnId },
        { id: "Start Time" as ColumnId },
        { id: "Duration" as ColumnId, type: "NUMBER" },
      ]
    })),
  ],
  [
    // Note: Original YAML has `.displayer:` which is likely a typo
    table({
      lookup: lookup("traces" as DataSetId, ),
    }),

    selector({
      lookup: lookup("traces" as DataSetId, {
          type: "group",
          groupingKey: { sourceId: "Column 2" as ColumnId },
          functions: [{ source: "Column 2" as ColumnId }]
        }),
      filter: { notification: true },
    }),

    bubbleChart({
      lookup: lookup("traces" as DataSetId, {
          type: "group",
          functions: [
            { source: "Column 3" as ColumnId },
            { source: "Column 4" as ColumnId },
            { source: "Column 4" as ColumnId },
            { source: "Column 2" as ColumnId }
          ]
        }),
      filter: { listening: true },
      axis: { x: { labels_show: false } },
      chart: { resizable: true, height: 700, zoom: true },
    })
  ],
  { datasets: [tracesDs] });
