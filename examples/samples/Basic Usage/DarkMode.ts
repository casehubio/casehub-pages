import { page, bind, inlineSource, barChart, lookup, groupBy, col} from "@casehubio/pages-ui";

const testDs = bind("test", inlineSource([
  ["Hello", 20, 12],
  ["World", 10, 25]
]));

export default page(
  "DarkMode",
  barChart({
    mode: "dark",
    resizable: true,
    lookup: lookup("test", groupBy("Column 0", col("Column 0"), col("Column 1"), col("Column 2")))
  }),
  { datasets: [testDs] });
