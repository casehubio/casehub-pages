import { page, bind, inlineSource, dataTable, barChart, lookup } from "@casehubio/pages-ui";
import type { ColumnId, ColumnSettings } from "@casehubio/pages-data";

const testDs = bind("test", inlineSource("['ABC', 1]"));

const globalColumns: readonly ColumnSettings[] = [
  { id: "Column 0" as ColumnId, expression: 'value + " - Global Change"' },
];

const localColumns: readonly ColumnSettings[] = [
  { id: "Column 0" as ColumnId, expression: 'value + " - Local Change"' },
];

export default page(
  "Global Column settings",
  dataTable({
    height: "200",
    columns: globalColumns,
    lookup: lookup("test"),
  }),
  barChart({
    height: "200",
    columns: globalColumns,
    lookup: lookup("test"),
  }),
  dataTable({
    height: "200",
    columns: localColumns,
    lookup: lookup("test"),
  }),
  { datasets: [testDs] },
);
