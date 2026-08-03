import { page, bind, inlineSource, barChart, lookup } from "@casehubio/pages-ui";

const ds = bind("data", inlineSource([["Hello World", 42]]));

export default page(
  "InlineDataset",
  barChart({
    title: "Hello World",
    lookup: lookup("data"),
  }),
  { datasets: [ds] },
);
