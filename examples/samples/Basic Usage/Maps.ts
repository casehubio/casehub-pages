// @ts-nocheck
import { page, bind, inlineSource, html, mapChart, rows, columns, lookup, groupBy, col} from "@casehubio/pages-ui";

// Dataset
const countriesData = [
  ["Brazil", 6],
  ["USA", 3],
  ["China", 5],
  ["India", 5],
  ["Russia", 6],
  ["Canada", 6],
  ["Australia", 9],
  ["Mali", 4],
  ["South Africa", 11]
];

const countriesDs = bind("countries", inlineSource(countriesData, {
  columns: [
    { id: "Country", type: "LABEL" },
    { id: "Value", type: "NUMBER" }
  ]
}));

function countryLookup() {
  return lookup("countries", groupBy("Country", col("Country"), col("Value")));
}

export default page(
  "Maps",
  rows(
    columns(
      [6],
      [
        html("<h4><strong>subtype MAP_REGIONS (default)</strong></h4><br />"),
        mapChart({
          resizable: true,
          lookup: countryLookup()
        })
      ],
      [6],
      [
        html("<h4><strong>subtype MAP_MARKERS</strong></h4><br />"),
        mapChart({
          subtype: "markers",
          resizable: true,
          lookup: countryLookup()
        })
      ]
    )
  ),
  { datasets: [countriesDs] });
