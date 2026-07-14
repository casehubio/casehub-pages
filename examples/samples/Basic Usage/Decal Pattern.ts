import { page, bind, inlineSource, barChart, lookup, groupBy, col} from "@casehubio/pages-ui";

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

const extraConfig = {
  color: ["gray", "gray"],
  series: [
    {
      itemStyle: {
        decal: {
          symbol: "rectangle"
        }
      }
    },
    {
      itemStyle: {
        decal: {
          symbol: "pin"
        }
      }
    }
  ]
};

export default page(
  "Decal Pattern",
  barChart({
    extraConfiguration: JSON.stringify(extraConfig),
    lookup: lookup("products", groupBy("Product", col("Product")))
  }),
  { datasets: [productsDs] });
