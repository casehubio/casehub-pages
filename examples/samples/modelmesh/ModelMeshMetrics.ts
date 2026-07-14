import { page, bind, restSource, html, metric, barChart, columns, lookup} from "@casehubio/pages-ui";

import type { DataSetId, ColumnId } from "@casehubio/pages-data";

// TypeScript companion to "ModelMeshMetrics.dash.yaml"
// ModelMesh serving metrics with custom card styling

const metricsDs = bind("metrics", restSource("${modelMeshMetricsUrl}", {;
const requestResponseSizeDs = bind("request_response_size", restSource("${modelMeshMetricsUrl}", {;
const jvmMemoryDs = bind("jvm_memory", restSource("${modelMeshMetricsUrl}", {;

export default page(
  {
    modelMeshMetricsUrl: "metrics",
    titleFontSize: "40px",
  },
  {
    mode: "dark",
    displayer: {
      axis: { x: { labels_angle: 12 } },
      columns: [{ id: "value" as ColumnId, pattern: "#" }],
      lookup: { uuid: "metrics" as DataSetId },
      html: {
        html: `<div id="\${this}" class="card-pf card-pf-aggregate-status" style="background-color: \${bgColor}; width: 90%; height: 90px;margin: 10px; border-radius: 10px">
<h2 style="font-weight: 600; font-size: x-large" id="\${this}Value">\${value} <span id="\${this}Suffix" class=""></span></h2>
<p style="font-weight: 400; font-size: large" id="\${this}Title"><em id="\${this}Icon" class=""></em> \${title}</p>
</div>`
      },
    },
  },
  [
      columns: [
        { id: "metric" as ColumnId, type: "LABEL" },
        { id: "labels" as ColumnId, type: "LABEL" },
        { id: "value" as ColumnId, type: "number" },
      ]
    })),
      // Complex JSONata expression calculating average request/response sizes
      expression: `($requestSize := $number($[$[0] = "modelmesh_request_size_bytes_sum"][0][2]); $requestCount := $number($[$[0] = "modelmesh_request_size_bytes_count"][0][2]); $responseSize := $number($[$[0] = "modelmesh_response_size_bytes_sum"][0][2]); $responseCount := $number($[$[0] = "modelmesh_response_size_bytes_count"][0][2]); [ "Size", $requestSize / $requestCount,  $responseSize / $responseCount])`,
      columns: [
        { id: "Metric" as ColumnId, type: "LABEL" },
        { id: "Request" as ColumnId, type: "number" },
        { id: "Response" as ColumnId, type: "number" },
      ]
    })),
      // Complex JSONata expression for JVM memory pool metrics
      expression: `($metrics := $[$[0] in ["jvm_memory_pool_bytes_used", "jvm_memory_pool_bytes_committed"]].[ { "metric": $[0], "label": $[1], "value": $[2] } ]; $map($distinct($metrics.label), function($l) { ($used := $metrics[label = $l and metric = "jvm_memory_pool_bytes_used"].value; $committed := $metrics[label = $l and metric = "jvm_memory_pool_bytes_committed"].value; [$l, $used ?  $used : "-1", $committed ?  $committed : -1]) }))`,
      columns: [
        { id: "Pool" as ColumnId, type: "LABEL" },
        { id: "Used" as ColumnId, type: "number" },
        { id: "Committed" as ColumnId, type: "number" },
      ]
    })),
  ],
  [
    // Header
    html(`<p>Model Mesh Metrics</p> <hr />`),
    // Note: Original has properties: { "font-size": "\${titleFontSize}" }

    // Metrics row
    columns({ padding: "10px" }, ["3", "3", "3", "3"],
      [
        metric({
          lookup: lookup("metrics" as DataSetId, { type: "filter", column: "metric" as ColumnId, function: "EQUALS_TO", args: ["modelmesh_models_managed_total"] },
            { type: "group", functions: [{ source: "value" as ColumnId }] }),
          general: { title: "Managed Models" },
        })
      ],
      [
        metric({
          lookup: lookup("metrics" as DataSetId, { type: "filter", column: "metric" as ColumnId, function: "EQUALS_TO", args: ["modelmesh_models_with_failure_total"] },
            { type: "group", functions: [{ source: "value" as ColumnId }] }),
          general: { title: "Models with Failure" },
        })
      ],
      [
        metric({
          lookup: lookup("metrics" as DataSetId, { type: "filter", column: "metric" as ColumnId, function: "EQUALS_TO", args: ["modelmesh_loadmodel_milliseconds_sum"] },
            { type: "group", functions: [{ source: "value" as ColumnId }] }),
          general: { title: "Load Model (ms)" },
        })
      ],
      [
        metric({
          lookup: lookup("metrics" as DataSetId, { type: "filter", column: "metric" as ColumnId, function: "EQUALS_TO", args: ["modelmesh_loaded_model_size_bytes_sum"] },
            { type: "group", functions: [{ source: "value" as ColumnId, column: "value_kb" as ColumnId }] }),
          general: { title: "Models Size (kb)" },
          columns: [{ id: "value_kb" as ColumnId, pattern: "#", expression: "value / 1024" }],
        })
      ]
    ),

    html("<hr />"),

    // JVM Memory section
    html(`<p style="font-size: 25px; font-weight: 600"> JVM Memory </p>`),

    barChart({
      lookup: lookup("jvm_memory" as DataSetId, {
          type: "group",
          groupingKey: { sourceId: "Pool" as ColumnId },
          functions: [
            { source: "Pool" as ColumnId },
            { source: "Used" as ColumnId },
            { source: "Committed" as ColumnId }
          ]
        }),
      chart: { resizable: true, height: 400, grid: { x: false } },
      extraConfiguration: `{ "color": ["#007090", "#009040", "#e0a000", "#a02020"] }`,
      columns: [{ id: "Pool" as ColumnId, expression: `value.replace("pool=\\"", "").replace("\\",", "")` }],
    })
  ],
  { datasets: [metricsDs, requestResponseSizeDs, jvmMemoryDs] });
