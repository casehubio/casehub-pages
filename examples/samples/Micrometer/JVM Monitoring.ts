// @ts-nocheck
import { page, bind, restSource, metric, barChart, table, title, lookup } from "@casehubio/pages-ui";

const popDs = bind("pop", restSource("${metricsUrl}", {
  columns: [
    { id: "Metric", type: "LABEL" },
    { id: "Labels", type: "LABEL" },
    { id: "Value", type: "NUMBER" },
  ],
}));

export default page("JVM Monitoring",
  metric({
    lookup: lookup("pop",
      { type: "filter", column: "Metric", function: "EQUALS_TO", args: ["system_cpu_usage"] },
      { type: "sort", column: "Total", order: "DESCENDING" },
      { type: "group", functions: [{ source: "Value", function: "MAX", column: "Total" }] }),
    general: { title: "System CPU Usage" },
    chart: { height: 200, resizable: true, margin: { left: 10, bottom: "60" } },
    columns: [{ id: "Total", expression: "value * 100" }],
  }),

  title("Threads"),

  barChart({
    lookup: lookup("pop",
      { type: "filter", column: "Metric", function: "EQUALS_TO", args: ["jvm_threads_states_threads"] },
      { type: "sort", column: "Total", order: "DESCENDING" },
      {
        type: "group",
        groupingKey: { sourceId: "Labels" },
        functions: [
          { source: "Labels" },
          { source: "Value", function: "MAX", column: "Total" },
        ],
      }),
    chart: { resizable: true, height: 300, margin: { left: 90 } },
    columns: [{ id: "Labels", expression: `value.replaceAll('state="', '').replaceAll('",', '')` }],
  }),

  title("JVM Memory Used Bytes"),

  barChart({
    lookup: lookup("pop",
      { type: "filter", column: "Metric", function: "EQUALS_TO", args: ["jvm_memory_used_bytes"] },
      { type: "sort", column: "Total", order: "DESCENDING" },
      {
        type: "group",
        groupingKey: { sourceId: "Labels" },
        functions: [
          { source: "Labels" },
          { source: "Value", function: "MAX", column: "Total" },
        ],
      }),
    axis: { x: { labels_angle: 10 } },
    chart: { resizable: true, height: 300, margin: { left: 90 } },
    columns: [
      { id: "Total", pattern: "#" },
      {
        id: "Labels",
        expression: `value.replaceAll('id="', ' ').replaceAll('area="heap",', "").replaceAll('area="nonheap",', "").replaceAll('",', "").trim()`,
      },
    ],
  }),

  title("All Metrics"),

  table({
    lookup: lookup("pop"),
    chart: { height: 400, resizable: true },
  }),
  {
    properties: { refreshInterval: "5", metricsUrl: "data/quarkus/metrics" },
    datasets: [popDs],
  }
);
