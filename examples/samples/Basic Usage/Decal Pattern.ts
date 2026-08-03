import { page, bind, inlineSource, barChart, lookup, groupBy, col } from "@casehubio/pages-ui";
import type { ColumnId } from "@casehubio/pages-data";
import { ColumnType } from "@casehubio/pages-data";

const productsData = [
  ["Computers", "Scanner", 5, 3],
  ["Computers", "Printer", 7, 4],
  ["Computers", "Laptop", 3, 2],
  ["Electronics", "Camera", 10, 7],
  ["Electronics", "Headphones", 5, 9],
];

const productsDs = bind("products", inlineSource(productsData, {
  columns: [
    { id: "Section" as ColumnId, type: ColumnType.LABEL },
    { id: "Product" as ColumnId, type: ColumnType.LABEL },
    { id: "Quantity" as ColumnId, type: ColumnType.NUMBER },
    { id: "Quantity2" as ColumnId, type: ColumnType.NUMBER },
  ],
}));

const extraConfig = {
  color: ["gray", "gray"],
  series: [
    { itemStyle: { decal: { symbol: "rectangle" } } },
    { itemStyle: { decal: { symbol: "pin" } } },
  ],
};

export default page(
  "Decal Pattern",
  barChart({
    extra: extraConfig,
    lookup: lookup("products", groupBy("Product", col("Product"))),
  }),
  { datasets: [productsDs] },
);
