// @ts-nocheck
import { page, bind, restSource, title, metric, barChart, timeseries, markdown, selector, tabs, div, columns, withStyle, lookup } from "@casehubio/pages-ui";

const metricsDs = bind("metrics", restSource("metrics", { cacheEnabled: true }));

const joulesByContainerDs = bind("joules_by_container", restSource("metrics", {
  cacheEnabled: true,
  expression: `$ [$contains($[0], /kepler_container.*joules_total/) and $[2] != "0"].[$replace($[1], /(.+)container_name="([0-9a-zA-Z-_]+)",(.+)/, "$2"), $replace($[1], /(.+)pod_name="([0-9a-zA-Z-_]+)"/, "$2"), $[0] = "kepler_container_joules_total" ? $[2] : "0", $[0] = "kepler_container_core_joules_total" ? $[2] : "0", $[0] = "kepler_container_dram_joules_total" ? $[2] : "0", $[0] = "kepler_container_uncore_joules_total" ? $[2] : "0", $[0] = "kepler_container_package_joules_total" ? $[2] : "0", $[0] = "kepler_container_gpu_joules_total" ? $[2] : "0", $[0] = "kepler_container_other_host_components_joules_total" ? $[2] : "0"]`,
  columns: [
    { id: "Container" },
    { id: "Pod" },
    { id: "Total", type: "NUMBER" },
    { id: "Core", type: "NUMBER" },
    { id: "DRAM", type: "NUMBER" },
    { id: "Uncore", type: "NUMBER" },
    { id: "Package", type: "NUMBER" },
    { id: "Other Host", type: "NUMBER" },
    { id: "GPU", type: "NUMBER" },
  ],
}));

const joulesByNodeDs = bind("joules_by_node", restSource("metrics", {
  cacheEnabled: true,
  expression: `$ [$contains($[0], /kepler_node.*joules_total/) and $[2] != "0"].[$replace($[1], /instance="([0-9a-zA-Z-_]+)",(.+)/, "$1"), $[0] = "kepler_node_core_joules_total" ? $[2] : "0", $[0] = "kepler_node_dram_joules_total" ? $[2] : "0", $[0] = "kepler_node_uncore_joules_total" ? $[2] : "0", $[0] = "kepler_node_package_joules_total" ? $[2] : "0", $[0] = "kepler_node_gpu_joules_total" ? $[2] : "0", $[0] = "kepler_node_other_host_components_joules_total" ? $[2] : "0", $[2]]`,
  columns: [
    { id: "Node" },
    { id: "Core", type: "NUMBER" },
    { id: "DRAM", type: "NUMBER" },
    { id: "Uncore", type: "NUMBER" },
    { id: "Package", type: "NUMBER" },
    { id: "Other Host", type: "NUMBER" },
    { id: "GPU", type: "NUMBER" },
    { id: "Value", type: "NUMBER" },
  ],
}));

const monitoringDs = bind("monitoring", restSource("metrics", {
  cacheEnabled: true,
  accumulate: true,
  expression: `($now := $now() ~> $toMillis(); $[$[0] = "kepler_container_joules_total" and $[2] != "0"].[$replace($[1], /(.+)container_namespace="([0-9a-zA-Z-_]+)",(.+)/, "$2"), $replace($[1], /(.+)container_name="([0-9a-zA-Z-_]+)",(.+)/, "$2"), $[2], $now])`,
  columns: [
    { id: "Namespace" },
    { id: "Container" },
    { id: "Total", type: "NUMBER" },
    { id: "Timestamp", type: "NUMBER" },
  ],
}));

export default page("Kepler Metrics",
  // Index page
  title("Kepler Metrics"),
  tabs({ navGroupId: "Metrics", targetDivId: "Metrics_Div" }),
  div({ divId: "Metrics_Div" }),

  // Monitoring page
  columns({ margin: "10px", "margin-top": "30px" }, ["12"],
    [
      timeseries({
        lookup: lookup("monitoring", {
            type: "group",
            functions: [
              { source: "Container" },
              { source: "Timestamp" },
              { source: "Total" }
            ]
          }),
        filter: { listening: true },
        general: { title: "Joules by Container over time" },
        chart: { resizable: true, height: 400, legend: { show: true }, grid: { x: false } },
        extraConfiguration: `{ ".color": ["#6f634b", "#7a745d", "#9a9381", "#b2a59b", "#cec0b8", "#dec0bf"], "title": { "top": "auto", "right": "" } }`,
      })
    ]
  ),

  // Joules by Node page
  markdown("### **Filter**"),
  withStyle({ width: "160px" },
    selector({
      lookup: lookup("joules_by_node", {
          type: "group",
          groupingKey: { sourceId: "Node" },
          functions: [{ source: "Node" }]
        }),
      filter: { notification: true },
    })
  ),

  withStyle({ "margin-top": "30px", width: "330px", "text-align": "center" },
    metric({
      lookup: lookup("joules_by_node", {
          type: "group",
          functions: [{ source: "Value", function: "SUM" }]
        }),
      filter: { listening: true },
      general: { title: "Total Joules by Node" },
      columns: [{ id: "Total", pattern: "###,###.000" }],
      html: {
        html: `<div style="width: 95%;height: auto;margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;"><div class="pf-v5-c-card pf-m-compact pf-m-rounded"><div class="pf-v5-c-card__title"><div class="pf-v5-c-title pf-m-2xl">\${value}</div></div><div class="pf-v5-c-card__footer">\${title}</div></div></div>`
      },
      extraConfiguration: `{ ".color": ["#6f634b", "#7a745d", "#9a9381", "#b2a59b", "#cec0b8", "#dec0bf"], "title": { "top": "auto", "right": "" } }`,
    })
  ),

  withStyle({ "margin-top": "80px" },
    barChart({
      lookup: lookup("joules_by_node", {
          type: "group",
          groupingKey: { sourceId: "Node" },
          functions: [
            { source: "Node" },
            { source: "Package", function: "SUM" },
            { source: "Core", function: "SUM" },
            { source: "DRAM", function: "SUM" },
            { source: "Uncore", function: "SUM" },
            { source: "Other Host", function: "SUM" },
            { source: "GPU", function: "SUM" }
          ]
        }),
      filter: { listening: true },
      general: { title: "Joules by Node" },
      chart: { resizable: true, height: 400, legend: { show: true }, grid: { x: false } },
      extraConfiguration: `{ ".color": ["#6f634b", "#7a745d", "#9a9381", "#b2a59b", "#cec0b8", "#dec0bf"], "title": { "top": "auto", "right": "" } }`,
    })
  ),

  // Joules by Container page
  markdown("### **Filter**"),
  withStyle({ width: "160px" },
    selector({
      lookup: lookup("joules_by_container", {
          type: "group",
          groupingKey: { sourceId: "Container" },
          functions: [{ source: "Container" }]
        }),
      filter: { notification: true },
    })
  ),

  withStyle({ width: "160px", "margin-top": "10px" },
    selector({
      lookup: lookup("joules_by_container", {
          type: "group",
          groupingKey: { sourceId: "Pod" },
          functions: [{ source: "Pod" }]
        }),
      filter: { notification: true, listening: true },
    })
  ),

  withStyle({ "margin-top": "30px" },
    metric({
      lookup: lookup("joules_by_container", {
          type: "group",
          functions: [{ source: "Total", function: "SUM" }]
        }),
      filter: { listening: true },
      general: { title: "Total Joules by Container" },
      columns: [{ id: "Total", pattern: "###,###.000" }],
      html: {
        html: `<div style="width: 95%;height: auto;margin-top:0px;margin-right:0px;margin-bottom:0px;margin-left:0px;"><div class="pf-v5-c-card pf-m-compact pf-m-rounded"><div class="pf-v5-c-card__title"><div class="pf-v5-c-title pf-m-2xl">\${value}</div></div><div class="pf-v5-c-card__footer">\${title}</div></div></div>`
      },
      extraConfiguration: `{ ".color": ["#6f634b", "#7a745d", "#9a9381", "#b2a59b", "#cec0b8", "#dec0bf"], "title": { "top": "auto", "right": "" } }`,
    })
  ),

  withStyle({ "margin-top": "80px" },
    barChart({
      lookup: lookup("joules_by_container", {
          type: "group",
          groupingKey: { sourceId: "Container" },
          functions: [
            { source: "Container" },
            { source: "Package", function: "SUM" },
            { source: "Core", function: "SUM" },
            { source: "DRAM", function: "SUM" },
            { source: "Uncore", function: "SUM" },
            { source: "Other Host", function: "SUM" },
            { source: "GPU", function: "SUM" }
          ]
        }),
      filter: { listening: true },
      general: { title: "Joules by Container" },
      chart: { resizable: true, height: 400, legend: { show: true }, grid: { x: false } },
      extraConfiguration: `{ ".color": ["#6f634b", "#7a745d", "#9a9381", "#b2a59b", "#cec0b8", "#dec0bf"], "title": { "top": "auto", "right": "" } }`,
    })
  ),

  {
    mode: "dark",
    allowUrlProperties: true,
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
