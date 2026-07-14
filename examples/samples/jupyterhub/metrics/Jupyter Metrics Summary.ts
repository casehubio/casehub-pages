// @ts-nocheck
import { page, bind, restSource, title, metric, barChart, columns, lookup } from "@casehubio/pages-ui";

const metricsDs = bind("metrics", restSource("${metricsUrl}", {
  columns: [
    { id: "Metric", type: "LABEL" },
    { id: "Label", type: "LABEL" },
    { id: "Value", type: "NUMBER" },
  ],
}));

export default page("Jupyter Metrics Summary",
  title("Jupyter Hub Metrics Summary"),
  columns({}, ["3", "3", "3", "3"],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["jupyterhub_total_users"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Users" },
        columns: [{ id: "value", pattern: "#" }],
      }),
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["jupyterhub_running_servers"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Running Servers" },
        columns: [{ id: "value", pattern: "#" }],
      }),
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["process_resident_memory_bytes"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Memory (mb)" },
        columns: [{ id: "value", expression: "value / 1014 / 1024", pattern: "#" }],
      }),
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["jupyterhub_hub_startup_duration_seconds_sum"] },
          { type: "group", functions: [{ source: "value" }] }),
        general: { title: "Startup (seconds)" },
        columns: [{ id: "value", pattern: "#" }],
      }),
    ]
  ),
  columns({}, ["4", "4", "4"],
    [
      barChart({
        lookup: lookup("metrics", { type: "filter", column: "Metric", function: "EQUALS_TO", args: ["jupyterhub_server_spawn_duration_seconds_count"] },
          {
            type: "group",
            groupingKey: { sourceId: "Label" },
            functions: [{ source: "Label" }, { source: "Value" }],
          }),
        filter: { listening: "true" },
        chart: { resizable: true },
        axis: { x: { labels_angle: 15 } },
        columns: [{ id: "Label", expression: `value.replace(/[a-z_]+="|"/g, '').replace(/,$/,'')` }],
      }),
    ],
    [
      barChart({
        lookup: lookup("metrics", { type: "filter", column: "Metric", function: "EQUALS_TO", args: ["jupyterhub_server_stop_seconds_count"] },
          {
            type: "group",
            groupingKey: { sourceId: "Label" },
            functions: [{ source: "Label" }, { source: "Value" }],
          }),
        filter: { listening: "true" },
        chart: { resizable: true },
        axis: { x: { labels_angle: 15 } },
        columns: [{ id: "Label", expression: `value.replace(/[a-z_]+="|"/g, '').replace(/,$/,'')` }],
      }),
    ],
    [
      barChart({
        lookup: lookup("metrics", { type: "filter", column: "Metric", function: "EQUALS_TO", args: ["jupyterhub_proxy_add_duration_seconds_count"] },
          {
            type: "group",
            groupingKey: { sourceId: "Label" },
            functions: [{ source: "Label" }, { source: "Value" }],
          }),
        chart: { resizable: true },
        axis: { x: { labels_angle: 15 } },
        columns: [{ id: "Label", expression: `value.replace(/[a-z_]+="|"/g, '').replace(/,$/,'')` }],
      }),
    ]
  ),
  barChart({
    lookup: lookup("metrics", { type: "filter", column: "Metric", function: "EQUALS_TO", args: ["jupyterhub_request_duration_seconds_count"] },
      { type: "sort", column: "value", sortOrder: "DESCENDING" },
      {
        type: "group",
        groupingKey: { sourceId: "Label" },
        functions: [{ source: "Label" }, { source: "Value" }],
      }),
    chart: { resizable: true },
    axis: { x: { labels_angle: 15 } },
    columns: [{
      id: "Label",
      expression: `value.replaceAll("code=", "").replaceAll("handler=", "").replaceAll("method=", "").replaceAll("\"", "")`,
    }],
  }),
  {
    properties: { metricsUrl: "metrics" },
    datasets: [metricsDs],
  }
);
