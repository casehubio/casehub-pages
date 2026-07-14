// @ts-nocheck
import { page, bind, restSource, html, selector, metric, timeseries, barChart, pieChart, table, columns, withStyle, lookup } from "@casehubio/pages-ui";

const recentHttpRequestsDs = bind("recent_http_requests", restSource("${prometheusUrl}/api/v1/query?query=prometheus_http_requests_total[1m:1s]", { type: "prometheus" }));
const httpRequestsDs = bind("http_requests", restSource("${prometheusUrl}/api/v1/query?query=prometheus_http_requests_total", { type: "prometheus" }));

export default page("Prometheus HTTP Requests",
  withStyle({ "background-color": "#1a1a2e", color: "white", padding: "16px 24px", "border-radius": "8px", "margin-bottom": "16px" },
    html(`<strong style="font-size: 20px; font-family: sans-serif;">Prometheus HTTP Requests</strong><br/><span style="opacity: 0.7; font-size: 13px;">Real-time HTTP endpoint monitoring</span>`)
  ),

  columns(
    { "margin-bottom": "12px" },
    ["3"],
    [
      html("Filter by Handler"),
      withStyle({ "font-weight": "bolder", "font-size": "13px", "margin-bottom": "4px" }, html("")),
      withStyle({ width: "100%" },
        selector({
          lookup: lookup("http_requests", {
            type: "group",
            groupingKey: { sourceId: "handler" },
            functions: [{ source: "handler" }],
          }),
          filter: { notification: "true" },
        })
      ),
    ]
  ),

  columns(
    { "margin-bottom": "24px" },
    ["3", "3", "3", "3"],
    [
      metric({
        lookup: lookup("http_requests", { type: "group", functions: [{ source: "value", function: "SUM" }] }),
        filter: { listening: "true" },
        general: { title: "Total Requests" },
        chart: { height: "90" },
        columns: [{ id: "value", pattern: "#,000" }],
      }),
    ],
    [
      withStyle({ color: "#2e7d32" },
        metric({
          lookup: lookup("http_requests",
            { type: "filter", column: "code", function: "EQUALS_TO", args: [200] },
            { type: "group", functions: [{ source: "value", function: "SUM" }] }),
          filter: { listening: "true" },
          general: { title: "Success (2xx)" },
          columns: [{ id: "value", pattern: "#,000" }],
        })
      ),
    ],
    [
      withStyle({ color: "#d32f2f" },
        metric({
          lookup: lookup("http_requests",
            { type: "filter", column: "code", function: "GREATER_THAN", args: [399] },
            { type: "group", functions: [{ source: "value", function: "SUM" }] }),
          filter: { listening: "true" },
          general: { title: "Errors (4xx/5xx)" },
          columns: [{ id: "value", pattern: "#,000" }],
        })
      ),
    ],
    [
      withStyle({ color: "#1565c0" },
        metric({
          lookup: lookup("http_requests", {
            type: "group",
            groupingKey: { sourceId: "handler" },
            functions: [{ source: "handler", function: "COUNT" }],
          }),
          filter: { listening: "true" },
          general: { title: "Endpoints" },
        })
      ),
    ]
  ),

  columns(
    { "margin-bottom": "24px" },
    ["8", "4"],
    [
      timeseries({
        lookup: lookup("recent_http_requests",
          { type: "filter", column: "value", function: "GREATER_THAN", args: [0] },
          {
            type: "group",
            functions: [
              { source: "handler" },
              { source: "timestamp" },
              { source: "value" },
            ],
          }),
        filter: { listening: "true" },
        general: { title: "Request Volume Over Time" },
        chart: { height: 350, resizable: true },
      }),
    ],
    [
      pieChart({
        type: "DONUT",
        lookup: lookup("http_requests", {
          type: "group",
          groupingKey: { sourceId: "handler" },
          functions: [
            { source: "handler" },
            { source: "value", function: "SUM" },
          ],
        }),
        filter: { listening: "true" },
        general: { title: "Requests by Endpoint" },
        chart: { height: 350, resizable: true },
      }),
    ]
  ),

  columns(
    { "margin-bottom": "24px" },
    ["6", "6"],
    [
      barChart({
        lookup: lookup("http_requests", {
          type: "group",
          groupingKey: { sourceId: "handler" },
          functions: [
            { source: "handler" },
            { source: "value", function: "SUM" },
          ],
        }),
        filter: { listening: "true" },
        general: { title: "Requests by Handler" },
        chart: { height: 300, resizable: true },
      }),
    ],
    [
      barChart({
        subtype: "BAR",
        lookup: lookup("http_requests", {
          type: "group",
          groupingKey: { sourceId: "code" },
          functions: [
            { source: "code" },
            { source: "value", function: "SUM" },
          ],
        }),
        filter: { listening: "true" },
        general: { title: "Requests by Status Code" },
        chart: { height: 300, resizable: true, margin: { left: 80 } },
      }),
    ]
  ),

  table({
    lookup: lookup("http_requests"),
    filter: { listening: "true" },
    general: { title: "Request Details" },
    table: { sort: { enabled: true }, show_column_picker: true },
  }),
  {
    properties: { prometheusUrl: "http://localhost:9090", refreshInterval: "2" },
    datasets: [recentHttpRequestsDs, httpRequestsDs],
  }
);
