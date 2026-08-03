import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType, dataSetId } from "@casehubio/pages-data";
import { page, bind, restSource, metric, barChart, columns, lookup, filterBy, groupBy, max, withStyle, col, sortBy } from "@casehubio/pages-ui";

const allMetricsDs = bind("all_metrics", restSource("${metricsUrl}", dataSetId("all_metrics"), {
  cacheEnabled: true,
  refreshTime: "5second",
  columns: [
    { id: "Metric" as ColumnId, type: ColumnType.LABEL },
    { id: "Labels" as ColumnId, type: ColumnType.LABEL },
    { id: "Value" as ColumnId, type: ColumnType.NUMBER },
  ],
}));

export default page("Quarkus Monitoring",
  columns([3, 3, 3, 3],
    [
      metric({
        lookup: lookup("all_metrics",
          filterBy("Metric", "EQUALS_TO", "system_cpu_usage"),
          groupBy(null, max("Value"))),
        title: "CPU Usage",
        columns: [{ id: "CPU" as ColumnId, expression: "value * 100", pattern: "#" }],
      }),
    ],
    [
      metric({
        lookup: lookup("all_metrics",
          filterBy("Metric", "EQUALS_TO", "process_files_open_files"),
          groupBy(null, max("Value"))),
        title: "Open Files",
        columns: [{ id: "Total" as ColumnId, pattern: "#" }, { id: "Value" as ColumnId, pattern: "#" }],
      }),
    ],
    [
      metric({
        lookup: lookup("all_metrics",
          filterBy("Metric", "EQUALS_TO", "process_uptime_seconds"),
          groupBy(null, max("Value"))),
        visible: true,
        title: "Uptime",
        columns: [{ id: "UPTIME" as ColumnId, pattern: "#", expression: "value / 60" }],
      }),
    ],
    [
      metric({
        lookup: lookup("all_metrics",
          filterBy("Metric", "EQUALS_TO", "jvm_threads_peak_threads"),
          groupBy(null, col("Value"))),
        title: "Peak Threads",
        columns: [{ id: "Value" as ColumnId, pattern: "#" }],
      }),
    ]
  ),

  withStyle({ "margin-top": "50px" }, columns([6, 6],
    [
      barChart({
        lookup: lookup("all_metrics",
          filterBy("Metric", "EQUALS_TO", "jvm_memory_used_bytes"),
          filterBy("labels", "LIKE_TO", 'area="heap"%'),
          sortBy("Total", "DESCENDING"),
          groupBy("Labels", col("Labels"), max("Value", "Total"))),
        extra: { "color" : ["#5ec962"] },
        title: "JVM Memory Used Bytes (heap)",
        resizable: true,
        height: "350",
        grid: { x: false },
        columns: [
          { id: "Total" as ColumnId, pattern: "#" },
          { id: "Labels" as ColumnId, expression: `value.replaceAll("area=\"heap\",id=\"", "").replace("\",", "")` },
        ],
      }),
    ],
    [
      barChart({
        lookup: lookup("all_metrics",
          filterBy("Metric", "EQUALS_TO", "jvm_memory_used_bytes"),
          filterBy("labels", "LIKE_TO", 'area="nonheap"%'),
          sortBy("Total", "DESCENDING"),
          groupBy("Labels", col("Labels"), max("Value", "Total"))),
        extra: { "color" : ["#5ec962"] },
        title: "JVM Memory Used Bytes (nonheap)",
        resizable: true,
        height: "350",
        grid: { x: false },
        columns: [
          { id: "Total" as ColumnId, pattern: "#" },
          { id: "Labels" as ColumnId, expression: `value.replaceAll("area=\"nonheap\",id=\"", "").replace("\",", "")` },
        ],
      }),
    ]
  )),

  withStyle({ "margin-top": "20px" }, columns([12],
    [
      barChart({
        lookup: lookup("all_metrics",
          filterBy("Metric", "EQUALS_TO", "jvm_threads_states_threads"),
          sortBy("Total", "DESCENDING"),
          groupBy("Labels", col("Labels"), max("Value", "Total"))),
        extra: { "color" : ["#4695EB"] },
        title: "Threads",
        resizable: true,
        height: "350",
        grid: { x: false },
        columns: [
          { id: "Total" as ColumnId, pattern: "#" },
          { id: "Labels" as ColumnId, expression: `value.replaceAll("state=\"", "").replace("\",", "")` },
        ],
      }),
    ]
  )),
  {
    properties: { refreshInterval: "10", metricsUrl: "data/quarkus/metrics" },
    datasets: [allMetricsDs],
  }
);
