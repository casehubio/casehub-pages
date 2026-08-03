import {
  page, bind, inlineSource, html, metric, meter, tabs, rows, withStyle, lookup, groupBy, col, sum} from "@casehubio/pages-ui";
import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType } from "@casehubio/pages-data";

// Datasets
const productsData = [
  ["Computers", "Scanner", 5, 3],
  ["Computers", "Printer", 7, 4],
  ["Computers", "Laptop", 3, 2],
  ["Electronics", "Camera", 10, 7],
  ["Electronics", "Headphones", 5, 9]
];

const productsDs = bind("products", inlineSource(productsData, {
  columns: [
    { id: "Section" as ColumnId, type: ColumnType.LABEL },
    { id: "Product" as ColumnId, type: ColumnType.LABEL },
    { id: "Quantity" as ColumnId, type: ColumnType.NUMBER },
    { id: "Quantity2" as ColumnId, type: ColumnType.NUMBER }
  ]
}));

const memoryData = [
  ["Server 1", 2512],
  ["Server 2", 1900],
  ["Server 3", 3200],
  ["Server 4", 1200]
];

const memoryUsageDs = bind("memory_usage", inlineSource(memoryData, {
  columns: [
    { id: "Server" as ColumnId, type: ColumnType.LABEL },
    { id: "Usage" as ColumnId, type: ColumnType.NUMBER }
  ]
}));

function metricPage() {
  return rows(
    html("Metric components render an HTML template based on data. Users can customize the HTML and Javascript based on data."),
    html("<h4><strong>Default Metric</strong></h4><br />"),
    metric({
      title: "Total Products",
      height: "100",
      width: "150",
      lookup: lookup("products", groupBy(null, sum("Quantity")))
    }),
    withStyle(
      { marginTop: "20px", marginBottom: "20px" },
      html("The following metric uses custom HTML and Javascript template:")
    ),
    withStyle(
      { border: "solid 1px" },
      metric({
        title: "Total Products",
        html: {
          template: '<h2><strong>&#10026; Total Products:</strong>&nbsp;<span id="${this}">${value}</span></h2>',
          javascript: `
          \${this}.onmouseover = function() {
            \${this}.style.color = "red";
          };
          \${this}.onmouseout = function() {
            \${this}.style.color = "black";
          };
        `
        },
        lookup: lookup("products", groupBy(null, sum("Quantity")))
      })
    )
  );
}

function meterPage() {
  return withStyle(
    { fontSize: "x-large", textAlign: "center" },
    withStyle(
      { float: "left" },
      meter({
        title: "Memory Usage",
        resizable: false,
        legend: { show: true, position: "bottom" },
        end: 4120,
        critical: 3000,
        warning: 2000,
        lookup: lookup("memory_usage", groupBy("Server", col("Server")))
      })
    )
  );
}

export default page(
  "Metrics and Gauges",
  tabs(
    ["Metric", metricPage()],
    ["Meter", meterPage()]
  ),
  { datasets: [productsDs, memoryUsageDs] });
