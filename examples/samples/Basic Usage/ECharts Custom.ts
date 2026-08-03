import { page, bind, inlineSource, iframePlugin, lookup, groupBy, col } from "@casehubio/pages-ui";
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

const echartsOption = {
  toolbox: {
    feature: {
      dataZoom: {},
      magicType: {
        type: ["line", "bar", "stack"],
      },
      saveAsImage: {},
    },
  },
  series: [
    { type: "bar", markLine: { data: [{ type: "max" }] } },
    { type: "bar", markLine: { data: [{ type: "max" }] } },
  ],
};

export default page(
  "ECharts Custom",
  iframePlugin({
    componentId: "echarts",
    width: "100%",
    height: "400px",
    settings: {
      "echarts.title": JSON.stringify({ text: "Products", left: "center" }),
      "echarts.option": JSON.stringify(echartsOption),
    },
    lookup: lookup("products", groupBy("product", col("product"), col("quantity"), col("quantity2"))),
  }),
  { datasets: [productsDs] },
);
