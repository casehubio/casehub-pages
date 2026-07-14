// @ts-nocheck
import {
  page, bind, inlineSource, html, selector, barChart, table, tabs, lookup, groupBy, col} from "@casehubio/pages-ui";

// Dataset
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

function sectionLookup() {
  return lookup("products", groupBy("Section", col("Section")));
}

function selectorsPage() {
  return [
    html(`<p>Melviz Displayers can filter each other. For filtering only we have selectors components. You can enable filter using the filter section, the component that filter others:<br /> <pre> filter:
    notification: true</pre>
</p><p>
  Then on the component that will be filtered:<pre>
filter:
    listening: true</pre>
</p>`),
    html("<strong> Default Selector </strong>"),
    selector({
      filter: { enabled: true, notification: true, listening: false, selfapply: false },
      lookup: sectionLookup()
    }),
    html("<br /><strong>subtype SELECTOR_LABELS (used only with LABEL column types)</strong>"),
    selector({
      subtype: "labels",
      filter: { notification: true },
      lookup: sectionLookup()
    }),
    barChart({
      filter: { listening: true },
      resizable: true,
      lookup: lookup("products", groupBy("Product", col("Product"), col("Quantity"), col("Quantity2")))
    })
  ];
}

function filterWithChartPage() {
  return [
    selector({
      filter: { enabled: true, notification: true },
      lookup: sectionLookup()
    }),
    barChart({
      filter: { listening: true },
      resizable: true,
      lookup: lookup("products", groupBy("Product", col("Product")))
    })
  ];
}

function filterWithTablePage() {
  return [
    selector({
      subtype: "labels",
      filter: { notification: true },
      lookup: sectionLookup()
    }),
    table({
      filter: { listening: true },
      lookup: lookup("products", )
    })
  ];
}

export default page(
  "Selectors and Filters",
  tabs(
    ["Selectors", selectorsPage()],
    ["Filter with Chart", filterWithChartPage()],
    ["Filter with Table", filterWithTablePage()]
  ),
  { datasets: [productsDs] });
