// @ts-nocheck
import { page, bind, inlineSource, iframePlugin, lookup, groupBy, col} from "@casehubio/pages-ui";

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

const echartsOption = {
  toolbox: {
    feature: {
      dataZoom: {},
      magicType: {
        type: ["line", "bar", "stack"]
      },
      saveAsImage: {}
    }
  },
  series: [
    {
      type: "bar",
      markLine: {
        data: [{ type: "max" }]
      }
    },
    {
      type: "bar",
      markLine: {
        data: [{ type: "max" }]
      }
    }
  ]
};

export default page(
  "ECharts Custom",
  iframePlugin({
    componentId: "echarts",
    width: "100%",
    height: "400px",
    properties: {
      "echarts.title": JSON.stringify({ text: "Products", left: "center" }),
      "echarts.option": JSON.stringify(echartsOption)
    },
    lookup: lookup("products", groupBy("product", col("product"), col("quantity"), col("quantity2")))
  }),
  { datasets: [productsDs] });
