import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType, dataSetId } from "@casehubio/pages-data";
import { page, bind, restSource, html, metric, barChart, selector, columns, withStyle, lookup, filterBy, groupBy, sum, count, col, sortBy } from "@casehubio/pages-ui";

const metricsDs = bind("metrics", restSource("${metricsUrl}", dataSetId("metrics"), {
  columns: [
    { id: "metric" as ColumnId, type: ColumnType.LABEL },
    { id: "labels" as ColumnId, type: ColumnType.LABEL },
    { id: "value" as ColumnId, type: ColumnType.NUMBER },
  ],
}));

export default page("Triton Inference Server Model Metrics",
  // Header
  html("Triton Inference Server <hr />"),

  // Metrics row
  columns([3, 3, 3, 3],
    [
      metric({
        lookup: lookup("metrics",
          filterBy("metric", "EQUALS_TO", "nv_inference_count"),
          groupBy(null, count("labels"))),
        title: "Running Models",
        columns: [{ id: "labels" as ColumnId, pattern: "#" }],
      })
    ],
    [
      metric({
        lookup: lookup("metrics",
          filterBy("metric", "EQUALS_TO", "nv_inference_count"),
          groupBy(null, sum("value"))),
        title: "Inference Count",
        visible: true,
        columns: [{ id: "value" as ColumnId, pattern: "#" }],
      })
    ],
    [
      metric({
        lookup: lookup("metrics",
          filterBy("metric", "EQUALS_TO", "nv_inference_request_success"),
          groupBy(null, sum("value"))),
        title: "Inference Requests Success",
        visible: true,
        columns: [{ id: "value" as ColumnId, pattern: "#" }],
      })
    ],
    [
      metric({
        lookup: lookup("metrics",
          filterBy("metric", "EQUALS_TO", "nv_inference_request_failure"),
          groupBy(null, sum("value"))),
        title: "Inference Requests Failure",
        visible: true,
        columns: [{ id: "value" as ColumnId, pattern: "#" }],
      })
    ]
  ),

  // Filter
  withStyle({ width: "220px", "margin-top": "20px" }, html("<strong>Filter by Model</strong>")),
  selector({
    lookup: lookup("metrics",
      filterBy("metric", "EQUALS_TO", "nv_inference_count"),
      groupBy("labels", col("labels"))),
    filter: { notification: true },
    columns: [{
      id: "model" as ColumnId,
      expression: `value.replaceAll("\"", "").replaceAll("model=", "").replaceAll("version=", "").replaceAll(",", " v")`,
    }],
  }),

  // Charts row 1
  withStyle({ "margin-top": "20px" }, columns([4, 4, 4],
    [
      barChart({
        lookup: lookup("metrics",
          filterBy("metric", "EQUALS_TO", "nv_inference_count"),
          filterBy("value", "GREATER_THAN", 0),
          sortBy("value", "DESCENDING"),
          groupBy("labels", col("labels"), sum("value"))),
        filter: { listening: true },
        title: "Inference Count",
        resizable: true,
        columns: [
          {
            id: "labels" as ColumnId,
            expression: `value.replaceAll("\"", "").replaceAll("model=", "").replaceAll("version=", "").replaceAll(",", " v")`,
          },
          { id: "value" as ColumnId, pattern: "#" },
        ],
      })
    ],
    [
      barChart({
        lookup: lookup("metrics",
          filterBy("metric", "EQUALS_TO", "nv_inference_request_success"),
          filterBy("value", "GREATER_THAN", 0),
          sortBy("value", "DESCENDING"),
          groupBy("labels", col("labels"), sum("value"))),
        filter: { listening: true },
        title: "Sucessful Inferences",
        resizable: true,
        columns: [
          {
            id: "labels" as ColumnId,
            expression: `value.replaceAll("\"", "").replaceAll("model=", "").replaceAll("version=", "").replaceAll(",", " v")`,
          },
          { id: "value" as ColumnId, pattern: "#" },
        ],
      })
    ],
    [
      barChart({
        lookup: lookup("metrics",
          filterBy("metric", "EQUALS_TO", "nv_inference_request_failure"),
          filterBy("value", "GREATER_THAN", 0),
          sortBy("value", "DESCENDING"),
          groupBy("labels", col("labels"), sum("value"))),
        filter: { listening: true },
        title: "Failed Inferences",
        resizable: true,
        columns: [
          {
            id: "labels" as ColumnId,
            expression: `value.replaceAll("\"", "").replaceAll("model=", "").replaceAll("version=", "").replaceAll(",", " v")`,
          },
          { id: "value" as ColumnId, pattern: "#" },
        ],
      })
    ]
  )),

  // Charts row 2 - Duration metrics
  withStyle({ "margin-top": "20px" }, columns([4, 4, 4],
    [
      barChart({
        lookup: lookup("metrics",
          filterBy("metric", "EQUALS_TO", "nv_inference_request_duration_us"),
          sortBy("value", "DESCENDING"),
          groupBy("labels", col("labels"), col("value"))),
        filter: { listening: true },
        title: "Inference Request Duration",
        resizable: true,
        xAxis: { labelAngle: 15 },
        columns: [{
          id: "labels" as ColumnId,
          expression: `value.replaceAll("\"", "").replaceAll("model=", "").replaceAll("version=", "").replaceAll(",", " v")`,
        }],
      })
    ],
    [
      barChart({
        lookup: lookup("metrics",
          filterBy("metric", "EQUALS_TO", "nv_inference_compute_infer_duration_us"),
          filterBy("value", "GREATER_THAN", 0),
          sortBy("value", "DESCENDING"),
          groupBy("labels", col("labels"), col("value"))),
        filter: { listening: true },
        title: "Inference Total Duration",
        resizable: true,
        columns: [{
          id: "labels" as ColumnId,
          expression: `value.replaceAll("\"", "").replaceAll("model=", "").replaceAll("version=", "").replaceAll(",", " v")`,
        }],
      })
    ],
    [
      barChart({
        lookup: lookup("metrics",
          filterBy("metric", "EQUALS_TO", "nv_inference_queue_duration_us"),
          filterBy("value", "GREATER_THAN", 0),
          sortBy("value", "DESCENDING"),
          groupBy("labels", col("labels"), col("value"))),
        filter: { listening: true },
        title: "Queue Wait",
        resizable: true,
        columns: [{
          id: "labels" as ColumnId,
          expression: `value.replaceAll("\"", "").replaceAll("model=", "").replaceAll("version=", "").replaceAll(",", " v")`,
        }],
      })
    ]
  )),
  {
    properties: { metricsUrl: "data/triton/metrics" },
    datasets: [metricsDs],
  });
