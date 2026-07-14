import {
  page, bind, inlineSource, barChart, lineChart, areaChart, pieChart, bubbleChart, timeseries,
  tabs, rows, columns, html, lookup, groupBy, col} from "@casehubio/pages-ui";

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
    { id: "Section", type: "LABEL" },
    { id: "Product", type: "LABEL" },
    { id: "Quantity", type: "NUMBER" },
    { id: "Quantity2", type: "NUMBER" }
  ]
}));

const timeseriesData = [
  ["2024-01-01", 120, 80],
  ["2024-02-01", 135, 95],
  ["2024-03-01", 150, 110],
  ["2024-04-01", 140, 105],
  ["2024-05-01", 165, 120],
  ["2024-06-01", 180, 130],
  ["2024-07-01", 175, 125],
  ["2024-08-01", 190, 140],
  ["2024-09-01", 200, 155],
  ["2024-10-01", 210, 160],
  ["2024-11-01", 195, 150],
  ["2024-12-01", 220, 170]
];

const timeseriesDs = bind("timeseries", inlineSource(timeseriesData, {
  columns: [
    { id: "Date", type: "DATE" },
    { id: "Series A", type: "NUMBER" },
    { id: "Series B", type: "NUMBER" }
  ]
}));

// Reusable lookup for product charts (Product, Quantity, Quantity2)
function productLookup() {
  return lookup("products", groupBy("Product", col("Product"), col("Quantity"), col("Quantity2")));
}

// Reusable lookup for pie charts (Product, Quantity only)
function pieLookup() {
  return lookup("products", groupBy("Product", col("Product"), col("Quantity")));
}

function barChartPage() {
  return rows(
    columns(
      [6],
      [
        barChart({
          title: "subtype COLUMN (default)",
          resizable: true,
          lookup: productLookup()
        })
      ],
      [6],
      [
        barChart({
          subtype: "bar",
          title: "subtype BAR",
          margin: { left: 80 },
          resizable: true,
          lookup: productLookup()
        })
      ]
    ),
    columns(
      [6],
      [
        barChart({
          subtype: "column_stacked",
          title: "subtype COLUMN_STACKED",
          resizable: true,
          lookup: productLookup()
        })
      ],
      [6],
      [
        barChart({
          subtype: "bar_stacked",
          title: "subtype BAR_STACKED",
          margin: { left: 80 },
          resizable: true,
          lookup: productLookup()
        })
      ]
    )
  );
}

function lineChartPage() {
  return rows(
    columns(
      [6],
      [
        lineChart({
          title: "subtype LINE (default)",
          resizable: true,
          lookup: productLookup()
        })
      ],
      [6],
      [
        lineChart({
          subtype: "smooth",
          title: "subtype SMOOTH",
          resizable: true,
          lookup: productLookup()
        })
      ]
    )
  );
}

function areaChartPage() {
  return rows(
    columns(
      [6],
      [
        areaChart({
          title: "subtype AREA (default)",
          resizable: true,
          lookup: productLookup()
        })
      ],
      [6],
      [
        areaChart({
          subtype: "area_stacked",
          title: "subtype AREA_STACKED",
          resizable: true,
          lookup: productLookup()
        })
      ]
    )
  );
}

function pieChartPage() {
  return rows(
    columns(
      [6],
      [
        pieChart({
          title: "subtype PIE (default)",
          resizable: true,
          lookup: pieLookup()
        })
      ],
      [6],
      [
        pieChart({
          subtype: "donut",
          title: "subtype DONUT",
          resizable: true,
          lookup: pieLookup()
        })
      ]
    )
  );
}

function bubbleChartPage() {
  return bubbleChart({
    title: "Bubble Chart",
    resizable: true,
    lookup: lookup("products", groupBy("Product", col("Product"), col("Quantity"), col("Quantity2"), col("Product")))
  });
}

function timeseriesPage() {
  return timeseries({
    title: "Timeseries",
    zoom: true,
    width: "100%",
    resizable: true,
    lookup: lookup("timeseries", )
  });
}

export default page(
  "Charts",
  tabs(
    ["Bar Chart", barChartPage()],
    ["Line Chart", lineChartPage()],
    ["Area Chart", areaChartPage()],
    ["Pie Chart", pieChartPage()],
    ["Bubble Chart", bubbleChartPage()],
    ["Timeseries", timeseriesPage()]
  ),
  { datasets: [productsDs, timeseriesDs] });
