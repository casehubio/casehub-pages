import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType, dataSetId } from "@casehubio/pages-data";
import { page, bind, restSource, title, barChart, lookup, filterBy, groupBy, col } from "@casehubio/pages-ui";

const metricsDs = bind("metrics", restSource("${metricsUrl}", dataSetId("metrics"), {
  columns: [
    { id: "Metric" as ColumnId, type: ColumnType.LABEL },
    { id: "Label" as ColumnId, type: ColumnType.LABEL },
    { id: "Value" as ColumnId, type: ColumnType.NUMBER },
  ],
}));

export default page("Jupyter Hub Metrics Histograms",
  title("Jupyter Hub Metrics Histograms"),
  barChart({
    lookup: lookup("metrics", filterBy("Metric", "EQUALS_TO", "jupyterhub_proxy_add_duration_seconds_bucket"),
      groupBy("Label", col("Label"), col("Value"))),
    resizable: true,
    xAxis: { labelAngle: 15 },
    columns: [{ id: "Label" as ColumnId, expression: `value.replace(/[a-z_]+="|"/g, '').replace(/,$/,'')` }],
  }),
  barChart({
    lookup: lookup("metrics", filterBy("Metric", "EQUALS_TO", "jupyterhub_proxy_delete_duration_seconds_bucket"),
      groupBy("Label", col("Label"), col("Value"))),
    resizable: true,
    xAxis: { labelAngle: 15 },
    columns: [{ id: "Label" as ColumnId, expression: `value.replace(/[a-z_]+="|"/g, '').replace(/,$/,'')` }],
  }),
  barChart({
    lookup: lookup("metrics", filterBy("Metric", "EQUALS_TO", "jupyterhub_server_spawn_duration_seconds_bucket"),
      groupBy("Label", col("Label"), col("Value"))),
    resizable: true,
    xAxis: { labelAngle: 15 },
    columns: [{ id: "Label" as ColumnId, expression: `value.replace(/[a-z_]+="|"/g, '').replace(/,$/,'')` }],
  }),
  {
    properties: { metricsUrl: "metrics" },
    datasets: [metricsDs],
  }
);
