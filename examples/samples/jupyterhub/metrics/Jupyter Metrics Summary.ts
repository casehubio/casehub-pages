import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType, dataSetId } from "@casehubio/pages-data";
import { page, bind, restSource, title, metric, barChart, columns, lookup, filterBy, groupBy, col, sortBy } from "@casehubio/pages-ui";

const metricsDs = bind("metrics", restSource("${metricsUrl}", dataSetId("metrics"), {
  columns: [
    { id: "Metric" as ColumnId, type: ColumnType.LABEL },
    { id: "Label" as ColumnId, type: ColumnType.LABEL },
    { id: "Value" as ColumnId, type: ColumnType.NUMBER },
  ],
}));

export default page("Jupyter Metrics Summary",
  title("Jupyter Hub Metrics Summary"),
  columns([3, 3, 3, 3],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "jupyterhub_total_users"),
          groupBy(null, col("value"))),
        title: "Users",
        columns: [{ id: "value" as ColumnId, pattern: "#" }],
      }),
    ],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "jupyterhub_running_servers"),
          groupBy(null, col("value"))),
        title: "Running Servers",
        columns: [{ id: "value" as ColumnId, pattern: "#" }],
      }),
    ],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "process_resident_memory_bytes"),
          groupBy(null, col("value"))),
        title: "Memory (mb)",
        columns: [{ id: "value" as ColumnId, expression: "value / 1014 / 1024", pattern: "#" }],
      }),
    ],
    [
      metric({
        lookup: lookup("metrics", filterBy("metric", "EQUALS_TO", "jupyterhub_hub_startup_duration_seconds_sum"),
          groupBy(null, col("value"))),
        title: "Startup (seconds)",
        columns: [{ id: "value" as ColumnId, pattern: "#" }],
      }),
    ]
  ),
  columns([4, 4, 4],
    [
      barChart({
        lookup: lookup("metrics", filterBy("Metric", "EQUALS_TO", "jupyterhub_server_spawn_duration_seconds_count"),
          groupBy("Label", col("Label"), col("Value"))),
        filter: { listening: true },
        resizable: true,
        xAxis: { labelAngle: 15 },
        columns: [{ id: "Label" as ColumnId, expression: `value.replace(/[a-z_]+="|"/g, '').replace(/,$/,'')` }],
      }),
    ],
    [
      barChart({
        lookup: lookup("metrics", filterBy("Metric", "EQUALS_TO", "jupyterhub_server_stop_seconds_count"),
          groupBy("Label", col("Label"), col("Value"))),
        filter: { listening: true },
        resizable: true,
        xAxis: { labelAngle: 15 },
        columns: [{ id: "Label" as ColumnId, expression: `value.replace(/[a-z_]+="|"/g, '').replace(/,$/,'')` }],
      }),
    ],
    [
      barChart({
        lookup: lookup("metrics", filterBy("Metric", "EQUALS_TO", "jupyterhub_proxy_add_duration_seconds_count"),
          groupBy("Label", col("Label"), col("Value"))),
        resizable: true,
        xAxis: { labelAngle: 15 },
        columns: [{ id: "Label" as ColumnId, expression: `value.replace(/[a-z_]+="|"/g, '').replace(/,$/,'')` }],
      }),
    ]
  ),
  barChart({
    lookup: lookup("metrics", filterBy("Metric", "EQUALS_TO", "jupyterhub_request_duration_seconds_count"),
      sortBy("value", "DESCENDING"),
      groupBy("Label", col("Label"), col("Value"))),
    resizable: true,
    xAxis: { labelAngle: 15 },
    columns: [{
      id: "Label" as ColumnId,
      expression: `value.replaceAll("code=", "").replaceAll("handler=", "").replaceAll("method=", "").replaceAll("\"", "")`,
    }],
  }),
  {
    properties: { metricsUrl: "metrics" },
    datasets: [metricsDs],
  }
);
