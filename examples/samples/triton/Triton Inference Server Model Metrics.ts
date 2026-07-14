// @ts-nocheck
import { page, bind, restSource, html, metric, barChart, selector, columns, withStyle, lookup } from "@casehubio/pages-ui";

const metricsDs = bind("metrics", restSource("${metricsUrl}", {
  columns: [
    { id: "metric", type: "LABEL" },
    { id: "labels", type: "LABEL" },
    { id: "value", type: "NUMBER" },
  ],
}));

export default page("Triton Inference Server Model Metrics",
  // Header
  html("Triton Inference Server <hr />"),

  // Metrics row
  columns({}, ["3", "3", "3", "3"],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["nv_inference_count"] },
          { type: "group", functions: [{ source: "labels", function: "COUNT" }] }),
        general: { title: "Running Models" },
        columns: [{ id: "labels", pattern: "#" }],
      })
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["nv_inference_count"] },
          { type: "group", functions: [{ source: "value", function: "SUM" }] }),
        general: { title: "Inference Count", visible: "true" },
        columns: [{ id: "value", pattern: "#" }],
      })
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["nv_inference_request_success"] },
          { type: "group", functions: [{ source: "value", function: "SUM" }] }),
        general: { title: "Inference Requests Success", visible: "true" },
        columns: [{ id: "value", pattern: "#" }],
      })
    ],
    [
      metric({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["nv_inference_request_failure"] },
          { type: "group", functions: [{ source: "value", function: "SUM" }] }),
        general: { title: "Inference Requests Failure", visible: "true" },
        columns: [{ id: "value", pattern: "#" }],
      })
    ]
  ),

  // Filter
  withStyle({ width: "220px", "margin-top": "20px" }, html("<strong>Filter by Model</strong>")),
  selector({
    lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["nv_inference_count"] },
      {
        type: "group",
        groupingKey: { sourceId: "labels" },
        functions: [{ source: "labels", column: "model" }],
      }),
    filter: { notification: "true" },
    columns: [{
      id: "model",
      expression: `value.replaceAll("\\"", "").replaceAll("model=", "").replaceAll("version=", "").replaceAll(",", " v")`,
    }],
  }),

  // Charts row 1
  columns({ "margin-top": "20px" }, ["4", "4", "4"],
    [
      barChart({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["nv_inference_count"] },
          { type: "filter", column: "value", function: "GREATER_THAN", args: [0] },
          { type: "sort", column: "value", sortOrder: "DESCENDING" },
          {
            type: "group",
            groupingKey: { sourceId: "labels" },
            functions: [
              { source: "labels" },
              { source: "value", function: "SUM" },
            ],
          }),
        filter: { listening: "true" },
        general: { title: "Inference Count" },
        chart: { resizable: true },
        columns: [
          {
            id: "labels",
            expression: `value.replaceAll("\\"", "").replaceAll("model=", "").replaceAll("version=", "").replaceAll(",", " v")`,
          },
          { id: "value", pattern: "#" },
        ],
      })
    ],
    [
      barChart({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["nv_inference_request_success"] },
          { type: "filter", column: "value", function: "GREATER_THAN", args: [0] },
          { type: "sort", column: "value", sortOrder: "DESCENDING" },
          {
            type: "group",
            groupingKey: { sourceId: "labels" },
            functions: [
              { source: "labels" },
              { source: "value", function: "SUM" },
            ],
          }),
        filter: { listening: "true" },
        general: { title: "Sucessful Inferences" },
        chart: { resizable: true },
        columns: [
          {
            id: "labels",
            expression: `value.replaceAll("\\"", "").replaceAll("model=", "").replaceAll("version=", "").replaceAll(",", " v")`,
          },
          { id: "value", pattern: "#" },
        ],
      })
    ],
    [
      barChart({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["nv_inference_request_failure"] },
          { type: "filter", column: "value", function: "GREATER_THAN", args: [0] },
          { type: "sort", column: "value", sortOrder: "DESCENDING" },
          {
            type: "group",
            groupingKey: { sourceId: "labels" },
            functions: [
              { source: "labels" },
              { source: "value", function: "SUM" },
            ],
          }),
        filter: { listening: "true" },
        general: { title: "Failed Inferences" },
        chart: { resizable: true },
        columns: [
          {
            id: "labels",
            expression: `value.replaceAll("\\"", "").replaceAll("model=", "").replaceAll("version=", "").replaceAll(",", " v")`,
          },
          { id: "value", pattern: "#" },
        ],
      })
    ]
  ),

  // Charts row 2 - Duration metrics
  columns({ "margin-top": "20px" }, ["4", "4", "4"],
    [
      barChart({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["nv_inference_request_duration_us"] },
          { type: "sort", column: "value", sortOrder: "DESCENDING" },
          {
            type: "group",
            groupingKey: { sourceId: "labels" },
            functions: [
              { source: "labels" },
              { source: "value", column: "Duration" },
            ],
          }),
        filter: { listening: "true" },
        general: { title: "Inference Request Duration" },
        chart: { resizable: true },
        axis: { x: { labels_angle: 15 } },
        columns: [{
          id: "labels",
          expression: `value.replaceAll("\\"", "").replaceAll("model=", "").replaceAll("version=", "").replaceAll(",", " v")`,
        }],
      })
    ],
    [
      barChart({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["nv_inference_compute_infer_duration_us"] },
          { type: "filter", column: "value", function: "GREATER_THAN", args: [0] },
          { type: "sort", column: "value", sortOrder: "DESCENDING" },
          {
            type: "group",
            groupingKey: { sourceId: "labels" },
            functions: [
              { source: "labels" },
              { source: "value", column: "Duration" },
            ],
          }),
        filter: { listening: "true" },
        general: { title: "Inference Total Duration" },
        chart: { resizable: true },
        columns: [{
          id: "labels",
          expression: `value.replaceAll("\\"", "").replaceAll("model=", "").replaceAll("version=", "").replaceAll(",", " v")`,
        }],
      })
    ],
    [
      barChart({
        lookup: lookup("metrics", { type: "filter", column: "metric", function: "EQUALS_TO", args: ["nv_inference_queue_duration_us"] },
          { type: "filter", column: "value", function: "GREATER_THAN", args: [0] },
          { type: "sort", column: "value", sortOrder: "DESCENDING" },
          {
            type: "group",
            groupingKey: { sourceId: "labels" },
            functions: [
              { source: "labels" },
              { source: "value", column: "Duration" },
            ],
          }),
        filter: { listening: "true" },
        general: { title: "Queue Wait" },
        chart: { resizable: true },
        columns: [{
          id: "labels",
          expression: `value.replaceAll("\\"", "").replaceAll("model=", "").replaceAll("version=", "").replaceAll(",", " v")`,
        }],
      })
    ]
  ),
  {
    properties: { metricsUrl: "data/triton/metrics" },
    datasets: [metricsDs],
  });
