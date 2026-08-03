import { page, bind, inlineSource, dataTable, lineChart, barChart, rows, columns, lookup, filterBy, sortBy } from "@casehubio/pages-ui";

const globalData = [
  ["A", 3],
  ["B", 2],
  ["C", 1],
  ["D", 0],
  ["E", -1],
  ["F", -2],
  ["G", -3],
];

const globalDs = bind("global", inlineSource(globalData));

const baseOps = [
  filterBy("Column 1", "GREATER_THAN", -3),
  filterBy("Column 1", "LOWER_THAN", 3),
  sortBy("Column 0", "DESCENDING"),
];

export default page(
  "Global Lookup Operation",
  rows(
    columns([12],
      [
        dataTable({
          resizable: true,
          rowCount: 3,
          lookup: lookup("global", ...baseOps),
        }),
      ],
    ),
    columns([4, 4, 4],
      [
        lineChart({
          title: "Global Lookup with all rows",
          resizable: true,
          rowCount: 10,
          lookup: lookup("global", ...baseOps),
        }),
      ],
      [
        barChart({
          title: "Values > 0",
          resizable: true,
          lookup: lookup("global", ...baseOps,
            filterBy("Column 1", "GREATER_THAN", 0)),
        }),
      ],
      [
        barChart({
          subtype: "bar",
          title: "Values < 0",
          resizable: true,
          lookup: lookup("global", ...baseOps,
            filterBy("Column 1", "LOWER_THAN", 0)),
        }),
      ],
    ),
  ),
  { datasets: [globalDs] },
);
