// @ts-nocheck
import { page, bind, inlineSource, table, barChart, lookup} from "@casehubio/pages-ui";

const testDs = bind("test", inlineSource("['ABC', 1]"));

const globalColumns = [
  { id: "Column 0", expression: 'value + " - Global Change"' }
];

const localColumns = [
  { id: "Column 0", expression: 'value + " - Local Change"' }
];

export default page(
  "Global Column settings",
  table({
    height: 200,
    columns: globalColumns,
    lookup: lookup("test", )
  }),
  barChart({
    height: 200,
    columns: globalColumns,
    lookup: lookup("test", )
  }),
  table({
    height: 200,
    columns: localColumns,
    lookup: lookup("test", )
  }),
  { datasets: [testDs] });
