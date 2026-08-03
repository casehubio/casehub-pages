import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType, dataSetId } from "@casehubio/pages-data";
import { page, bind, restSource, html, metric, timeseries, areaChart, barChart, pieChart, dataTable, columns, withStyle, lookup, groupBy, col, count, max, min, avg, sum } from "@casehubio/pages-ui";

const prometheusDs = bind("prometheus", restSource("${prometheusUrl}/api/v1/query?query=${query}", dataSetId("prometheus"), { type: "prometheus" }));
const prometheusInstantDs = bind("prometheus_instant", restSource("${prometheusUrl}/api/v1/query?query=prometheus_http_requests_total", dataSetId("prometheus_instant"), { type: "prometheus" }));

export default page("Prometheus Basic",
  withStyle({ "background-color": "#e65100", color: "white", padding: "16px 24px", "border-radius": "8px", "margin-bottom": "16px" },
    html(`<strong style="font-size: 20px; font-family: sans-serif;">Prometheus Metrics Explorer</strong><br/><span style="opacity: 0.8; font-size: 13px;">Query: <code>\${query}</code> &middot; Source: <code>\${prometheusUrl}</code></span>`)
  ),

  withStyle({ "margin-bottom": "24px" }, columns(
    [3, 3, 3, 3],
    [
      metric({
        lookup: lookup("prometheus", groupBy(null, count("value"))),
        title: "Data Points",
      }),
    ],
    [
      withStyle({ color: "#e65100" },
        metric({
          lookup: lookup("prometheus", groupBy(null, max("value"))),
          title: "Max Value",
          columns: [{ id: "value" as ColumnId, pattern: "#,000" }],
        })
      ),
    ],
    [
      withStyle({ color: "#2e7d32" },
        metric({
          lookup: lookup("prometheus", groupBy(null, min("value"))),
          title: "Min Value",
          columns: [{ id: "value" as ColumnId, pattern: "#,000" }],
        })
      ),
    ],
    [
      withStyle({ color: "#1565c0" },
        metric({
          lookup: lookup("prometheus", groupBy(null, avg("value"))),
          title: "Average",
          columns: [{ id: "value" as ColumnId, pattern: "#,000.00" }],
        })
      ),
    ]
  )),

  withStyle({ "margin-bottom": "24px" }, columns(
    [12],
    [
      timeseries({
        lookup: lookup("prometheus", groupBy(null,
          col("__name__"),
          col("timestamp"),
          col("value"))),
        title: "Metric Values Over Time",
        height: "350",
        resizable: true,
      }),
    ]
  )),

  withStyle({ "margin-bottom": "24px" }, columns(
    [6, 6],
    [
      areaChart({
        lookup: lookup("prometheus", groupBy(null,
          col("handler"),
          col("timestamp"),
          col("value"))),
        title: "Value Distribution (Area)",
        height: "280",
        resizable: true,
      }),
    ],
    [
      barChart({
        lookup: lookup("prometheus_instant",
          groupBy("handler",
            col("handler"),
            sum("value"))),
        title: "Total by Endpoint",
        height: "280",
        resizable: true,
      }),
    ]
  )),

  columns(
    [4, 8],
    [
      pieChart({
        lookup: lookup("prometheus_instant",
          groupBy("method",
            col("method"),
            sum("value"))),
        title: "Request Share by Method",
        height: "300",
        resizable: true,
      }),
    ],
    [
      dataTable({
        lookup: lookup("prometheus"),
        title: "Raw Metrics",
        sortable: true,
      }),
    ]
  ),
  {
    properties: { prometheusUrl: "http://localhost:9090", query: "go_gc_heap_live_bytes[1m:1s]" },
    datasets: [prometheusDs, prometheusInstantDs],
  }
);
