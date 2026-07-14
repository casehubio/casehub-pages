// @ts-nocheck
import { page, bind, restSource, metric, barChart, table, columns, lookup } from "@casehubio/pages-ui";

const metricsDs = bind("metrics", restSource("metrics", { cacheEnabled: true }));

export default page("Backstage Metrics",
  // Cards
  columns({ "margin-top": "10px" }, ["3", "3", "3", "3"],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["nodejs_version_info"] },
          { type: "group", functions: [{ source: "labels" }] }),
        general: { title: "Node Version" },
        columns: [{ id: "labels", expression: `value.split(",")[0].replaceAll("version=", "").replaceAll("\\"", "").replaceAll("type=", "")` }],
      })
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["process_start_time_seconds"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Started" },
        columns: [{ id: "value", expression: `new Date(value * 1000).toISOString().substring(0, 19).replace("T", " ")` }],
      })
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["process_heap_bytes"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Heap Bytes" },
        columns: [{ id: "value", expression: `parseInt(value / (1024 * 1024)) + " MB"` }],
      })
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["process_open_fds"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Open Files" },
        columns: [{ id: "value", pattern: "#" }],
      })
    ]
  ),

  // Charts
  columns({}, ["4", "4", "4"],
    [
      barChart({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["nodejs_active_resources"] },
          { type: "sort", column: "value", order: "DESCENDING" },
          { type: "group", functions: [{ source: "labels" }, { source: "value" }] }),
        general: { title: "Active Resources" },
        chart: { resizable: true },
        extraConfiguration: `{ "series": [{ "type": "bar", "itemStyle": { "normal": { "label": { "show": true, "position": "top", "fontSize": 10 } } } }] }`,
        axis: { x: { labels_angle: -10 } },
        columns: [
          { id: "labels", expression: `value.split(",")[0].replaceAll("version=", "").replaceAll("\\"", "").replaceAll("type=", "")` },
          { id: "value", pattern: "#" },
        ],
      })
    ],
    [
      barChart({
        lookup: lookup("metrics", {
            type: "filter",
            column: "metric",
            function: "EQUALS_TO",
            args: ["nodejs_eventloop_lag_min_seconds", "nodejs_eventloop_lag_max_seconds", "nodejs_eventloop_lag_mean_seconds"]
          },
          { type: "sort", column: "metric", order: "DESCENDING" },
          { type: "group", functions: [{ source: "metric" }, { source: "value" }] }),
        general: { title: "Event Loop Lag (seconds)" },
        chart: { resizable: true },
        extraConfiguration: `{ "series": [{ "type": "bar", "itemStyle": { "normal": { "label": { "show": true, "position": "top", "fontSize": 10 } } } }] }`,
        columns: [{
          id: "metric",
          expression: `lbl = "Mean"; if (value === "nodejs_eventloop_lag_min_seconds") lbl = "Min"; if (value === "nodejs_eventloop_lag_max_seconds") lbl = "Max"; lbl;`
        }],
      })
    ],
    [
      barChart({
        lookup: lookup("metrics", {
            type: "filter",
            column: "metric",
            function: "EQUALS_TO",
            args: ["nodejs_heap_size_total_bytes", "nodejs_heap_size_used_bytes"]
          },
          { type: "sort", column: "value", order: "DESCENDING" },
          { type: "group", functions: [{ source: "metric" }, { source: "value" }] }),
        general: { title: "Used Bytes (MB)" },
        chart: { resizable: true },
        extraConfiguration: `{ "series": [{ "type": "bar", "itemStyle": { "normal": { "label": { "show": true, "position": "top", "fontSize": 10 } } } }] }`,
        columns: [
          { id: "metric", expression: `value.replaceAll("nodejs_heap_size_", "").replaceAll("_bytes", "")` },
          { id: "value", expression: `parseInt(value / (1024 * 1024))`, pattern: "#" },
        ],
      })
    ]
  ),

  // Metrics Table
  table({
    lookup: lookup("metrics", {
        type: ".filter",  // Note: original YAML has typo ".filter" instead of "filter"
        column: "metric",
        function: "NOT_EQUALS_TO",
        args: [
          "process_open_fds", "process_max_fds", "process_start_time_seconds",
          "nodejs_active_resources", "nodejs_version_info", "process_heap_bytes",
          "nodejs_eventloop_lag_min_seconds", "nodejs_eventloop_lag_max_seconds",
          "nodejs_eventloop_lag_mean_seconds", "nodejs_heap_size_total_bytes",
          "nodejs_heap_space_size_used_bytes", "nodejs_external_memory_bytes", "up"
        ]
      },
      {
        type: "group",
        groupingKey: { sourceId: "metric" },
        functions: [{ source: "metric" }, { source: "value" }]
      }),
  }),
  { datasets: [metricsDs] });
