import { page, barChart } from "@casehubio/pages-ui";

export default page(
  "InlineDataset",
  barChart({
    title: "Hello World",
    dataSet: '["Hello World", 42]'
  })
);
