import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType, dataSetId } from "@casehubio/pages-data";
import { page, bind, restSource, html, selector, metric, timeseries, barChart, pieChart, dataTable, columns, withStyle, lookup, filterBy, groupBy, col, count, sum } from "@casehubio/pages-ui";

const recentHttpRequestsDs = bind("recent_http_requests", restSource("${prometheusUrl}/api/v1/query?query=prometheus_http_requests_total[1m:1s]", dataSetId("recent_http_requests"), { type: "prometheus" }));
const httpRequestsDs = bind("http_requests", restSource("${prometheusUrl}/api/v1/query?query=prometheus_http_requests_total", dataSetId("http_requests"), { type: "prometheus" }));

export default page("Prometheus HTTP Requests",
  withStyle({ "background-color": "#1a1a2e", color: "white", padding: "16px 24px", "border-radius": "8px", "margin-bottom": "16px" },
    html(`<strong style="font-size: 20px; font-family: sans-serif;">Prometheus HTTP Requests</strong><br/><span style="opacity: 0.7; font-size: 13px;">Real-time HTTP endpoint monitoring</span>`)
  ),

  columns(
    [3],
    [
      html("Filter by Handler"),
      withStyle({ "font-weight": "bolder", "font-size": "13px", "margin-bottom": "4px" }, html("")),
      withStyle({ width: "100%" },
        selector({
          lookup: lookup("http_requests",
            groupBy("handler",
              col("handler"))),
          filter: { notification: true },
        })
      ),
    ]
  ),

  withStyle({ "margin-bottom": "24px" }, columns(
    [3, 3, 3, 3],
    [
      metric({
        lookup: lookup("http_requests", groupBy(null, sum("value"))),
        filter: { listening: true },
        title: "Total Requests",
        height: "90",
        columns: [{ id: "value" as ColumnId, pattern: "#,000" }],
      }),
    ],
    [
      withStyle({ color: "#2e7d32" },
        metric({
          lookup: lookup("http_requests",
            filterBy("code", "EQUALS_TO", 200),
            groupBy(null, sum("value"))),
          filter: { listening: true },
          title: "Success (2xx)",
          columns: [{ id: "value" as ColumnId, pattern: "#,000" }],
        })
      ),
    ],
    [
      withStyle({ color: "#d32f2f" },
        metric({
          lookup: lookup("http_requests",
            filterBy("code", "GREATER_THAN", 399),
            groupBy(null, sum("value"))),
          filter: { listening: true },
          title: "Errors (4xx/5xx)",
          columns: [{ id: "value" as ColumnId, pattern: "#,000" }],
        })
      ),
    ],
    [
      withStyle({ color: "#1565c0" },
        metric({
          lookup: lookup("http_requests",
            groupBy("handler",
              count("handler"))),
          filter: { listening: true },
          title: "Endpoints",
        })
      ),
    ]
  )),

  withStyle({ "margin-bottom": "24px" }, columns(
    [8, 4],
    [
      timeseries({
        lookup: lookup("recent_http_requests",
          filterBy("value", "GREATER_THAN", 0),
          groupBy(null,
            col("handler"),
            col("timestamp"),
            col("value"))),
        filter: { listening: true },
        title: "Request Volume Over Time",
        height: "350",
        resizable: true,
      }),
    ],
    [
      pieChart({
        subtype: "donut",
        lookup: lookup("http_requests",
          groupBy("handler",
            col("handler"),
            sum("value"))),
        filter: { listening: true },
        title: "Requests by Endpoint",
        height: "350",
        resizable: true,
      }),
    ]
  )),

  withStyle({ "margin-bottom": "24px" }, columns(
    [6, 6],
    [
      barChart({
        lookup: lookup("http_requests",
          groupBy("handler",
            col("handler"),
            sum("value"))),
        filter: { listening: true },
        title: "Requests by Handler",
        height: "300",
        resizable: true,
      }),
    ],
    [
      barChart({
        subtype: "bar",
        lookup: lookup("http_requests",
          groupBy("code",
            col("code"),
            sum("value"))),
        filter: { listening: true },
        title: "Requests by Status Code",
        height: "300",
        resizable: true,
        margin: { left: 80 },
      }),
    ]
  )),

  dataTable({
    lookup: lookup("http_requests"),
    filter: { listening: true },
    title: "Request Details",
    sortable: true,
  }),
  {
    properties: { prometheusUrl: "http://localhost:9090", refreshInterval: "2" },
    datasets: [recentHttpRequestsDs, httpRequestsDs],
  }
);
