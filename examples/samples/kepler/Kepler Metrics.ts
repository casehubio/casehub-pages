import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType, dataSetId } from "@casehubio/pages-data";
import { page, bind, restSource, title, metric, barChart, timeseries, markdown, selector, tabs, html, columns, rows, withStyle, lookup, groupBy, col, sum, avg, count, max, min } from "@casehubio/pages-ui";

const metricsDs = bind("metrics", restSource("metrics", dataSetId("metrics"), { cacheEnabled: true }));

const joulesByContainerDs = bind("joules_by_container", restSource("metrics", dataSetId("joules_by_container"), {
  cacheEnabled: true,
  expression: `$ [$contains($[0], /kepler_container.*joules_total/) and $[2] != "0"].[$replace($[1], /(.+)container_name="([0-9a-zA-Z-_]+)",(.+)/, "$2"), $replace($[1], /(.+)pod_name="([0-9a-zA-Z-_]+)"/, "$2"), $[0] = "kepler_container_joules_total" ? $[2] : "0", $[0] = "kepler_container_core_joules_total" ? $[2] : "0", $[0] = "kepler_container_dram_joules_total" ? $[2] : "0", $[0] = "kepler_container_uncore_joules_total" ? $[2] : "0", $[0] = "kepler_container_package_joules_total" ? $[2] : "0", $[0] = "kepler_container_gpu_joules_total" ? $[2] : "0", $[0] = "kepler_container_other_host_components_joules_total" ? $[2] : "0"]`,
  columns: [
    { id: "Container" as ColumnId, type: ColumnType.LABEL },
    { id: "Pod" as ColumnId, type: ColumnType.LABEL },
    { id: "Total" as ColumnId, type: ColumnType.NUMBER },
    { id: "Core" as ColumnId, type: ColumnType.NUMBER },
    { id: "DRAM" as ColumnId, type: ColumnType.NUMBER },
    { id: "Uncore" as ColumnId, type: ColumnType.NUMBER },
    { id: "Package" as ColumnId, type: ColumnType.NUMBER },
    { id: "Other Host" as ColumnId, type: ColumnType.NUMBER },
    { id: "GPU" as ColumnId, type: ColumnType.NUMBER },
  ],
}));

const joulesByNodeDs = bind("joules_by_node", restSource("metrics", dataSetId("joules_by_node"), {
  cacheEnabled: true,
  expression: `$ [$contains($[0], /kepler_node.*joules_total/) and $[2] != "0"].[$replace($[1], /instance="([0-9a-zA-Z-_]+)",(.+)/, "$1"), $[0] = "kepler_node_core_joules_total" ? $[2] : "0", $[0] = "kepler_node_dram_joules_total" ? $[2] : "0", $[0] = "kepler_node_uncore_joules_total" ? $[2] : "0", $[0] = "kepler_node_package_joules_total" ? $[2] : "0", $[0] = "kepler_node_gpu_joules_total" ? $[2] : "0", $[0] = "kepler_node_other_host_components_joules_total" ? $[2] : "0", $[2]]`,
  columns: [
    { id: "Node" as ColumnId, type: ColumnType.LABEL },
    { id: "Core" as ColumnId, type: ColumnType.NUMBER },
    { id: "DRAM" as ColumnId, type: ColumnType.NUMBER },
    { id: "Uncore" as ColumnId, type: ColumnType.NUMBER },
    { id: "Package" as ColumnId, type: ColumnType.NUMBER },
    { id: "Other Host" as ColumnId, type: ColumnType.NUMBER },
    { id: "GPU" as ColumnId, type: ColumnType.NUMBER },
    { id: "Value" as ColumnId, type: ColumnType.NUMBER },
  ],
}));

const monitoringDs = bind("monitoring", restSource("metrics", dataSetId("monitoring"), {
  cacheEnabled: true,
  accumulate: true,
  expression: `($now := $now() ~> $toMillis(); $[$[0] = "kepler_container_joules_total" and $[2] != "0"].[$replace($[1], /(.+)container_namespace="([0-9a-zA-Z-_]+)",(.+)/, "$2"), $replace($[1], /(.+)container_name="([0-9a-zA-Z-_]+)",(.+)/, "$2"), $[2], $now])`,
  columns: [
    { id: "Namespace" as ColumnId, type: ColumnType.LABEL },
    { id: "Container" as ColumnId, type: ColumnType.LABEL },
    { id: "Total" as ColumnId, type: ColumnType.NUMBER },
    { id: "Timestamp" as ColumnId, type: ColumnType.NUMBER },
  ],
}));

export default page("Kepler Metrics",
  // Index page
  title("Kepler Metrics"),
  tabs(),
  html('<div id="Metrics_Div"></div>'),

  // Monitoring page
  withStyle({ margin: "10px", "margin-top": "30px" }, columns([12],
    [
      timeseries({
        lookup: lookup("monitoring",
          groupBy(null, col("Container"), col("Timestamp"), col("Total"))),
        filter: { listening: true },
        title: "Joules by Container over time",
        resizable: true,
        height: "400",
        legend: { show: true },
        grid: { x: false },
  
      })
    ]
  )),

  // Joules by Node page
  markdown("### **Filter**"),
  withStyle({ width: "160px" },
    selector({
      lookup: lookup("joules_by_node",
        groupBy("Node", col("Node"))),
      filter: { notification: true },
    })
  ),

  withStyle({ "margin-top": "30px", width: "330px", "text-align": "center" },
    metric({
      lookup: lookup("joules_by_node",
        groupBy(null, sum("Value"))),
      filter: { listening: true },
      title: "Total Joules by Node",
      columns: [{ id: "Total" as ColumnId, pattern: "###,###.000" }],
      html: { template: `<div style="width: 95%;height: auto;margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;"><div class="pf-v5-c-card pf-m-compact pf-m-rounded"><div class="pf-v5-c-card__title"><div class="pf-v5-c-title pf-m-2xl">\${value}</div></div><div class="pf-v5-c-card__footer">\${title}</div></div></div>` },

    })
  ),

  withStyle({ "margin-top": "80px" },
    barChart({
      lookup: lookup("joules_by_node",
        groupBy("Node", col("Node"), sum("Package"), sum("Core"), sum("DRAM"), sum("Uncore"), sum("Other Host"), sum("GPU"))),
      filter: { listening: true },
      title: "Joules by Node",
      resizable: true,
      height: "400",
      legend: { show: true },
      grid: { x: false },
      extra: { ".color": ["#6f634b", "#7a745d", "#9a9381", "#b2a59b", "#cec0b8", "#dec0bf"], "title": { "top": "auto", "right": "" } },
    })
  ),

  // Joules by Container page
  markdown("### **Filter**"),
  withStyle({ width: "160px" },
    selector({
      lookup: lookup("joules_by_container",
        groupBy("Container", col("Container"))),
      filter: { notification: true },
    })
  ),

  withStyle({ width: "160px", "margin-top": "10px" },
    selector({
      lookup: lookup("joules_by_container",
        groupBy("Pod", col("Pod"))),
      filter: { notification: true, listening: true },
    })
  ),

  withStyle({ "margin-top": "30px" },
    metric({
      lookup: lookup("joules_by_container",
        groupBy(null, sum("Total"))),
      filter: { listening: true },
      title: "Total Joules by Container",
      columns: [{ id: "Total" as ColumnId, pattern: "###,###.000" }],
      html: { template: `<div style="width: 95%;height: auto;margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;"><div class="pf-v5-c-card pf-m-compact pf-m-rounded"><div class="pf-v5-c-card__title"><div class="pf-v5-c-title pf-m-2xl">\${value}</div></div><div class="pf-v5-c-card__footer">\${title}</div></div></div>` },

    })
  ),

  withStyle({ "margin-top": "80px" },
    barChart({
      lookup: lookup("joules_by_container",
        groupBy("Container", col("Container"), sum("Package"), sum("Core"), sum("DRAM"), sum("Uncore"), sum("Other Host"), sum("GPU"))),
      filter: { listening: true },
      title: "Joules by Container",
      resizable: true,
      height: "400",
      legend: { show: true },
      grid: { x: false },
      extra: { ".color": ["#6f634b", "#7a745d", "#9a9381", "#b2a59b", "#cec0b8", "#dec0bf"], "title": { "top": "auto", "right": "" } },
    })
  ),

  {
    settings: { mode: "dark" },
    properties: {
      kepler_url: "https://raw.githubusercontent.com/jesuino/melviz-yaml-samples/main/kepler",
      kepler_metrics_url: "metrics",
    },
    datasets: [metricsDs, joulesByContainerDs, joulesByNodeDs, monitoringDs],
  });

// Note: The YAML defines a navTree with GROUP "Metrics" containing pages:
// - Joules by Node
// - Joules by Container
// - Monitoring
// This would require a navigation API in the DSL for proper multi-page support.
