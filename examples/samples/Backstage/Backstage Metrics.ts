import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType, dataSetId } from "@casehubio/pages-data";
import { page, bind, restSource, metric, barChart, dataTable, columns, lookup, filterBy, groupBy, col, sortBy } from "@casehubio/pages-ui";

const metricsDs = bind("metrics", restSource("metrics", dataSetId("metrics"), { cacheEnabled: true }));

export default page("Backstage Metrics",
  // Cards
  columns([3, 3, 3, 3],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "nodejs_version_info"),
          groupBy(null, col("labels"))),
        title: "Node Version",
        columns: [{ id: "labels" as ColumnId, expression: `value.split(",")[0].replaceAll("version=", "").replaceAll("\\"", "").replaceAll("type=", "")` }],
      })
    ],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "process_start_time_seconds"),
          groupBy(null, col("value"))),
        title: "Started",
        columns: [{ id: "value" as ColumnId, expression: `new Date(value * 1000).toISOString().substring(0, 19).replace("T", " ")` }],
      })
    ],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "process_heap_bytes"),
          groupBy(null, col("value"))),
        title: "Heap Bytes",
        columns: [{ id: "value" as ColumnId, expression: `parseInt(value / (1024 * 1024)) + " MB"` }],
      })
    ],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "process_open_fds"),
          groupBy(null, col("value"))),
        title: "Open Files",
        columns: [{ id: "value" as ColumnId, pattern: "#" }],
      })
    ]
  ),

  // Charts
  columns([4, 4, 4],
    [
      barChart({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "nodejs_active_resources"),
          sortBy("value", "DESCENDING"),
          groupBy(null, col("labels"), col("value"))),
        title: "Active Resources",
        resizable: true,
        extra: { "series": [{ "type": "bar", "itemStyle": { "normal": { "label": { "show": true, "position": "top", "fontSize": 10 } } } }] },
        xAxis: { labelAngle: -10 },
        columns: [
          { id: "labels" as ColumnId, expression: `value.split(",")[0].replaceAll("version=", "").replaceAll("\\"", "").replaceAll("type=", "")` },
          { id: "value" as ColumnId, pattern: "#" },
        ],
      })
    ],
    [
      barChart({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "nodejs_eventloop_lag_min_seconds", "nodejs_eventloop_lag_max_seconds", "nodejs_eventloop_lag_mean_seconds"),
          sortBy("metric", "DESCENDING"),
          groupBy(null, col("metric"), col("value"))),
        title: "Event Loop Lag (seconds)",
        resizable: true,
        extra: { "series": [{ "type": "bar", "itemStyle": { "normal": { "label": { "show": true, "position": "top", "fontSize": 10 } } } }] },
        columns: [{
          id: "metric" as ColumnId,
          expression: `lbl = "Mean"; if (value === "nodejs_eventloop_lag_min_seconds") lbl = "Min"; if (value === "nodejs_eventloop_lag_max_seconds") lbl = "Max"; lbl;`
        }],
      })
    ],
    [
      barChart({
        lookup: lookup("metrics",
          filterBy("metric", "EQUALS_TO", "nodejs_heap_size_total_bytes", "nodejs_heap_size_used_bytes"),
          sortBy("value", "DESCENDING"),
          groupBy(null, col("metric"), col("value"))),
        title: "Used Bytes (MB)",
        resizable: true,
        extra: { "series": [{ "type": "bar", "itemStyle": { "normal": { "label": { "show": true, "position": "top", "fontSize": 10 } } } }] },
        columns: [
          { id: "metric" as ColumnId, expression: `value.replaceAll("nodejs_heap_size_", "").replaceAll("_bytes", "")` },
          { id: "value" as ColumnId, expression: `parseInt(value / (1024 * 1024))`, pattern: "#" },
        ],
      })
    ]
  ),

  // Metrics Table
  dataTable({
    lookup: lookup("metrics", filterBy("metric", "NOT_EQUALS_TO", "process_open_fds", "process_max_fds", "process_start_time_seconds",
          "nodejs_active_resources", "nodejs_version_info", "process_heap_bytes",
          "nodejs_eventloop_lag_min_seconds", "nodejs_eventloop_lag_max_seconds",
          "nodejs_eventloop_lag_mean_seconds", "nodejs_heap_size_total_bytes",
          "nodejs_heap_space_size_used_bytes", "nodejs_external_memory_bytes", "up"),
      groupBy("metric", col("metric"), col("value"))),
  }),
  { datasets: [metricsDs] });
