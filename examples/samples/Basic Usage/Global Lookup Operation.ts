import { page, bind, inlineSource, table, lineChart, barChart, rows, columns, lookup, filterBy, sortBy} from "@casehubio/pages-ui";

const globalData = [
  ["A", 3],
  ["B", 2],
  ["C", 1],
  ["D", 0],
  ["E", -1],
  ["F", -2],
  ["G", -3]
];

const globalDs = bind("global", inlineSource(globalData));

const baseOps = [
  filterBy("Column 1", "GREATER_THAN", [-3]),
  filterBy("Column 1", "LOWER_THAN", [3]),
  sortBy("Column 0", "DESCENDING")
];

export default page(
  "Global Lookup Operation",
  rows(
    columns(
      [12],
      [
        table({
          resizable: true,
          lookup: lookup("global", [...baseOps], { rowCount: 3 })
        })
      ]
    ),
    columns(
      [4],
      [
        lineChart({
          title: "Global Lookup with all rows",
          resizable: true,
          lookup: lookup("global", [...baseOps], { rowCount: 10 })
        })
      ],
      [4],
      [
        barChart({
          title: "Values > 0",
          resizable: true,
          lookup: lookup("global", ...baseOps,
            filterBy("Column 1", "GREATER_THAN", [0]))
        })
      ],
      [4],
      [
        barChart({
          subtype: "bar",
          title: "Values < 0",
          resizable: true,
          lookup: lookup("global", ...baseOps,
            filterBy("Column 1", "LOWER_THAN", [0]))
        })
      ]
    )
  ),
  { datasets: [globalDs] });
