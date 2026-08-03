import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType, dataSetId } from "@casehubio/pages-data";
import { page, bind, restSource, timeseries, columns, dataTable, lookup, filterBy, groupBy, col, sum, withStyle } from "@casehubio/pages-ui";

const historyDs = bind("history", restSource("${historyUrl}", dataSetId("history"), {}));
const metricsDs = bind("metrics", restSource("${metricsUrl}", dataSetId("metrics"), {
  accumulate: true,
  refreshTime: "2second",
  expression: `$map($, function($v){ [$v[0], $v[1], $v[2] = 'NaN' ? -1 : $v[2], $now() ~> $toMillis()] })`,
  columns: [
    { id: "metric" as ColumnId, type: ColumnType.LABEL },
    { id: "labels" as ColumnId, type: ColumnType.LABEL },
    { id: "value" as ColumnId, type: ColumnType.NUMBER },
    { id: "register" as ColumnId, type: ColumnType.NUMBER },
  ],
}));

export default page("Real Time JVM Monitoring",
  columns([6],
    [
      dataTable({
        lookup: lookup("metrics",
          groupBy("register", col("metric"), col("register"), sum("value"))),
      }),
    ]
  ),

  columns([6, 6],
    [
      timeseries({
        lookup: lookup("history",
          filterBy("metric", "EQUALS_TO", "jvm_memory_used_bytes"),
          filterBy("labels", "LIKE_TO", '%heap%'),
          groupBy(null, col("labels"), col("timestamp"), col("value"))),
        title: "Heap Memory Usage",
        height: "300",
        resizable: true,
      }),
    ],
    [
      timeseries({
        lookup: lookup("history",
          filterBy("metric", "EQUALS_TO", "jvm_threads_live_threads"),
          groupBy(null, col("metric"), col("timestamp"), col("value"))),
        title: "Live Threads",
        height: "300",
        resizable: true,
      }),
    ]
  ),

  withStyle({ "margin-top": "20px" }, columns([6, 6],
    [
      timeseries({
        lookup: lookup("history",
          filterBy("metric", "EQUALS_TO", "jvm_classes_loaded_classes"),
          groupBy(null, col("metric"), col("timestamp"), col("value"))),
        title: "Loaded Classes",
        height: "300",
        resizable: true,
      }),
    ],
    [
      timeseries({
        lookup: lookup("history",
          filterBy("metric", "EQUALS_TO", "system_cpu_usage"),
          groupBy(null, col("metric"), col("timestamp"), col("value"))),
        title: "CPU Usage",
        height: "300",
        resizable: true,
      }),
    ]
  )),
  {
    properties: { metricsUrl: "data/quarkus/metrics", historyUrl: "data/quarkus/history.json" },
    datasets: [historyDs, metricsDs],
  }
);
