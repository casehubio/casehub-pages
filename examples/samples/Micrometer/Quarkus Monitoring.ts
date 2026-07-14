// @ts-nocheck
import { page, bind, restSource, metric, barChart, columns, lookup } from "@casehubio/pages-ui";

const allMetricsDs = bind("all_metrics", restSource("${metricsUrl}", {
  cacheEnabled: true,
  refreshTime: "5second",
  columns: [
    { id: "Metric", type: "LABEL" },
    { id: "Labels", type: "LABEL" },
    { id: "Value", type: "NUMBER" },
  ],
}));

export default page("Quarkus Monitoring",
  columns({}, ["3", "3", "3", "3"],
    [
      metric({
        lookup: lookup("all_metrics",
          { type: "filter", column: "Metric", function: "EQUALS_TO", args: ["system_cpu_usage"] },
          { type: "group", functions: [{ source: "Value", function: "MAX", column: "CPU" }] }),
        general: { title: "CPU Usage" },
        columns: [{ id: "CPU", expression: "value * 100", pattern: "#" }],
      }),
    ],
    [
      metric({
        lookup: lookup("all_metrics",
          { type: "filter", column: "Metric", function: "EQUALS_TO", args: ["process_files_open_files"] },
          { type: "group", functions: [{ source: "Value", function: "MAX", column: "Total" }] }),
        general: { title: "Open Files" },
        columns: [{ id: "Total", pattern: "#" }, { id: "Value", pattern: "#" }],
      }),
    ],
    [
      metric({
        lookup: lookup("all_metrics",
          { type: "filter", column: "Metric", function: "EQUALS_TO", args: ["process_uptime_seconds"] },
          { type: "group", functions: [{ source: "Value", function: "MAX", column: "UPTIME" }] }),
        general: { visible: true, title: "Uptime" },
        columns: [{ id: "UPTIME", pattern: "#", expression: "value / 60" }],
      }),
    ],
    [
      metric({
        lookup: lookup("all_metrics",
          { type: "filter", column: "Metric", function: "EQUALS_TO", args: ["jvm_threads_peak_threads"] },
          { type: "group", functions: [{ source: "Value" }] }),
        general: { title: "Peak Threads" },
        columns: [{ id: "Value", pattern: "#" }],
      }),
    ]
  ),

  columns({ "margin-top": "50px" }, ["6", "6"],
    [
      barChart({
        lookup: lookup("all_metrics",
          { type: "filter", column: "Metric", function: "EQUALS_TO", args: ["jvm_memory_used_bytes"] },
          { type: "filter", column: "labels", function: "LIKE_TO", args: ['area="heap"%'] },
          { type: "sort", column: "Total", sortOrder: "DESCENDING" },
          {
            type: "group",
            groupingKey: { sourceId: "Labels" },
            functions: [
              { source: "Labels" },
              { source: "Value", function: "MAX", column: "Total" },
            ],
          }),
        extraConfiguration: `{ "color" : ["#5ec962"] }`,
        general: { title: "JVM Memory Used Bytes (heap)" },
        chart: { resizable: true, height: 350, grid: { x: false } },
        columns: [
          { id: "Total", pattern: "#" },
          { id: "Labels", expression: `value.replaceAll("area=\"heap\",id=\"", "").replace("\",", "")` },
        ],
      }),
    ],
    [
      barChart({
        lookup: lookup("all_metrics",
          { type: "filter", column: "Metric", function: "EQUALS_TO", args: ["jvm_memory_used_bytes"] },
          { type: "filter", column: "labels", function: "LIKE_TO", args: ['area="nonheap"%'] },
          { type: "sort", column: "Total", sortOrder: "DESCENDING" },
          {
            type: "group",
            groupingKey: { sourceId: "Labels" },
            functions: [
              { source: "Labels" },
              { source: "Value", function: "MAX", column: "Total" },
            ],
          }),
        extraConfiguration: `{ "color" : ["#5ec962"] }`,
        general: { title: "JVM Memory Used Bytes (nonheap)" },
        chart: { resizable: true, height: 350, grid: { x: false } },
        columns: [
          { id: "Total", pattern: "#" },
          { id: "Labels", expression: `value.replaceAll("area=\"nonheap\",id=\"", "").replace("\",", "")` },
        ],
      }),
    ]
  ),

  columns({ "margin-top": "20px" }, ["12"],
    [
      barChart({
        lookup: lookup("all_metrics",
          { type: "filter", column: "Metric", function: "EQUALS_TO", args: ["jvm_threads_states_threads"] },
          { type: "sort", column: "Total", sortOrder: "DESCENDING" },
          {
            type: "group",
            groupingKey: { sourceId: "Labels" },
            functions: [
              { source: "Labels" },
              { source: "Value", function: "MAX", column: "Total" },
            ],
          }),
        extraConfiguration: `{ "color" : ["#4695EB"] }`,
        general: { title: "Threads" },
        chart: { resizable: true, height: 350, grid: { x: false } },
        columns: [
          { id: "Total", pattern: "#" },
          { id: "Labels", expression: `value.replaceAll("state=\"", "").replace("\",", "")` },
        ],
      }),
    ]
  ),
  {
    properties: { refreshInterval: "10", metricsUrl: "data/quarkus/metrics" },
    datasets: [allMetricsDs],
  }
);
