// @ts-nocheck
import { page, bind, restSource, timeseries, columns, table, lookup } from "@casehubio/pages-ui";

const historyDs = bind("history", restSource("${historyUrl}", {}));
const metricsDs = bind("metrics", restSource("${metricsUrl}", {
  accumulate: true,
  cacheMaxRows: 30000,
  refreshTime: "2second",
  expression: `$map($, function($v){ [$v[0], $v[1], $v[2] = 'NaN' ? -1 : $v[2], $now() ~> $toMillis()] })`,
  columns: [
    { id: "metric", type: "label" },
    { id: "labels", type: "label" },
    { id: "value", type: "number" },
    { id: "register", type: "number" },
  ],
}));

export default page("Real Time JVM Monitoring",
  columns({ "margin-left": "10px" }, ["6"],
    [
      table({
        lookup: lookup("metrics", {
          type: "group",
          groupingKey: { sourceId: "register" },
          functions: [
            { source: "metric" },
            { source: "register" },
            { source: "value", function: "SUM" },
          ],
        }),
      }),
    ]
  ),

  columns({}, ["6", "6"],
    [
      timeseries({
        lookup: lookup("history",
          { type: "filter", column: "metric", function: "EQUALS_TO", args: ["jvm_memory_used_bytes"] },
          { type: "filter", column: "labels", function: "LIKE_TO", args: ['%heap%'] },
          {
            type: "group",
            functions: [
              { source: "labels" },
              { source: "timestamp" },
              { source: "value" },
            ],
          }),
        general: { title: "Heap Memory Usage" },
        chart: { height: 300, resizable: true },
      }),
    ],
    [
      timeseries({
        lookup: lookup("history",
          { type: "filter", column: "metric", function: "EQUALS_TO", args: ["jvm_threads_live_threads"] },
          {
            type: "group",
            functions: [
              { source: "metric" },
              { source: "timestamp" },
              { source: "value" },
            ],
          }),
        general: { title: "Live Threads" },
        chart: { height: 300, resizable: true },
      }),
    ]
  ),

  columns({ "margin-top": "20px" }, ["6", "6"],
    [
      timeseries({
        lookup: lookup("history",
          { type: "filter", column: "metric", function: "EQUALS_TO", args: ["jvm_classes_loaded_classes"] },
          {
            type: "group",
            functions: [
              { source: "metric" },
              { source: "timestamp" },
              { source: "value" },
            ],
          }),
        general: { title: "Loaded Classes" },
        chart: { height: 300, resizable: true },
      }),
    ],
    [
      timeseries({
        lookup: lookup("history",
          { type: "filter", column: "metric", function: "EQUALS_TO", args: ["system_cpu_usage"] },
          {
            type: "group",
            functions: [
              { source: "metric" },
              { source: "timestamp" },
              { source: "value" },
            ],
          }),
        general: { title: "CPU Usage" },
        chart: { height: 300, resizable: true },
      }),
    ]
  ),
  {
    properties: { metricsUrl: "data/quarkus/metrics", historyUrl: "data/quarkus/history.json" },
    datasets: [historyDs, metricsDs],
  }
);
