// @ts-nocheck
import { page, bind, restSource, html, metric, timeseries, areaChart, barChart, pieChart, table, columns, withStyle, lookup } from "@casehubio/pages-ui";

const prometheusDs = bind("prometheus", restSource("${prometheusUrl}/api/v1/query?query=${query}", { type: "prometheus" }));
const prometheusInstantDs = bind("prometheus_instant", restSource("${prometheusUrl}/api/v1/query?query=prometheus_http_requests_total", { type: "prometheus" }));

export default page("Prometheus Basic",
  withStyle({ "background-color": "#e65100", color: "white", padding: "16px 24px", "border-radius": "8px", "margin-bottom": "16px" },
    html(`<strong style="font-size: 20px; font-family: sans-serif;">Prometheus Metrics Explorer</strong><br/><span style="opacity: 0.8; font-size: 13px;">Query: <code>\${query}</code> &middot; Source: <code>\${prometheusUrl}</code></span>`)
  ),

  columns(
    { "margin-bottom": "24px" },
    ["3", "3", "3", "3"],
    [
      metric({
        lookup: lookup("prometheus", { type: "group", functions: [{ source: "value", function: "COUNT" }] }),
        general: { title: "Data Points" },
      }),
    ],
    [
      withStyle({ color: "#e65100" },
        metric({
          lookup: lookup("prometheus", { type: "group", functions: [{ source: "value", function: "MAX" }] }),
          general: { title: "Max Value" },
          columns: [{ id: "value", pattern: "#,000" }],
        })
      ),
    ],
    [
      withStyle({ color: "#2e7d32" },
        metric({
          lookup: lookup("prometheus", { type: "group", functions: [{ source: "value", function: "MIN" }] }),
          general: { title: "Min Value" },
          columns: [{ id: "value", pattern: "#,000" }],
        })
      ),
    ],
    [
      withStyle({ color: "#1565c0" },
        metric({
          lookup: lookup("prometheus", { type: "group", functions: [{ source: "value", function: "AVERAGE" }] }),
          general: { title: "Average" },
          columns: [{ id: "value", pattern: "#,000.00" }],
        })
      ),
    ]
  ),

  columns(
    { "margin-bottom": "24px" },
    ["12"],
    [
      timeseries({
        lookup: lookup("prometheus", { type: "group", functions: [
          { source: "__name__" },
          { source: "timestamp" },
          { source: "value" },
        ] }),
        general: { title: "Metric Values Over Time" },
        chart: { height: 350, resizable: true },
      }),
    ]
  ),

  columns(
    { "margin-bottom": "24px" },
    ["6", "6"],
    [
      areaChart({
        lookup: lookup("prometheus", { type: "group", functions: [
          { source: "handler" },
          { source: "timestamp" },
          { source: "value" },
        ] }),
        general: { title: "Value Distribution (Area)" },
        chart: { height: 280, resizable: true },
      }),
    ],
    [
      barChart({
        lookup: lookup("prometheus_instant", {
          type: "group",
          groupingKey: { sourceId: "handler" },
          functions: [
            { source: "handler" },
            { source: "value", function: "SUM" },
          ],
        }),
        general: { title: "Total by Endpoint" },
        chart: { height: 280, resizable: true },
      }),
    ]
  ),

  columns(
    {},
    ["4", "8"],
    [
      pieChart({
        lookup: lookup("prometheus_instant", {
          type: "group",
          groupingKey: { sourceId: "method" },
          functions: [
            { source: "method" },
            { source: "value", function: "SUM" },
          ],
        }),
        general: { title: "Request Share by Method" },
        chart: { height: 300, resizable: true },
      }),
    ],
    [
      table({
        lookup: lookup("prometheus"),
        general: { title: "Raw Metrics" },
        table: { sort: { enabled: true }, show_column_picker: true },
      }),
    ]
  ),
  {
    properties: { prometheusUrl: "http://localhost:9090", query: "go_gc_heap_live_bytes[1m:1s]" },
    datasets: [prometheusDs, prometheusInstantDs],
  }
);
