// @ts-nocheck
import { page, bind, restSource, title, barChart, lookup } from "@casehubio/pages-ui";

const metricsDs = bind("metrics", restSource("${metricsUrl}", {
  columns: [
    { id: "Metric", type: "LABEL" },
    { id: "Label", type: "LABEL" },
    { id: "Value", type: "NUMBER" },
  ],
}));

export default page("Jupyter Hub Metrics Histograms",
  title("Jupyter Hub Metrics Histograms"),
  barChart({
    lookup: lookup("metrics", { type: "filter", column: "Metric", function: "EQUALS_TO", args: ["jupyterhub_proxy_add_duration_seconds_bucket"] },
      {
        type: "group",
        groupingKey: { sourceId: "Label" },
        functions: [{ source: "Label" }, { source: "Value" }],
      }),
    chart: { resizable: true },
    axis: { x: { labels_angle: 15 } },
    columns: [{ id: "Label", expression: `value.replace(/[a-z_]+="|"/g, '').replace(/,$/,'')` }],
  }),
  barChart({
    lookup: lookup("metrics", { type: "filter", column: "Metric", function: "EQUALS_TO", args: ["jupyterhub_proxy_delete_duration_seconds_bucket"] },
      {
        type: "group",
        groupingKey: { sourceId: "Label" },
        functions: [{ source: "Label" }, { source: "Value" }],
      }),
    chart: { resizable: true },
    axis: { x: { labels_angle: 15 } },
    columns: [{ id: "Label", expression: `value.replace(/[a-z_]+="|"/g, '').replace(/,$/,'')` }],
  }),
  barChart({
    lookup: lookup("metrics", { type: "filter", column: "Metric", function: "EQUALS_TO", args: ["jupyterhub_server_spawn_duration_seconds_bucket"] },
      {
        type: "group",
        groupingKey: { sourceId: "Label" },
        functions: [{ source: "Label" }, { source: "Value" }],
      }),
    chart: { resizable: true },
    axis: { x: { labels_angle: 15 } },
    columns: [{ id: "Label", expression: `value.replace(/[a-z_]+="|"/g, '').replace(/,$/,'')` }],
  }),
  {
    properties: { metricsUrl: "metrics" },
    datasets: [metricsDs],
  }
);
